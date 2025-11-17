import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { tmpdir } from "os";
import { pipeline } from "stream/promises";
import Corestore from "corestore";
import Hyperdrive from "hyperdrive";

export const INIT_FILE = "__init__.txt";

/* ----------------- PATH HELPERS ----------------- */
export function normDrivePath(p = "/") {
  if (!p) return "/";
  p = p.replace(/\\/g, "/");
  if (!p.startsWith("/")) p = "/" + p;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p;
}

export function isInitFile(p) {
  return normDrivePath(p).endsWith("/" + INIT_FILE);
}

/* ----------------- CREATE FOLDER ----------------- */
export async function createFolder(drive, folderPath) {
  folderPath = normDrivePath(folderPath);
  if (folderPath === "/") return;

  // recursively create parent folders with __init__.txt
  const parts = folderPath.split("/").filter(Boolean);
  let current = "";
  for (const part of parts) {
    current += "/" + part;
    const initFilePath = current + "/" + INIT_FILE;
    try {
      await drive.put(initFilePath, Buffer.from(""));
    } catch {}
  }
}

/* ----------------- LIST FILES ----------------- */
export async function listFiles(drive, folder = "/") {
  folder = normDrivePath(folder);

  const entriesList = [];
  try {
    for await (const entry of drive.list(folder, { recursive: true })) {
      if (!entry?.key) continue;
      entriesList.push(entry);
    }
  } catch {}

  // First, collect directories
  const dirs = new Set();
  for (const e of entriesList) {
    const dir = path.posix.dirname(e.key);
    const parts = dir.split("/").filter(Boolean);
    let current = "";
    for (const part of parts) {
      current += "/" + part;
      dirs.add(current);
    }
  }
  dirs.add("/"); // always include root

  // Initialize tree with directories
  const tree = {};
  const dirNodes = { "/": tree };

  for (const d of Array.from(dirs).sort((a, b) => a.length - b.length)) {
    if (d === "/") continue;
    const parent = path.posix.dirname(d);
    const name = path.posix.basename(d);
    const parentNode = dirNodes[parent];
    parentNode[name] = {};
    dirNodes[d] = parentNode[name];
  }

  // Add files
  for (const e of entriesList) {
    const name = path.posix.basename(e.key);
    const dir = path.posix.dirname(e.key);
    if (!dirNodes[dir]) continue; // safety
    if (name === INIT_FILE) {
      dirNodes[dir][INIT_FILE] = { type: "file" };
    } else if (e.value?.blob) {
      dirNodes[dir][name] = { type: "file" };
    }
  }

  return tree;
}

/* ----------------- DELETE PATH ----------------- */
export async function deletePath(drive, targetPath) {
  targetPath = normDrivePath(targetPath);

  // Collect all entries under the folder (including the target folder itself)
  const entries = [];
  for await (const entry of drive.list(targetPath, { recursive: true })) {
    if (!entry?.key) continue;
    entries.push(entry.key);
  }

  // Include the folder's own __init__.txt if it exists
  const initPath = path.posix.join(targetPath, INIT_FILE);
  const hasInit = entries.includes(initPath) || (await drive.get(initPath).then(buf => !!buf).catch(() => false));
  if (!entries.includes(initPath) && hasInit) entries.push(initPath);

  // Split entries into directories vs files based on path string
  const dirs = [];
  const files = [];
  for (const key of entries) {
    if (key.endsWith(INIT_FILE)) dirs.push(key);
    else files.push(key);
  }

  // Delete all files first
  for (const file of files) {
    await drive.del(normDrivePath(file)).catch(() => {});
  }

  // Then delete directory markers (__init__.txt) in deepest-first order
  dirs.sort((a, b) => b.length - a.length);
  for (const dir of dirs) {
    await drive.del(normDrivePath(dir)).catch(() => {});
  }
}

/* ----------------- COPY PATH ----------------- */
export async function copyPath(srcDrive, srcPath, destDrive, destPath) {
  srcPath = normDrivePath(srcPath);
  destPath = normDrivePath(destPath);

  try {
    const buf = await srcDrive.get(srcPath);
    if (buf !== undefined) {
      await destDrive.put(destPath, buf);
      return;
    }
  } catch {}

  for await (const entry of srcDrive.list(srcPath, { recursive: true })) {
    if (!entry?.key) continue;
    const rel = normDrivePath(entry.key).slice(srcPath.length + 1);
    const target = normDrivePath(destPath + "/" + rel);
    const buf = await srcDrive.get(entry.key).catch(() => null);
    if (buf) await destDrive.put(target, buf);
  }
}

