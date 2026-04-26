import fs from 'fs'
import path from 'path'
import { accountBaseDir } from './accounts.utils.js'
import { DEFAULT_ACCOUNT_DIR } from '../constants.js'

/**
 * Path to the user's drive directory: {root}/{username}/drive
 */
export function accountDriveDir(username, root = DEFAULT_ACCOUNT_DIR) {
  return path.join(accountBaseDir(username, root), 'drive')
}

/**
 * Internal helper: safely resolve a drive path.
 * Returns:
 *   - absolute path (string)
 *   - undefined if invalid (missing username/relativePath, path traversal)
 */
function _resolveDrivePathSafe(username, relativePath, root = DEFAULT_ACCOUNT_DIR) {
  if (!username || typeof username !== 'string') return undefined
  if (!relativePath || typeof relativePath !== 'string') return undefined

  const driveDir = path.resolve(accountDriveDir(username, root))
  const driveDirWithSep = driveDir.endsWith(path.sep) ? driveDir : driveDir + path.sep
  const absPath = path.resolve(driveDir, relativePath)

  // Path escapes the drive directory → invalid
  if (!absPath.startsWith(driveDirWithSep) && absPath !== driveDir) {
    return undefined
  }

  return absPath
}

/**
 * Ensure a path exists inside the drive.
 * Returns:
 *   - absolute path if exists
 *   - undefined if nonexistent or invalid
 */
export function ensureDrivePathExists(username, relativePath, root = DEFAULT_ACCOUNT_DIR) {
  const absPath = _resolveDrivePathSafe(username, relativePath, root)
  if (!absPath) return undefined
  if (!fs.existsSync(absPath)) return undefined
  return absPath
}

/**
 * Ensure the parent directory for the given relative path exists.
 * Returns:
 *   - absolute parent directory path (after ensuring)
 *   - undefined if invalid path (path traversal, invalid input)
 */
export function ensureDriveParentExists(username, relativePath, root = DEFAULT_ACCOUNT_DIR) {
  const absPath = _resolveDrivePathSafe(username, relativePath, root)
  if (!absPath) return undefined

  const parentDir = path.dirname(absPath)
  fs.mkdirSync(parentDir, { recursive: true })
  return parentDir
}
