import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import { startDaemon } from '../src/daemon.js'
import { createWSClient, closeClients, closeServer, getRandomPort } from './generalUtils.js'

let PORT;
let server = null
const clients = []

describe('Daemon Service', () => {
  beforeAll(async () => {
    try {
      PORT = await getRandomPort()
      server = await startDaemon({ port: PORT })
    } catch (err) {
      console.error('Failed to start daemon in beforeAll:', err)
      throw err
    }
  })

  afterAll(async () => {
    try {
      await closeClients(clients)
    } catch (err) {
      console.warn('Error closing clients:', err)
    }

    try {
      await closeServer(server)
    } catch (err) {
      console.warn('Error closing server:', err)
    }

    server = null
  }, 15000)

  it('responds to a test', async () => {
    const { ws, openPromise, waitForMessage } = createWSClient(`ws://127.0.0.1:${PORT}`, clients)
    try {
      await openPromise

      ws.send(JSON.stringify({ id: 1, method: 'ping', params: {} }))

      await waitForMessage((raw) => {
        try {
          const data = JSON.parse(raw.toString())
          expect(data).toBeDefined()
        } catch (err) {
          console.error('Error parsing message or asserting:', err)
          throw err
        }
      })
    } catch (err) {
      console.error('Test failed:', err)
      throw err
    } finally {
      try {
        if (ws && ws.readyState !== ws.CLOSED) ws.close()
      } catch (err) {
        console.warn('Error closing WebSocket:', err)
      }
    }
  }, 15000) // optional timeout per test
})
