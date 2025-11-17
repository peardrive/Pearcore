import fs from 'fs/promises'
import path from 'path'
import b4a from 'b4a'
import { ensureDir, listSubdirs } from './system.utils.js'
import { ACCOUNTS_ROOT } from "../constants.js"
import { 
  generateMnemonic, 
  seedFromMnemonic, 
  edKeyPairFromSeed, 
  deriveKeyFromPassword, 
  encryptJSON, 
  randomSalt, 
  hex 
} from './crypto.utils.js'

/**
 * Read and validate account metadata from a given directory.
 * Ensures the account has a valid meta.json file with username and publicKey.
 *
 * @param {string} dirPath - Path to the account directory.
 * @returns {Promise<object|null>} Parsed metadata object if valid, otherwise null.
 */
export async function readAccountMeta(dirPath) {
  try {
    const metaPath = path.join(dirPath, 'meta.json')
    const data = await fs.readFile(metaPath, 'utf-8')
    const meta = JSON.parse(data)

    if (!meta.username || !meta.publicKey) throw new Error('Invalid meta')
    return meta
  } catch (err) {
    return null
  }
}

/**
 * Scan the accounts root directory for valid account folders.
 * Returns an array of account metadata objects with their absolute paths.
 *
 * @param {string} [rootPath=ACCOUNTS_ROOT] - Root path containing all account directories.
 * @returns {Promise<Array<{username: string, publicKey: string, createdAt?: number, path: string}>>}
 */
export async function listAccountsWithMeta(rootPath = ACCOUNTS_ROOT) {
  await ensureDir(rootPath)
  const dirs = await listSubdirs(rootPath)
  const results = []

  for (const dir of dirs) {
    const fullPath = path.join(rootPath, dir)
    const meta = await readAccountMeta(fullPath)
    if (meta) {
      results.push({ ...meta, path: fullPath })
    }
  }

  return results
}

/**
 * Create a new password-protected account.
 * Generates a mnemonic, derives keys, encrypts credentials, and saves metadata.
 *
 * @param {string} username - Local account name.
 * @param {string} password - User password for encrypting credentials.
 * @param {string} [rootPath=ACCOUNTS_ROOT] - Root directory for storing accounts.
 * @returns {Promise<{username: string, mnemonic: string, publicKey: string, path: string}>}
 */
export async function createAccount(username, password, rootPath = ACCOUNTS_ROOT) {
  username = username.trim().toLowerCase()
  if (!username) throw new Error('Username required')

  await ensureDir(rootPath)
  const dirs = await listSubdirs(rootPath)
  if (dirs.includes(username)) throw new Error('Account already exists')

  const userDir = path.join(rootPath, username)
  await ensureDir(userDir)

  const mnemonic = generateMnemonic()
  const seed = seedFromMnemonic(mnemonic)
  const { publicKey, secretKey } = await edKeyPairFromSeed(seed)

  const salt = await randomSalt()
  const key = await deriveKeyFromPassword(password, salt)

  const credentials = {
    username,
    publicKey: hex(publicKey),
    secretKey: hex(secretKey)
  }
  
  const encrypted = encryptJSON(key, credentials)
  encrypted.salt = b4a.toString(salt, 'base64')

  await fs.writeFile(path.join(userDir, 'credentials.enc.json'), JSON.stringify(encrypted, null, 2))

  const meta = {
    username,
    publicKey: hex(publicKey),
    createdAt: Date.now()
  }
  await fs.writeFile(path.join(userDir, 'meta.json'), JSON.stringify(meta, null, 2))

  return {
    username,
    mnemonic,
    publicKey: hex(publicKey),
    path: userDir
  }
}
