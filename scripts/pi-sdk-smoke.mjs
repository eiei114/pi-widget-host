import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import {
  behaviorAssertions,
  EXTENSION_LOAD_ERROR_PATTERN,
  parseJsonLines,
  SDK_NAMES,
  UNHANDLED_ERROR_PATTERN,
  VERIFICATION_CONTRACT,
} from "./pi-sdk-smoke-contract.mjs";
import { withSmokeDirectoryCleanup } from "./pi-sdk-smoke-cleanup.mjs";

const root = resolve(import.meta.dirname, "..");
const reportPath = process.argv.includes("--update-curated-report")
  ? resolve(root, "docs/verification/pi-sdk-smoke.json")
  : resolve(root, ".tmp/pi-sdk-smoke.json");
const shortProbeDeadlineMs = 15_000;
const command = "npm run smoke:pi";
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const manifest = readJson(resolve(root, "package.json"));
const frozenSdkVersions = Object.fromEntries(SDK_NAMES.map((name) => [name, "1.3.0"]));
const sdkVersions = Object.fromEntries(SDK_NAMES.map((name) => [
  name,
  readJson(resolve(root, "node_modules", name, "package.json")).version,
]));

for (const name of SDK_NAMES) {
  if (manifest.devDependencies?.[name] !== frozenSdkVersions[name]
    || sdkVersions[name] !== frozenSdkVersions[name]) {
    throw new Error(`Smoke requires ${name} pinned and installed at ${frozenSdkVersions[name]}; found ${manifest.devDependencies?.[name]} / ${sdkVersions[name]}`);
  }
}

const piManifest = readJson(resolve(root, "node_modules/@earendil-works/pi-coding-agent/package.json"));
const piCli = resolve(root, "node_modules/@earendil-works/pi-coding-agent", piManifest.bin.pi);
const rpcArgs = [
  piCli,
  "--offline",
  "--no-session",
  "--no-tools",
  "--no-extensions",
  "--no-skills",
  "--no-context-files",
  "--no-prompt-templates",
  "--no-mcp",
  "-e",
  ".",
  "--mode",
  "rpc",
];
const demoConfig = {
  schemaVersion: 1,
  setupComplete: true,
  demoProviderEnabled: true,
  presetId: "always-demo",
  mutedProviderIds: [],
};

function createAgentDir(config) {
  const agentDir = mkdtempSync(resolve(tmpdir(), "pi-widget-host-sdk-smoke-"));
  writeFileSync(resolve(agentDir, "pi-widget-host-config.json"), config, "utf8");
  return agentDir;
}

function runProcess(executable, args, { agentDir, input = "" } = {}) {
  const result = spawnSync(executable, args, {
    cwd: root,
    env: {
      ...process.env,
      ...(agentDir ? { PI_CODING_AGENT_DIR: agentDir, PI_WIDGET_HOST_AGENT_DIR: agentDir } : {}),
    },
    input,
    encoding: "utf8",
    timeout: shortProbeDeadlineMs,
    windowsHide: true,
  });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const fullOutput = `${stdout}${stderr}`;
  const responses = parseJsonLines(stdout);
  return {
    exitCode: result.status ?? -1,
    error: result.error?.message,
    stdout,
    stderr,
    fullOutput,
    responses,
    hasLoadError: EXTENSION_LOAD_ERROR_PATTERN.test(fullOutput),
    hasUnhandledError: UNHANDLED_ERROR_PATTERN.test(fullOutput)
      || responses.some((row) => row?.type === "extension_error"),
  };
}

function runRpcProcess(agentDir, { includePrompt = true } = {}) {
  return new Promise((resolveResult) => {
    const child = spawn(process.execPath, rpcArgs, {
      cwd: root,
      env: { ...process.env, PI_CODING_AGENT_DIR: agentDir, PI_WIDGET_HOST_AGENT_DIR: agentDir },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let pendingLine = "";
    let timeout;
    let cleanupTimeout;
    let timedOut = false;
    let completed = false;
    const responses = [];

    const finish = (exitCode, signal, error) => {
      if (completed) return;
      completed = true;
      clearTimeout(timeout);
      clearTimeout(cleanupTimeout);
      const fullOutput = `${stdout}${stderr}`;
      resolveResult({
        exitCode,
        signal,
        error: error ?? (timedOut ? `Pi RPC probe exceeded ${shortProbeDeadlineMs}ms` : undefined),
        stdout,
        stderr,
        fullOutput,
        responses,
        hasLoadError: EXTENSION_LOAD_ERROR_PATTERN.test(fullOutput),
        hasUnhandledError: UNHANDLED_ERROR_PATTERN.test(fullOutput)
          || responses.some((row) => row?.type === "extension_error"),
      });
    };

    const requestShutdown = () => {
      if (!child.stdin.destroyed && !child.stdin.writableEnded) child.stdin.end();
    };

    const inspectLine = (line) => {
      if (!line.trim()) return;
      try {
        const row = JSON.parse(line);
        responses.push(row);
        const doneId = includePrompt ? "feature" : "commands";
        if (row?.type === "response" && row.id === doneId) requestShutdown();
      } catch {
        // Keep non-JSON output in captured evidence; the assertion layer fails closed.
      }
    };

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString("utf8");
      stdout += text;
      pendingLine += text;
      const lines = pendingLine.split(/\r?\n/);
      pendingLine = lines.pop() ?? "";
      for (const line of lines) inspectLine(line);
    });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
    child.on("error", (error) => finish(-1, null, error.message));
    child.on("close", (code, signal) => {
      if (pendingLine) inspectLine(pendingLine);
      finish(code ?? -1, signal, timedOut ? `Pi RPC probe exceeded ${shortProbeDeadlineMs}ms` : undefined);
    });

    child.on("spawn", () => {
      const requests = [JSON.stringify({ type: "get_commands", id: "commands" })];
      if (includePrompt) requests.push(JSON.stringify({ type: "prompt", id: "feature", message: "/widget-host:status" }));
      child.stdin.write(`${requests.join("\n")}\n`);
    });

    timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
      cleanupTimeout = setTimeout(() => {
        finish(-1, null, `Pi RPC child did not exit within the 1s cleanup grace after ${shortProbeDeadlineMs}ms`);
      }, 1_000);
    }, shortProbeDeadlineMs);
  });
}

