import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { reportContractErrors } from "../scripts/pi-sdk-smoke-report-contract.mjs";
import { SDK_NAMES } from "../scripts/pi-sdk-smoke-contract.mjs";

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));

const manifest = await readJson("../package.json");
const report = await readJson("../docs/verification/pi-sdk-smoke.json");
const pinnedVersions = Object.fromEntries(
  SDK_NAMES.map((name) => [name, manifest.devDependencies?.[name]]),
);

const cloneReport = () => JSON.parse(JSON.stringify(report));
const dropCase = (name) => {
  const copy = cloneReport();
  copy.cases = copy.cases.filter((entry) => entry.name !== name);
  return copy;
};

test("committed Pi SDK smoke report matches the package.json SDK pins", () => {
  assert.deepEqual(reportContractErrors(report, pinnedVersions), []);
});

test("report contract rejects a stale SDK version in the committed evidence", () => {
  const copy = cloneReport();
  copy.sdk_versions["@earendil-works/pi-coding-agent"] = "1.4.0";
  const errors = reportContractErrors(copy, pinnedVersions);
  assert.ok(errors.some((error) => error.includes("must equal the package.json pin")));
});

test("report contract rejects a missing case, assertion, command or evidence", () => {
  assert.ok(reportContractErrors(dropCase("reload_cleanup"), pinnedVersions).includes("missing case reload_cleanup"));

  const copy = cloneReport();
  const reload = copy.cases.find((entry) => entry.name === "reload_cleanup");
  reload.assertions = reload.assertions.filter((entry) => entry.id !== "reloaded_feature_response");
  assert.ok(reportContractErrors(copy, pinnedVersions)
    .includes("case reload_cleanup is missing assertion reloaded_feature_response"));

  const noEvidence = cloneReport();
  noEvidence.cases.find((entry) => entry.name === "happy_path").evidence = "   ";
  assert.ok(reportContractErrors(noEvidence, pinnedVersions)
    .includes("case happy_path is missing captured evidence"));

  const noCommand = cloneReport();
  noCommand.cases.find((entry) => entry.name === "extension_load").command = "";
  assert.ok(reportContractErrors(noCommand, pinnedVersions)
    .includes("case extension_load is missing a reproducible command"));
});

test("report contract rejects a failing case, a non-zero exit, and recorded runtime errors", () => {
  const failing = cloneReport();
  failing.cases.find((entry) => entry.name === "error_path").passed = false;
  assert.ok(reportContractErrors(failing, pinnedVersions).includes("case error_path is not marked passed"));

  const nonZero = cloneReport();
  nonZero.cases.find((entry) => entry.name === "host_shell").exit_code = 1;
  assert.ok(reportContractErrors(nonZero, pinnedVersions).includes("case host_shell exit_code must be 0, found 1"));

  const loadError = cloneReport();
  loadError.extension_load_errors = 1;
  assert.ok(reportContractErrors(loadError, pinnedVersions)
    .includes("extension_load_errors must be 0, found 1"));

  const unhandled = cloneReport();
  unhandled.unhandled_errors = 2;
  assert.ok(reportContractErrors(unhandled, pinnedVersions).includes("unhandled_errors must be 0, found 2"));
});

test("report contract rejects a stale contract id and a missing SDK pin", () => {
  const staleContract = cloneReport();
  staleContract.verification_contract = "pi-sdk-behavior-v1";
  assert.ok(reportContractErrors(staleContract, pinnedVersions)
    .some((error) => error.includes("verification_contract must be pi-sdk-behavior-v2")));

  const missingPin = cloneReport();
  assert.ok(reportContractErrors(missingPin, {})
    .some((error) => error.includes("missing from the package.json devDependency pins")));
});
