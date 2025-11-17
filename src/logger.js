import fs from "fs"
import path from "path"
import os from "os"
import { fileURLToPath } from "url"
import { DEFAULT_DRIVE_DIR } from "./constants.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Directory for logs (next to hyperdrive data)
const LOG_DIR = path.join(DEFAULT_DRIVE_DIR, ".logs")
const LOG_FILE = path.join(LOG_DIR, `${new Date().toISOString().split("T")[0]}.log`)

// Ensure directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true })
}

// Basic colored output for terminal
const colors = {
  reset: "\x1b[0m",
  gray: "\x1b[90m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
}

/**
 * Write a line to both console and file.
 * @param {"info"|"warn"|"error"|"debug"} level
 * @param {string} msg
 */
function log(level, msg) {
  const timestamp = new Date().toISOString()
  const formatted = `[${timestamp}] [${level.toUpperCase()}] ${msg}\n`
  fs.appendFileSync(LOG_FILE, formatted)

  let color
  switch (level) {
    case "info":
      color = colors.green
      break
    case "warn":
      color = colors.yellow
      break
    case "error":
      color = colors.red
      break
    case "debug":
      color = colors.cyan
      break
    default:
      color = colors.reset
  }

  process.stdout.write(`${color}${formatted}${colors.reset}`)
}

export const logger = {
  info: (msg) => log("info", msg),
  warn: (msg) => log("warn", msg),
  error: (msg) => log("error", msg),
  debug: (msg) => log("debug", msg),
  path: LOG_FILE,
  dir: LOG_DIR,
}
