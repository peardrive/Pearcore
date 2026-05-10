import os from 'os'
import path from 'path'

/**
 * Default logging level
 * use "debug" for more detailed logs which helps debugging
 * other options: info, warn, error
 */
export const PEARCORE_LOG_LEVEL = process.env.PEARCORE_LOG_LEVEL || "info"

/**
 * Default local storage path for PearDrive.
 * Uses platform-specific home directories:
 * - Windows: C:\Users\<user>\.pearcore
 * - macOS/Linux: /home/<user>/.pearcore
 */
export const DEFAULT_ACCOUNT_DIR = process.env.DEFAULT_ACCOUNT_DIR ||
  path.join(os.homedir(), '.pearcore')

/**
 * Bootstrap server host for initial node discovery.
 * Can be overridden with environment variable BOOTSTRAP_HOST.
 */
export const BOOTSTRAP_HOST = process.env.BOOTSTRAP_HOST || '0.0.0.0'

/**
 * Bootstrap server port.
 * Using parseInt ensures we get a number, not a string.
 */
export const BOOTSTRAP_PORT = parseInt(process.env.BOOTSTRAP_PORT || '49737', 10)

export const MAX_MESSAGE_THROTTLE = 5;        // seconds
export const MAX_RESPOND_SLEEP_TIME = 5000;   // ms