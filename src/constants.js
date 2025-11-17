import os from 'os'
import path from 'path'

/**
 * Maximum number of peers to connect to in the network.
 * Limits simultaneous connections to avoid excessive resource usage.
 */
export const MAX_PEERS = 64

/**
 * Default topic used for peer discovery.
 * Can be used with Hyperswarm or other DHT networks to group nodes.
 */
export const DEFAULT_TOPIC = 'PearDrive0000000000000'

/**
 * Bootstrap server host for initial node discovery.
 * Can be overridden with environment variable BOOTSTRAP_HOST.
 */
export const BOOTSTRAP_HOST = process.env.BOOTSTRAP_HOST || '0.0.0.0'

/**
 * Bootstrap server port.
 * Using parseInt ensures we get a number, not a string.
 * The second argument `10` enforces base-10 parsing, avoiding issues if someone uses a value with a leading zero.
 */
export const BOOTSTRAP_PORT = parseInt(process.env.BOOTSTRAP_PORT || '49737', 10)

/**
 * Default local storage path for Hyperdrive/Corestore.
 * Uses platform-specific home directories:
 * - Windows: C:\Users\<user>\prototype-drive
 * - macOS/Linux: /home/<user>/prototype-drive
 * Can be overridden by setting a custom path in the environment variable or configuration.
 */
export const DEFAULT_DRIVE_DIR = process.env.DEFAULT_DRIVE_DIR ||
  path.join(os.homedir(), 'prototype-drive')

/*
 * A empty file to add directory support to Hyperdrive
 */
export const INIT_FILE = "__INIT__.txt"

export const ACCOUNTS_ROOT = path.join(DEFAULT_DRIVE_DIR, 'accounts')

// difficulty; tune between 16-26 typically
export const DEFAULT_POW_BITS = 20 

// Default database name for user storage in Hyperbee system
export const DEFAULT_USER_STORAGE_KEY = "UserStorage"
