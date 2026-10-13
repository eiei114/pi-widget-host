import { rmSync } from "node:fs";

export async function withSmokeDirectoryCleanup(directory, run, removeDirectory = rmSync) {
  try {
    return await run();
  } finally {
    try {
      removeDirectory(directory, { recursive: true, force: true });
    } catch {
      // A timed-out Pi child may still hold files on Windows; keep the case result reportable.
    }
  }
}
