import assert from "node:assert/strict";
import test from "node:test";
import { behaviorAssertions, parseJsonLines } from "../scripts/pi-sdk-smoke-contract.mjs";

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
