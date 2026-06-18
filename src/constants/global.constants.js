import os from 'os';
import path from 'path';

export const DEFAULT_CHUNK_SIZE = 256 * 1024; // 256KB

/**
 * Default logging level
 * use "debug" for more detailed logs which helps debugging
 * other options: info, warn, error
 */
export const PEARCORE_LOG_LEVEL = process.env.PEARCORE_LOG_LEVEL || "info";

/**
 * Default local storage path for PearDrive.
 * Uses platform-specific home directories:
 * - Windows: C:\Users\<user>\.pearcore
 * - macOS/Linux: /home/<user>/.pearcore
 */
export const DEFAULT_ACCOUNT_DIR = process.env.DEFAULT_ACCOUNT_DIR ||
  path.join(os.homedir(), '.pearcore');