import path from 'path'
import fs from 'fs/promises'
import { 
  listAccountsWithMeta, 
  createAccount as utilCreateAccount, 
  readAccountMeta 
} from '../utils/accounts.utils.js'
import { deriveKeyFromPassword, decryptJSON, hexToUint8 } from '../utils/crypto.utils.js'
import { ACCOUNTS_ROOT } from '../constants.js'
import b4a from 'b4a'

/**
 * List all accounts under the specified root path.
 * @param {string} [root=ACCOUNTS_ROOT] - Optional base path for accounts
 * @returns {Promise<Array>} - Array of accounts with metadata
 */
export async function listAccounts(root = ACCOUNTS_ROOT) {
  return listAccountsWithMeta(root)
}

/**
 * Create a new account at the specified root path.
 * @param {string} username 
 * @param {string} password 
 * @param {string} [root=ACCOUNTS_ROOT] - Optional base path for account storage
 * @returns {Promise<Object>} - Newly created account info
 */
export async function createAccount(username, password, root = ACCOUNTS_ROOT) {
  return utilCreateAccount(username, password, root)
}

/**
 * Resolve the account directory path for a username under the specified root.
 * @param {string} username 
 * @param {string} [root=ACCOUNTS_ROOT]
 * @returns {string} - Full path to account folder
 */
async function accountDir(username, root = ACCOUNTS_ROOT) {
  return path.join(root, username.trim().toLowerCase())
}

/**
 * Get metadata for a specific account.
 * @param {string} username 
 * @param {string} [root=ACCOUNTS_ROOT]
 * @returns {Promise<Object>} - Metadata of the account including path
 */
export async function getAccountMeta(username, root = ACCOUNTS_ROOT) {
  const dir = await accountDir(username, root)
  const meta = await readAccountMeta(dir)
  if (!meta) throw new Error('Invalid account')
  return { ...meta, path: dir }
}

/**
 * Authenticate user credentials.
 * @param {string} username 
 * @param {string} password 
 * @param {string} [root=ACCOUNTS_ROOT]
 * @returns {Promise<Object>} - Object containing username, publicKey, secretKey, and path
 */
export async function authenticate(username, password, root = ACCOUNTS_ROOT) {
  const dir = await accountDir(username, root)
  const credPath = path.join(dir, 'credentials.enc.json')
  const raw = await fs.readFile(credPath, 'utf8')
  const enc = JSON.parse(raw)
  const salt = b4a.from(enc.salt, 'base64')
  const key = await deriveKeyFromPassword(password, salt)
  const creds = await decryptJSON(key, enc) // throws on bad password
  return {
    username: creds.username,
    publicKey: hexToUint8(creds.publicKey),
    secretKey: hexToUint8(creds.secretKey),
    path: dir
  }
}
