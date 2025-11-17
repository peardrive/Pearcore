// tests/utils/accounts.utils.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { createAccount, readAccountMeta, listAccountsWithMeta } from './src/utils/accounts.utils.js'

const TEST_ROOT = path.join('./test-accounts')

describe('Accounts Utils', () => {
  beforeEach(async () => {
    try { await fs.rm(TEST_ROOT, { recursive: true, force: true }) } catch {}
  })

  afterEach(async () => {
    try { await fs.rm(TEST_ROOT, { recursive: true, force: true }) } catch {}
  })

  it('should create a new account', async () => {
    const account = await createAccount('Alice', 'password123', TEST_ROOT)
    
    expect(account.username).toBe('alice') // normalized
    expect(account.mnemonic.split(' ').length).toBe(12)
    expect(account.publicKey).toBeDefined()

    // Check that credential file exists
    const credPath = path.join(account.path, 'credentials.enc.json')
    const metaPath = path.join(account.path, 'meta.json')
    await expect(fs.access(credPath)).resolves.not.toThrow()
    await expect(fs.access(metaPath)).resolves.not.toThrow()
  })

  it('should read account meta', async () => {
    const { path: accountPath, username, publicKey } = await createAccount('Bob', 'pwd', TEST_ROOT)
    const meta = await readAccountMeta(accountPath)
    expect(meta.username).toBe(username)
    expect(meta.publicKey).toBe(publicKey)
  })

  it('should list all accounts', async () => {
    const a1 = await createAccount('user1', 'pw1', TEST_ROOT)
    const a2 = await createAccount('user2', 'pw2', TEST_ROOT)
    
    const list = await listAccountsWithMeta(TEST_ROOT)
    expect(list.length).toBe(2)
    const usernames = list.map(a => a.username)
    expect(usernames).toContain('user1')
    expect(usernames).toContain('user2')
  })

  it('should throw error for duplicate username', async () => {
    await createAccount('Charlie', 'pw', TEST_ROOT)
    await expect(createAccount('charlie', 'pw2', TEST_ROOT)).rejects.toThrow('Account already exists')
  })

  it('should return null for invalid meta', async () => {
    const dir = path.join(TEST_ROOT, 'invalid')
    await fs.mkdir(dir, { recursive: true })
    const meta = await readAccountMeta(dir)
    expect(meta).toBeNull()
  })
})
