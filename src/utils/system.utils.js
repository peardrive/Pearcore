import path from "path";
import fs from 'fs/promises'

export const pathJoin = (...paths) => path.join(...paths)

/**
 * Check if a file or directory exists
 * @param {string} path - The path to check
 * @returns {boolean} - True if exists, false if not
 */
export async function fileExists(path) {
    try {
        await fs.access(path);
        return true;
    } catch (error) {
        if (error.code === 'ENOENT') {
            return false;
        }
        throw error;
    }
}

/**
 * Read a file with specified encoding
 * @param {string} filePath - Path to the file
 * @param {string} encoding - Encoding (default: 'utf8')
 * @returns {Promise<string|Buffer>} File content
 */
export async function readFile(filePath, encoding = 'utf8') {
    try {
        const content = await fs.readFile(filePath, encoding);
        return content;
    } catch (error) {
        if (error.code === 'ENOENT') {
            throw new Error(`File not found: ${filePath}`);
        }
        throw new Error(`Failed to read file ${filePath}: ${error.message}`);
    }
}

export async function createDirectory() {

}

/**
 * Ensure a directory exists, creating it recursively if needed.
 * @param {string} dirPath
 */
export async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true })
  } catch (err) {
    if (err.code !== 'EEXIST') throw err
  }
}

/**
 * List all subdirectories (accounts) inside a given root directory.
 * @param {string} rootPath
 * @returns {Promise<string[]>} Array of directory names
 */
export async function listSubdirs(rootPath) {
  try {
    const entries = await fs.readdir(rootPath, { withFileTypes: true })
    return entries.filter(e => e.isDirectory()).map(e => e.name)
  } catch {
    return []
  }
}

export async function getFileSize(filePath) {
  const stat = await fs.stat(filePath);
  return stat.size;
}

/**
 * Registers a graceful shutdown handler for SIGINT and SIGTERM.
 *
 * @param {string} name - Name for logging (e.g. "network.utils", "DHT")
 * @param {() => Promise<void>} onShutdown - Async function to call on shutdown
 */
export function registerGracefulShutdown(name, onShutdown) {
  const shutdown = async () => {
    console.warn(`[${name}] Shutting down...`)
    try {
      await onShutdown()
    } catch (err) {
      console.error(`[${name}] Error during shutdown:`, err?.message || err)
    } finally {
      process.exit(0)
    }
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}