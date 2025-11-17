import sodium from 'libsodium-wrappers-sumo'
import bip39 from 'bip39'
import b4a from 'b4a'
import { createHash } from 'crypto'
import { DEFAULT_POW_BITS } from "../constants.js"

export async function ensureSodium() {
  await sodium.ready
}

/**
 * Convert hex string to Uint8Array
 * @param {string} hexStr
 * @returns {Uint8Array}
 */
export function hexToUint8(hexStr) {
  if (!hexStr || typeof hexStr !== 'string') return new Uint8Array()
  const clean = hexStr.startsWith('0x') ? hexStr.slice(2) : hexStr
  if (clean.length % 2 !== 0) throw new Error('Invalid hex string')
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16)
  }
  return bytes
}

/**
 * Convert a Uint8Array to hex string.
 * @param {Uint8Array} b
 * @returns {string}
 */
export function hex(b) {
  return b4a.toString(b, 'hex')
}

/**
 * Convert a hex string to Uint8Array.
 * @param {string} h
 * @returns {Uint8Array}
 */
export function fromHex(h) {
  return b4a.from(h, 'hex')
}

/**
 * Base64 encode/decode helpers.
 */
export const toBase64 = (u8) => b4a.toString(u8, 'base64')
export const fromBase64 = (s) => b4a.from(s, 'base64')

/**
 * Generate a new 12-word mnemonic.
 * @returns {string}
 */
export function generateMnemonic() {
  return bip39.generateMnemonic(128) // 128 bits entropy → 12 words
}

/**
 * Derive a 32-byte seed from a BIP39 mnemonic.
 * @param {string} mnemonic
 * @returns {Uint8Array}
 */
export function seedFromMnemonic(mnemonic) {
  if (!bip39.validateMnemonic(mnemonic)) throw new Error('Invalid mnemonic')
  const seed = bip39.mnemonicToSeedSync(mnemonic)
  return seed.slice(0, 32)
}

/**
 * Generate an Ed25519 keypair from a 32-byte seed.
 * @param {Uint8Array} seed32
 * @returns {{publicKey: Uint8Array, secretKey: Uint8Array}}
 */
export async function edKeyPairFromSeed(seed32) {
  await ensureSodium()
  const kp = sodium.crypto_sign_seed_keypair(seed32)
  return { publicKey: kp.publicKey, secretKey: kp.privateKey }
}

/**
 * Convert Ed25519 public key to X25519 (Curve25519) for encryption.
 * @param {Uint8Array} edPub
 * @returns {Uint8Array}
 */
export async function edPublicToCurve(edPub) {
  await ensureSodium()
  return sodium.crypto_sign_ed25519_pk_to_curve25519(edPub)
}

/**
 * Convert Ed25519 secret key to X25519 (Curve25519) for encryption.
 * @param {Uint8Array} edSecret
 * @returns {Uint8Array}
 */
export async function edSecretToCurve(edSecret) {
  await ensureSodium()
  return sodium.crypto_sign_ed25519_sk_to_curve25519(edSecret)
}

/**
 * Encrypt a message for a recipient using sender's Ed25519 keys.
 */
export async function encryptForRecipient({ senderEdSecretKey, senderEdPublicKey, recipientEdPublicKey, message }) {
  await ensureSodium()
  const senderCurveSk = await edSecretToCurve(senderEdSecretKey)
  const recipientCurvePk = await edPublicToCurve(recipientEdPublicKey)
  const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES)
  const signature = sodium.crypto_sign_detached(message, senderEdSecretKey)
  const ciphertext = sodium.crypto_box_easy(message, nonce, recipientCurvePk, senderCurveSk)
  return { senderEdPublicKey, nonce, ciphertext, signature }
}

/**
 * Decrypt a message from sender and verify signature.
 */
export async function decryptFromSender({ recipientEdSecretKey, senderEdPublicKey, nonce, ciphertext, signature }) {
  await ensureSodium()
  const recipientCurveSk = edSecretToCurve(recipientEdSecretKey)
  const senderCurvePk = edPublicToCurve(senderEdPublicKey)
  const plaintext = sodium.crypto_box_open_easy(ciphertext, nonce, senderCurvePk, recipientCurveSk)
  if (!plaintext) throw new Error('Decryption failed')
  const ok = sodium.crypto_sign_verify_detached(signature, plaintext, senderEdPublicKey)
  if (!ok) throw new Error('Signature verification failed')
  return plaintext
}

