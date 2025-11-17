import fs from 'fs/promises'
import { logger } from "../logger.js"


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

/**
 * Registers a graceful shutdown handler for SIGINT and SIGTERM.
 *
 * @param {string} name - Name for logging (e.g. "SWARM", "DHT")
 * @param {() => Promise<void>} onShutdown - Async function to call on shutdown
 */
export function registerGracefulShutdown(name, onShutdown) {
  const shutdown = async () => {
    logger.warn(`[${name}] Shutting down...`)
    try {
      await onShutdown()
    } catch (err) {
      logger.error(`[${name}] Error during shutdown:`, err?.message || err)
    } finally {
      process.exit(0)
    }
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}