import assert from "node:assert/strict";
import test from "node:test";
import { behaviorAssertions, parseJsonLines } from "../scripts/pi-sdk-smoke-contract.mjs";
import { withSmokeDirectoryCleanup } from "../scripts/pi-sdk-smoke-cleanup.mjs";

const commandResponse = {
  type: "response",
  command: "get_commands",
  success: true,
  data: { commands: [{ name: "widget-host:status" }] },
};
const handledPrompt = {
  type: "response",
  command: "prompt",
  success: true,
  data: { disposition: "handled" },
};
const happyNotification = {
  type: "extension_ui_request",
  method: "notify",
  message: "Setup: done\nDemo provider: enabled\nActive provider: pi-widget-host.demo",
};

test("Pi smoke preserves a timed-out failed case when Windows cleanup raises EBUSY", async () => {
  const timeoutCase = {
    name: "happy_path",
    exit_code: -1,
    passed: false,
    error: "Pi RPC child did not exit within the 1s cleanup grace after 15000ms",
  };
  let attempts = 0;
  const result = await withSmokeDirectoryCleanup("busy-temp-directory", async () => timeoutCase, (directory, options) => {
    assert.equal(directory, "busy-temp-directory");
    assert.deepEqual(options, { recursive: true, force: true });
    attempts += 1;
    throw Object.assign(new Error("resource busy"), { code: "EBUSY" });
  }, () => {});

  // Transient busy errors are retried; the failed case result is preserved.
  assert.equal(attempts, 6);
  assert.deepEqual({ ...result, cleanup_error: undefined }, { ...timeoutCase, cleanup_error: undefined });
  assert.equal(result.passed, false);
  assert.match(result.cleanup_error, /resource busy/);
});

test("Pi SDK smoke contract parses JSONL and accepts observed feature behavior", () => {
  assert.deepEqual(parseJsonLines('{"type":"response"}\nnot-json\n'), [{ type: "response" }]);
  const assertions = behaviorAssertions("happy_path", {
    responses: [handledPrompt, happyNotification],
    exitCode: 0,
  });
  assert.equal(assertions[0]?.id, "feature_response");
  assert.equal(assertions[0]?.passed, true);
});

test("Pi SDK smoke contract fails closed when the feature response is deliberately missing", () => {
  const assertions = behaviorAssertions("happy_path", {
    responses: [handledPrompt],
    exitCode: 0,
  });
  assert.equal(assertions[0]?.passed, false);
});

test("Pi SDK smoke contract checks both registration and handled malformed-config recovery", () => {
  const responses = [commandResponse, handledPrompt, {
    type: "extension_ui_request",
    method: "notify",
    message: "Setup: not yet\nDemo provider: disabled\nActive provider: none",
  }];
  const assertions = behaviorAssertions("extension_load", { responses });
  assert.equal(assertions[0]?.id, "extension_registered");
  assert.equal(assertions[0]?.passed, true);
  assert.equal(behaviorAssertions("error_path", { responses })[0]?.passed, true);
  assert.equal(behaviorAssertions("error_path", { responses: [commandResponse] })[0]?.passed, false);
});

test("Pi SDK smoke contract requires second-process behavior and clean shutdown", () => {
  const assertions = behaviorAssertions("reload_cleanup", {
    responses: [commandResponse, handledPrompt, happyNotification],
    firstExitCode: 0,
    secondExitCode: 0,
    fullOutput: "",
  });
  assert.deepEqual(assertions.map((entry) => entry.id), [
    "reloaded_extension_registered",
    "reloaded_feature_response",
    "clean_shutdown",
  ]);
  assert.ok(assertions.every((entry) => entry.passed));
  assert.equal(behaviorAssertions("reload_cleanup", {
    responses: [commandResponse, handledPrompt],
    firstExitCode: 0,
    secondExitCode: 0,
    fullOutput: "",
  })[1]?.passed, false);
  assert.equal(behaviorAssertions("reload_cleanup", {
    responses: [commandResponse, handledPrompt, happyNotification],
    firstExitCode: 0,
    secondExitCode: 1,
    fullOutput: "",
  })[2]?.passed, false);
});

test("Pi SDK smoke contract verifies the pinned CLI through the host shell", () => {
  assert.equal(behaviorAssertions("host_shell", {
    exitCode: 0,
    fullOutput: "1.1.0\n",
  })[0]?.passed, true);
  assert.equal(behaviorAssertions("host_shell", {
    exitCode: 0,
    fullOutput: "",
  })[0]?.passed, false);
});

test("a retried cleanup succeeds after transient busy errors", async () => {
  let attempts = 0;
  const result = await withSmokeDirectoryCleanup("busy", async () => ({ passed: true }), () => {
    attempts += 1;
    if (attempts < 3) throw Object.assign(new Error("busy"), { code: "EBUSY" });
  }, () => {});
  assert.deepEqual(result, { passed: true });
  assert.equal(attempts, 3);
});

test("a passed case is not reported as passed when cleanup never succeeds", async () => {
  const result = await withSmokeDirectoryCleanup("busy", async () => ({ passed: true, name: "happy_path" }),
    () => { throw Object.assign(new Error("resource busy"), { code: "EBUSY" }); }, () => {});
  assert.equal(result.passed, false);
  assert.match(result.cleanup_error, /resource busy/);
  assert.equal(result.name, "happy_path");
});

test("a failed case keeps its original failure when cleanup also fails", async () => {
  const failed = { passed: false, name: "error_path", error: "deadline" };
  const result = await withSmokeDirectoryCleanup("busy", async () => failed,
    () => { throw Object.assign(new Error("EBUSY"), { code: "EBUSY" }); }, () => {});
  assert.equal(result.error, "deadline");
  assert.equal(result.passed, false);
});
