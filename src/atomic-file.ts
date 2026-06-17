import { mkdir, open, rename, unlink, type FileHandle } from "node:fs/promises";
import { dirname, join } from "node:path";

export async function writeJsonFileAtomically(path: string, data: unknown): Promise<void> {
  await writeTextFileAtomically(path, `${JSON.stringify(data, null, 2)}\n`);
}

export async function writeTextFileAtomically(
  path: string,
  data: string,
  encoding: BufferEncoding = "utf8"
): Promise<void> {
  const dir = dirname(path);
  await mkdir(dir, { recursive: true });
  const tempPath = join(dir, `.${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2)}.tmp`);
  let fileHandle: FileHandle | null = null;

  try {
    fileHandle = await open(tempPath, "w");
    await fileHandle.writeFile(data, encoding);
    await fileHandle.sync();
    await fileHandle.close();
    fileHandle = null;

    await rename(tempPath, path);
    await syncDirectory(dir);
  } catch (error) {
    if (fileHandle) {
      await closeQuietly(fileHandle);
    }
    await unlinkQuietly(tempPath);
    throw error;
  }
}

async function syncDirectory(dir: string): Promise<void> {
  let dirHandle: FileHandle | null = null;

  try {
    dirHandle = await open(dir, "r");
    await dirHandle.sync();
  } catch (error) {
    if (!isIgnorableDirectorySyncError(error)) {
      throw error;
    }
  } finally {
    if (dirHandle) {
      await closeQuietly(dirHandle);
    }
  }
}

async function closeQuietly(fileHandle: FileHandle): Promise<void> {
  try {
    await fileHandle.close();
  } catch {
    // Best-effort cleanup after a write failure.
  }
}

async function unlinkQuietly(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch {
    // The temp file may not exist if the failure happened before creation or after rename.
  }
}

function isIgnorableDirectorySyncError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      ["EINVAL", "EISDIR", "EPERM", "ENOTSUP"].includes(String(error.code))
  );
}
