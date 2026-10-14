export const VERIFICATION_CONTRACT = "pi-sdk-behavior-v2";
export const SDK_NAMES = [
  "@earendil-works/pi-agent-core",
  "@earendil-works/pi-ai",
  "@earendil-works/pi-coding-agent",
  "@earendil-works/pi-tui",
];

export const UNHANDLED_ERROR_PATTERN = /UnhandledPromiseRejection|uncaught exception|shutdown error/i;
export const EXTENSION_LOAD_ERROR_PATTERN = /Failed to load extension|Error loading extension/i;

export function parseJsonLines(output) {
  return output.split(/\r?\n/).flatMap((line) => {
    if (!line.trim()) return [];
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
}

function assertion(id, expected, observed, passed) {
  return { id, expected, observed: JSON.stringify(observed), passed: passed === true };
}

function commandNames(responses) {
  const response = responses.find((row) => row?.type === "response" && row.command === "get_commands");
  return Array.isArray(response?.data?.commands)
    ? response.data.commands.map((command) => command?.name).filter((name) => typeof name === "string")
    : [];
}

function statusNotification(responses) {
  return responses.find((row) => row?.type === "extension_ui_request"
    && row.method === "notify" && typeof row.message === "string" && row.message.startsWith("Setup:"));
}

function handledPrompt(responses) {
  return responses.find((row) => row?.type === "response" && row.command === "prompt"
    && row.success === true && row.data?.disposition === "handled");
}

export function behaviorAssertions(name, observation) {
  const { responses = [], exitCode = -1, fullOutput = "", expectedVersion = "1.1.0" } = observation;
  const commands = commandNames(responses);
  const prompt = handledPrompt(responses);
  const notification = statusNotification(responses);

  if (name === "extension_load") {
    return [assertion(
      "extension_registered",
      "The actual Pi RPC command inventory includes widget-host:status",
      commands,
      commands.includes("widget-host:status"),
    )];
  }

  if (name === "happy_path") {
    const featureWorks = prompt !== undefined
      && notification?.message.includes("Demo provider: enabled") === true
      && notification.message.includes("Active provider: pi-widget-host.demo");
    return [assertion(
      "feature_response",
      "The real host handles /widget-host:status and reports the enabled demo provider as active",
      { prompt: prompt ?? null, notification: notification ?? null },
      featureWorks,
    )];
  }

  if (name === "error_path") {
    const recovered = prompt !== undefined
      && notification?.message.includes("Setup: not yet") === true
      && notification.message.includes("Active provider: none");
    return [assertion(
      "handled_error",
      "Malformed host config is contained; the real status command handles the request using safe defaults",
      { prompt: prompt ?? null, notification: notification ?? null },
      recovered,
    )];
  }

  if (name === "reload_cleanup") {
    const firstExitCode = observation.firstExitCode ?? -1;
    const secondOutput = observation.secondOutput ?? fullOutput;
    const secondExitCode = observation.secondExitCode ?? exitCode;
    const clean = firstExitCode === 0 && secondExitCode === 0
      && !UNHANDLED_ERROR_PATTERN.test(fullOutput)
      && !UNHANDLED_ERROR_PATTERN.test(secondOutput);
    return [
      assertion(
        "reloaded_extension_registered",
        "A second actual Pi process after disposal registers widget-host:status",
        commands,
        commands.includes("widget-host:status"),
      ),
      assertion(
        "reloaded_feature_response",
        "The second actual Pi process handles the status command and returns the demo-provider feature result",
        { prompt: prompt ?? null, notification: notification ?? null },
        prompt !== undefined
          && notification?.message.includes("Demo provider: enabled") === true
          && notification.message.includes("Active provider: pi-widget-host.demo"),
      ),
      assertion(
        "clean_shutdown",
        "Both actual Pi processes complete session shutdown with exit code 0 and no unhandled/shutdown errors",
        { firstExitCode, secondExitCode, unhandledError: UNHANDLED_ERROR_PATTERN.test(fullOutput) },
        clean,
      ),
    ];
  }

  if (name === "host_shell") {
    const observed = fullOutput.trim();
    return [assertion(
      "native_shell_boundary",
      "The native host shell launches the locally pinned Pi CLI and prints exactly its installed version",
      { exitCode, output: observed, expectedVersion },
      exitCode === 0 && observed === expectedVersion,
    )];
  }

  throw new Error(`Unknown Pi SDK smoke case: ${name}`);
}
