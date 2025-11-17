// tests/accounts.daemon.test.js
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { startDaemon } from '../../src/daemon.js'
import { createWSClient, closeClients, closeServer, getRandomPort } from '../generalUtils.js'
import { ensureDir } from '../../src/utils/system.utils.js'

let PORT;
let server = null
const clients = []

// Temporary root for accounts
let tempRoot = null

describe('Daemon Account Handlers', () => {
  beforeAll(async () => {
    PORT = await getRandomPort()
    // create random temp directory
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'daemon-test-'))
    await ensureDir(tempRoot)

    try {
      server = await startDaemon({ port: PORT, root_path: tempRoot })
    } catch (err) {
      console.error('Failed to start daemon in beforeAll:', err)
      throw err
    }
  }, 15000)

  afterAll(async () => {
    await closeClients(clients)
    await closeServer(server)
    server = null

    // remove temp directory recursively
    if (tempRoot) {
      try {
        await fs.rm(tempRoot, { recursive: true, force: true })
      } catch (err) {
        console.warn('Failed to remove temp root:', err)
      }
      tempRoot = null
    }
  }, 15000)

  it('should require login if no account is authenticated', async () => {
    const { ws, openPromise, waitForMessage } = createWSClient(`ws://127.0.0.1:${PORT}`, clients)
    try {
      await openPromise
      ws.send(JSON.stringify({ id: 1, method: 'accounts.state' }))

      await waitForMessage((raw) => {
        const data = JSON.parse(raw.toString())
        expect(data.result.state).toBe('login required')
      })
    } finally {
      ws.close()
    }
  })

  it('should create a new account', async () => {
    const { ws, openPromise, waitForMessage } = createWSClient(`ws://127.0.0.1:${PORT}`, clients)
    const username = `testuser_${Date.now()}_${Math.floor(Math.random() * 1000)}`
    const password = 'secret'
    try {
      await openPromise
      ws.send(JSON.stringify({ id: 2, method: 'accounts.create', params: { username, password } }))

      await waitForMessage((raw) => {
        const data = JSON.parse(raw.toString())
        expect(data.result.ok).toBe(true)
        expect(data.result.account.username).toBe(username)
      })
    } finally {
      ws.close()
    }
  })

  it('should list all accounts', async () => {
    const { ws, openPromise, waitForMessage } = createWSClient(`ws://127.0.0.1:${PORT}`, clients)
    try {
      await openPromise
      ws.send(JSON.stringify({ id: 3, method: 'accounts.list' }))

      await waitForMessage((raw) => {
        const data = JSON.parse(raw.toString())
        expect(data.result.ok).toBe(true)
        expect(Array.isArray(data.result.accounts)).toBe(true)
      })
    } finally {
      ws.close()
    }
  })

  it('should login successfully and return publicKey', async () => {
    const { ws, openPromise, waitForMessage } = createWSClient(`ws://127.0.0.1:${PORT}`, clients)
    const username = 'testuser'
    const password = 'secret'
    try {
      await openPromise
      ws.send(JSON.stringify({ id: 4, method: 'auth.login', params: { username, password } }))

      await waitForMessage((raw) => {
        const data = JSON.parse(raw.toString())
        expect(data.result.ok).toBe(true)
        expect(typeof data.result.publicKey).toBe('string')
      })
    } finally {
      ws.close()
    }
  })

  it('should fail login with wrong credentials', async () => {
    const { ws, openPromise, waitForMessage } = createWSClient(`ws://127.0.0.1:${PORT}`, clients)
    try {
      await openPromise
      ws.send(JSON.stringify({ id: 5, method: 'auth.login', params: { username: 'testuser', password: 'wrong' } }))

      await waitForMessage((raw) => {
        const data = JSON.parse(raw.toString())
        expect(data.result.ok).toBe(false)
        expect(data.result.error).toBe('Invalid username or password')
      })
    } finally {
      ws.close()
    }
  })

  it('should return authenticated state after login', async () => {
    const { ws, openPromise, waitForMessage } = createWSClient(`ws://127.0.0.1:${PORT}`, clients)
    const username = 'testuser'
    const password = 'secret'
    try {
      await openPromise
      ws.send(JSON.stringify({ id: 6, method: 'auth.login', params: { username, password } }))
      await waitForMessage(() => {}) // discard login response

      ws.send(JSON.stringify({ id: 7, method: 'accounts.state' }))
      await waitForMessage((raw) => {
        const data = JSON.parse(raw.toString())
        expect(data.result.state).toBe('authenticated')
        expect(data.result.username).toBe(username)
        expect(typeof data.result.publicKey).toBe('string')
      })
    } finally {
      ws.close()
    }
  })

  it('should logout successfully', async () => {
    const { ws, openPromise, waitForMessage } = createWSClient(`ws://127.0.0.1:${PORT}`, clients)
    try {
      await openPromise
      ws.send(JSON.stringify({ id: 8, method: 'auth.logout' }))
      await waitForMessage((raw) => {
        const data = JSON.parse(raw.toString())
        expect(data.result.ok).toBe(true)
      })

      ws.send(JSON.stringify({ id: 9, method: 'accounts.state' }))
      await waitForMessage((raw) => {
        const data = JSON.parse(raw.toString())
        expect(data.result.state).toBe('login required')
      })
    } finally {
      ws.close()
    }
  })
})