/* ----------------- MOVE PATH ----------------- */
export async function movePath(drive, src, dest) {
  await copyPath(drive, src, drive, dest);
  await deletePath(drive, src);
}

/* ----------------- EXPORT TO LOCAL ----------------- */
export async function exportToLocal(drive, srcPath, destDir) {
  srcPath = normDrivePath(srcPath);

  try {
    const buf = await drive.get(srcPath);
    if (buf !== undefined) {
      const out = path.join(destDir, srcPath.slice(1));
      await fs.mkdir(path.dirname(out), { recursive: true });
      await fs.writeFile(out, buf);
      return;
    }
  } catch {}

  for await (const entry of drive.list(srcPath, { recursive: true })) {
    if (!entry?.key) continue;
    const full = normDrivePath(entry.key);
    const rel = full.slice(srcPath === "/" ? 1 : srcPath.length + 1);
    const out = path.join(destDir, rel);
    const buf = await drive.get(full).catch(() => null);
    if (!buf) continue;
    await fs.mkdir(path.dirname(out), { recursive: true });
    await fs.writeFile(out, buf);
  }
}

/* ----------------- IMPORT FROM LOCAL ----------------- */
export async function importFromLocal(drive, localPath, drivePath = "/") {
  async function walk(dir, prefix = "") {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const abs = path.join(dir, e.name);
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      const target = normDrivePath(drivePath + "/" + rel);
      if (e.isDirectory()) {
        await createFolder(drive, target);
        await walk(abs, rel);
      } else if (e.isFile()) {
        const buf = await fs.readFile(abs);
        await drive.put(target, buf);
      }
    }
  }
  await fs.access(localPath);
  await walk(localPath);
}

/* ----------------- WRITE/READ FILE STREAM ----------------- */
export async function writeFileToDrive(drive, real, drivePath) {
  const rs = fsSync.createReadStream(real);
  const ws = drive.createWriteStream(drivePath);
  await pipeline(rs, ws);
}

export async function readFileFromDrive(drive, drivePath, local) {
  const rs = drive.createReadStream(drivePath);
  const ws = fsSync.createWriteStream(local);
  await pipeline(rs, ws);
}

/* ----------------- WALK LOCAL FILES ----------------- */
export async function walkLocalFiles(root) {
  const out = [];
  async function walk(dir, prefix = "") {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const abs = path.join(dir, e.name);
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) await walk(abs, rel);
      else if (e.isFile()) out.push("/" + rel.replace(/\\/g, "/"));
    }
  }
  await walk(root);
  return out;
}

/* ----------------- COMPACT DRIVE ----------------- */
export async function compactDrive(oldStore, oldDrive) {
  if (!oldStore || !oldDrive) throw new Error("compactDrive requires store + drive");
  const origPath = oldStore.storage?.path;
  if (!origPath) throw new Error("Original store path is undefined");

  const staging = await fs.mkdtemp(path.join(tmpdir(), "hd_stage_"));
  const tmpCompact = path.join(path.dirname(origPath), `compact_${Date.now()}`);

  try {
    await oldDrive.ready();
    await exportToLocal(oldDrive, "/", staging);
    const files = await walkLocalFiles(staging);

    try { await oldDrive.close(); } catch {}

    await fs.mkdir(tmpCompact, { recursive: true });
    const newStore = new Corestore(tmpCompact);
    const newDrive = new Hyperdrive(newStore, oldDrive.key);
    await newDrive.ready();

    for (const p of files) {
      const local = path.join(staging, p.slice(1));
      await writeFileToDrive(newDrive, local, p);
    }

    await newDrive.close();

    await fs.rm(origPath, { recursive: true, force: true });
    await fs.rename(tmpCompact, origPath);

    const finalStore = new Corestore(origPath);
    const finalDrive = new Hyperdrive(finalStore, oldDrive.key);
    await finalDrive.ready();
    return { store: finalStore, drive: finalDrive };
  } finally {
    await fs.rm(staging, { recursive: true, force: true }).catch(() => {});
    await fs.rm(tmpCompact, { recursive: true, force: true }).catch(() => {});
  }
}