function makeCase(name, processes, assertionInput = {}) {
  const responses = assertionInput.responses ?? processes.flatMap((entry) => entry.responses);
  const fullOutput = processes.map((entry) => entry.fullOutput).join("\n--- next Pi process ---\n");
  const hasUnhandledError = processes.some((entry) => entry.hasUnhandledError);
  const hasLoadError = processes.some((entry) => entry.hasLoadError);
  const exitCode = assertionInput.exitCode ?? processes.at(-1)?.exitCode ?? -1;
  const assertions = behaviorAssertions(name, {
    ...assertionInput,
    responses,
    exitCode,
    fullOutput,
    expectedVersion: "1.3.0",
  });
  const evidence = processes.map((entry, index) => [
    `process ${index + 1}: exit=${entry.exitCode}${entry.error ? ` error=${entry.error}` : ""}`,
    `stdout:\n${entry.stdout}`,
    `stderr:\n${entry.stderr}`,
  ].join("\n")).join("\n--- next Pi process ---\n");
  const safeEvidence = redactEvidence(evidence);
  return {
    name,
    command,
    exit_code: exitCode,
    passed: processes.every((entry) => entry.exitCode === 0 && !entry.error)
      && !hasUnhandledError
      && !hasLoadError
      && assertions.every((entry) => entry.passed),
    evidence: safeEvidence,
    assertions,
    hasUnhandledError,
    hasLoadError,
  };
}

async function runRpcCase(name, configText) {
  const agentDir = createAgentDir(configText);
  return withSmokeDirectoryCleanup(agentDir, async () => {
    const result = await runRpcProcess(agentDir, { includePrompt: name !== "extension_load" });
    return makeCase(name, [result]);
  });
}

async function runReloadCleanupCase() {
  const agentDir = createAgentDir(`${JSON.stringify(demoConfig, null, 2)}\n`);
  return withSmokeDirectoryCleanup(agentDir, async () => {
    const first = await runRpcProcess(agentDir);
    const second = await runRpcProcess(agentDir);
    return makeCase("reload_cleanup", [first, second], {
      responses: second.responses,
      firstExitCode: first.exitCode,
      secondExitCode: second.exitCode,
      secondOutput: second.fullOutput,
      exitCode: second.exitCode,
    });
  });
}

function quotePowerShell(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function redactEvidence(value) {
  const escapedRoot = JSON.stringify(root).slice(1, -1);
  return value.replaceAll(escapedRoot, "<repo>").replaceAll(root, "<repo>");
}

async function runHostShellCase() {
  const agentDir = mkdtempSync(resolve(tmpdir(), "pi-widget-host-shell-smoke-"));
  return withSmokeDirectoryCleanup(agentDir, async () => {
    let executable;
    let args;
    if (process.platform === "win32") {
      executable = resolve(process.env.SystemRoot ?? "C:/Windows", "System32/WindowsPowerShell/v1.0/powershell.exe");
      args = [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `& ${quotePowerShell(process.execPath)} ${quotePowerShell(piCli)} --no-extensions --version; exit $LASTEXITCODE`,
      ];
    } else {
      executable = "/bin/sh";
      args = ["-c", '"$1" "$2" --no-extensions --version', "pi-widget-host-smoke", process.execPath, piCli];
    }
    const result = runProcess(executable, args, { agentDir });
    return makeCase("host_shell", [result], {
      responses: [],
      exitCode: result.exitCode,
      fullOutput: result.stdout,
    });
  });
}

const cases = [];
cases.push(await runRpcCase("extension_load", `${JSON.stringify(demoConfig, null, 2)}\n`));
cases.push(await runRpcCase("happy_path", `${JSON.stringify(demoConfig, null, 2)}\n`));
cases.push(await runRpcCase("error_path", "{ deliberately malformed host config\n"));
cases.push(await runReloadCleanupCase());
cases.push(await runHostShellCase());

const report = {
  schema_version: 1,
  verification_contract: VERIFICATION_CONTRACT,
  sdk_versions: sdkVersions,
  platform: process.platform,
  model_inference: "none; the real offline Pi process loads the package and handles its RPC command",
  runtime_boundary: "Pi CLI, extension loading, lifecycle and widget-host feature paths are real; only provider inference is omitted.",
  unhandled_errors: cases.filter((entry) => entry.hasUnhandledError).length,
  extension_load_errors: cases.filter((entry) => entry.hasLoadError
    || (entry.name === "extension_load" && !entry.passed)).length,
  cases: cases.map(({ hasUnhandledError, hasLoadError, evidence, ...entry }) => ({
    ...entry,
    evidence: evidence.slice(-12_000),
  })),
};

mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  verification_contract: VERIFICATION_CONTRACT,
  platform: process.platform,
  cases: cases.map(({ name, passed, exit_code }) => ({ name, passed, exit_code })),
}));

if (cases.some((entry) => !entry.passed)) process.exitCode = 1;
