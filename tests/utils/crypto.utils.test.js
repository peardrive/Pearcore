import { describe, it, expect } from 'vitest'
import * as cryptoUtils from '../../src/utils/crypto.utils.js'

describe('Crypto Utils', () => {

  it('hex ↔ Uint8Array conversions', () => {
    const u8 = new Uint8Array([1, 2, 3, 255])
    const h = cryptoUtils.hex(u8)
    expect(h).toBe('010203ff')
    const u8Again = cryptoUtils.fromHex(h)
    expect(Array.from(u8Again)).toEqual(Array.from(u8))
    const u8FromHex = cryptoUtils.hexToUint8('010203ff')
    expect(Array.from(u8FromHex)).toEqual(Array.from(u8))
  })

  it('base64 encode/decode', () => {
    const u8 = new Uint8Array([10, 20, 30])
    const b64 = cryptoUtils.toBase64(u8)
    const u8Again = cryptoUtils.fromBase64(b64)
    expect(Array.from(u8Again)).toEqual(Array.from(u8))
  })

  it('mnemonic generation and seed', () => {
    const mnemonic = cryptoUtils.generateMnemonic()
    expect(typeof mnemonic).toBe('string')
    const seed = cryptoUtils.seedFromMnemonic(mnemonic)
    expect(seed.length).toBe(32)
  })

  it('ed25519 keypair generation', async () => {
    const seed = cryptoUtils.seedFromMnemonic(cryptoUtils.generateMnemonic())
    const { publicKey, secretKey } = await cryptoUtils.edKeyPairFromSeed(seed)
    expect(publicKey.length).toBe(32)
    expect(secretKey.length).toBe(64)
  })

  it('symmetric encrypt/decrypt JSON', async () => {
    const salt = await cryptoUtils.randomSalt()
    const key = await cryptoUtils.deriveKeyFromPassword('pass123', salt)
    const obj = { hello: 'world', num: 42 }
    const encrypted = await cryptoUtils.encryptJSON(key, obj)
    const decrypted = await cryptoUtils.decryptJSON(key, encrypted)
    expect(decrypted).toEqual(obj)
  })

  it('password-based key derivation', async () => {
    const salt = await cryptoUtils.randomSalt()
    const key = await cryptoUtils.deriveKeyFromPassword('password', salt)
    expect(key.length).toBe(32)
  })

  it('SHA256 hashing', () => {
    const hash = cryptoUtils.sha256('hello')
    expect(hash.length).toBe(32)
  })
})