/**
 * Encrypt a JSON-serializable object with a symmetric key.
 */
export async function encryptJSON(key, data) {
  await ensureSodium()
  const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES)
  const plaintext = sodium.from_string(JSON.stringify(data))
  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(plaintext, null, null, nonce, key)
  return {
    nonce: toBase64(nonce),
    ciphertext: toBase64(ciphertext)
  }
}

/**
 * Decrypt a JSON object with symmetric key.
 */
export async function decryptJSON(key, encrypted) {
  await ensureSodium()
  const nonce = fromBase64(encrypted.nonce)
  const ciphertext = fromBase64(encrypted.ciphertext)
  const plaintext = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null, ciphertext, null, nonce, key)
  return JSON.parse(sodium.to_string(plaintext))
}

/**
 * Compute SHA-256 as Uint8Array.
 * @param {string|Uint8Array} input
 * @returns {Uint8Array}
 */
export function sha256(input) {
  const buf = typeof input === 'string' ? b4a.from(input) : input
  return b4a.from(createHash('sha256').update(buf).digest())
}

/**
 * Check if a hash has the given number of leading zero bits.
 */
export function hasLeadingZeroBits(buf, bits) {
  let bitsLeft = bits
  let i = 0
  while (bitsLeft > 0) {
    if (i >= buf.length) return false
    const byte = buf[i]
    if (bitsLeft >= 8) {
      if (byte !== 0) return false
      bitsLeft -= 8
      i++
      continue
    }
    const mask = 0xff << (8 - bitsLeft)
    return (byte & mask) === 0
  }
  return true
}

/**
 * Perform proof-of-work search for a payload.
 */
export async function findPoWNonce(payload, difficultyBits = DEFAULT_POW_BITS) {
  let nonce = 0
  while (true) {
    const h = createHash('sha256').update(payload + '|' + nonce).digest()
    if (hasLeadingZeroBits(h, difficultyBits)) return nonce.toString(16)
    nonce++
    if ((nonce & 0xffff) === 0) await new Promise(r => setImmediate(r))
  }
}

/**
 * Compute a canonical payload string for signing.
 */
export function canonicalPayload(username, meta, ts) {
  return `${normalizeUsername(username)}|${ts}|${JSON.stringify(meta || {})}`
}

/**
 * Normalize a username.
 */
export function normalizeUsername(s) {
  return String(s || '').trim().toLowerCase()
}

/**
 * Sign a payload with a user's Ed25519 secret key.
 */
export async function signUserPayload(secretEdSecret, payload, nonce) {
  await ensureSodium()
  const msgHash = sha256(payload + '|' + nonce)
  return sodium.crypto_sign_detached(msgHash, secretEdSecret)
}

/**
 * Verify a user's record (signature + PoW).
 */
export async function verifyUserRecord(rec, username, difficultyBits = DEFAULT_POW_BITS) {
  await ensureSodium()
  try {
    const normalized = normalizeUsername(username)
    const payload = canonicalPayload(normalized, rec.meta || {}, rec.ts)
    const powHash = createHash('sha256').update(payload + '|' + rec.pow).digest()
    if (!hasLeadingZeroBits(powHash, difficultyBits)) return false
    const msgHash = sha256(payload + '|' + rec.pow)
    const sig = fromHex(rec.sig)
    const pub = fromHex(rec.pubkey)
    return sodium.crypto_sign_verify_detached(sig, msgHash, pub)
  } catch {
    return false
  }
}

/**
 * Derive a symmetric key from password using Argon2id.
 */
export async function deriveKeyFromPassword(password, salt, keyLen = 32) {
  await ensureSodium()
  return sodium.crypto_pwhash(
    keyLen,
    password,
    salt,
    sodium.crypto_pwhash_OPSLIMIT_MODERATE,
    sodium.crypto_pwhash_MEMLIMIT_MODERATE,
    sodium.crypto_pwhash_ALG_ARGON2ID13
  )
}

/**
 * Generate a random salt for password-based key derivation.
 */
export async function randomSalt() {
  await ensureSodium()
  return sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES)
}