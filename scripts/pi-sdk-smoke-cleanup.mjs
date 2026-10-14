import { rmSync } from "node:fs";

const TRANSIENT_CODES = new Set(["EBUSY", "EPERM", "ENOTEMPTY"]);
const RETRIES = 5;
const RETRY_DELAY_MS = 100;

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Remove a smoke run's temporary directory.
 *
 * A Pi child killed by the probe deadline can still hold files on Windows, so
 * transient busy errors are retried. A case that already failed keeps its
 * original result: a cleanup problem must not replace the real failure. A case
 * that otherwise passed must not be reported as passed when cleanup never
 * succeeded, so the unresolved error is surfaced on the result.
 */
export async function withSmokeDirectoryCleanup(directory, run, removeDirectory = rmSync, sleep = sleepSync) {
  let result;
  let thrown;
  try {
    result = await run();
  } catch (error) {
    thrown = error;
  }

  let cleanupError;
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    try {
      removeDirectory(directory, { recursive: true, force: true });
      cleanupError = undefined;
      break;
    } catch (error) {
      cleanupError = error;
      if (!TRANSIENT_CODES.has(error?.code) || attempt === RETRIES) break;
      sleep(RETRY_DELAY_MS);
    }
  }

  if (thrown) {
    if (cleanupError) thrown.cleanup_error = cleanupError.message;
    throw thrown;
  }
  if (cleanupError && result && typeof result === "object") {
    return {
      ...result,
      cleanup_error: cleanupError.message,
      passed: result.passed === true ? false : result.passed,
      error: result.error ?? `Temporary smoke directory cleanup failed: ${cleanupError.message}`,
    };
  }
  return result;
}
