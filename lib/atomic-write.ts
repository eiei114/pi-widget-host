import { randomUUID } from "node:crypto";
import { rename, unlink, writeFile } from "node:fs/promises";

type AtomicWriteOperations = {
  rename: typeof rename;
  unlink: typeof unlink;
  writeFile: typeof writeFile;
};

const defaultOperations: AtomicWriteOperations = { rename, unlink, writeFile };
const renameRetryDelaysMs = [10, 30, 60];
const unlinkRetryDelaysMs = [10, 30, 60];

async function renameWithRetry(from: string, to: string, renameFile: typeof rename): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await renameFile(from, to);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      const delay = renameRetryDelaysMs[attempt];
      if ((code !== "EPERM" && code !== "EBUSY") || delay === undefined) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

async function unlinkWithRetry(path: string, unlinkFile: typeof unlink): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await unlinkFile(path);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return;

      const delay = unlinkRetryDelaysMs[attempt];
      if ((code !== "EPERM" && code !== "EBUSY") || delay === undefined) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export async function writeFileAtomically(
  path: string,
  content: string,
  operations: AtomicWriteOperations = defaultOperations,
): Promise<void> {
  const tempPath = `${path}.${process.pid}.${randomUUID()}.tmp`;

  try {
    await operations.writeFile(tempPath, content, { encoding: "utf8", flag: "wx" });
    await renameWithRetry(tempPath, path, operations.rename);
  } catch (error) {
    await unlinkWithRetry(tempPath, operations.unlink).catch(() => {});
    throw error;
  }
}
