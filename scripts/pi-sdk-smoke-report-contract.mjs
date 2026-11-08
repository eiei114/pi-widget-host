import { SDK_NAMES, VERIFICATION_CONTRACT } from "./pi-sdk-smoke-contract.mjs";

// The committed report is evidence, not a source of truth: every value it claims
// must be derivable from the checkout that ships it. Validate against the
// manifest pins so a dependency bump cannot leave stale evidence behind.
export const REQUIRED_CASE_ASSERTIONS = {
  extension_load: ["extension_registered"],
  happy_path: ["feature_response"],
  error_path: ["handled_error"],
  reload_cleanup: [
    "reloaded_extension_registered",
    "reloaded_feature_response",
    "clean_shutdown",
  ],
  host_shell: ["native_shell_boundary"],
};

export function reportContractErrors(report, expectedSdkVersions) {
  const errors = [];
  if (report?.schema_version !== 1) errors.push(`schema_version must be 1, found ${JSON.stringify(report?.schema_version)}`);
  if (report?.verification_contract !== VERIFICATION_CONTRACT) {
    errors.push(`verification_contract must be ${VERIFICATION_CONTRACT}, found ${JSON.stringify(report?.verification_contract)}`);
  }
  if (report?.unhandled_errors !== 0) errors.push(`unhandled_errors must be 0, found ${JSON.stringify(report?.unhandled_errors)}`);
  if (report?.extension_load_errors !== 0) {
    errors.push(`extension_load_errors must be 0, found ${JSON.stringify(report?.extension_load_errors)}`);
  }

  for (const name of SDK_NAMES) {
    const expected = expectedSdkVersions?.[name];
    const recorded = report?.sdk_versions?.[name];
    if (typeof expected !== "string" || expected === "") {
      errors.push(`expected ${name} version missing from the package.json devDependency pins`);
    } else if (recorded !== expected) {
      errors.push(`sdk_versions.${name} must equal the package.json pin ${expected}, found ${JSON.stringify(recorded)}`);
    }
  }

  const cases = Array.isArray(report?.cases) ? report.cases : [];
  const names = cases.map((entry) => entry?.name);
  for (const [name, assertionIds] of Object.entries(REQUIRED_CASE_ASSERTIONS)) {
    const entry = cases.find((candidate) => candidate?.name === name);
    if (!entry) {
      errors.push(`missing case ${name}`);
      continue;
    }
    if (entry.passed !== true) errors.push(`case ${name} is not marked passed`);
    if (typeof entry.exit_code !== "number" || entry.exit_code !== 0) {
      errors.push(`case ${name} exit_code must be 0, found ${JSON.stringify(entry.exit_code)}`);
    }
    if (typeof entry.command !== "string" || entry.command === "") errors.push(`case ${name} is missing a reproducible command`);
    if (typeof entry.evidence !== "string" || entry.evidence.trim() === "") errors.push(`case ${name} is missing captured evidence`);
    for (const id of assertionIds) {
      const found = Array.isArray(entry.assertions)
        ? entry.assertions.find((assertion) => assertion?.id === id)
        : undefined;
      if (!found) errors.push(`case ${name} is missing assertion ${id}`);
      else if (found.passed !== true) errors.push(`assertion ${id} is not marked passed`);
    }
  }

  const unexpected = names.filter((name) => !(name in REQUIRED_CASE_ASSERTIONS));
  if (unexpected.length > 0) errors.push(`unknown case names: ${JSON.stringify(unexpected)}`);
  if (names.length !== Object.keys(REQUIRED_CASE_ASSERTIONS).length) {
    errors.push(`expected ${Object.keys(REQUIRED_CASE_ASSERTIONS).length} cases, found ${names.length}`);
  }

  return errors;
}
