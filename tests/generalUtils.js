import WebSocket from 'ws'
import net from 'net'
import fs from 'fs';
import path from 'path'
import crypto from "crypto"
import fsSync from 'fs'

/**
 * Finds a random available TCP port on the local system.
 * @returns {Promise<number>} A free port number
 */
export function getRandomPort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer()
        server.unref()
        server.on('error', reject)

        server.listen(0, () => {
            const port = server.address().port
            server.close(() => resolve(port))
        })
    })
}

/**
 * Safely manages WebSocket clients and provides convenient helpers.
 */
export function createWSClient(url, clients = []) {
    const ws = new WebSocket(url)
    clients.push(ws)

    // Promise that resolves when ws is open
    const openPromise = new Promise((resolve, reject) => {
        const onError = (err) => { cleanup(); reject(err) }
        const onOpen = () => { ws.removeListener('error', onError); resolve() }

        ws.once('error', onError)
        ws.once('open', onOpen)

        const t = setTimeout(() => {
            ws.removeListener('open', onOpen)
            ws.removeListener('error', onError)
            cleanup()
            reject(new Error('WebSocket open timeout'))
        }, 3000)

        function cleanup() { clearTimeout(t) }
    })

    // Wait for a single message that satisfies the handler
    function waitForMessage(handler, timeout = 15000) {
        return new Promise((resolve, reject) => {
            const onMessage = (raw) => {
                try { handler(raw); cleanup(); resolve() }
                catch (err) { cleanup(); reject(err) }
            }
            const onError = (err) => { cleanup(); reject(err) }
            const onClose = () => { cleanup(); reject(new Error('WebSocket closed before message')) }

            ws.once('message', onMessage)
            ws.once('error', onError)
            ws.once('close', onClose)

            const timer = setTimeout(() => { cleanup(); reject(new Error('waitForMessage timeout')) }, timeout)

            function cleanup() {
                clearTimeout(timer)
                ws.removeListener('message', onMessage)
                ws.removeListener('error', onError)
                ws.removeListener('close', onClose)
            }
        })
    }

    return { ws, openPromise, waitForMessage }
}

/**
 * Safely closes all WebSocket clients
 */
export async function closeClients(clients = []) {
    for (const ws of clients) {
        try {
            if (ws && ws.readyState !== WebSocket.CLOSED) {
                try { ws.close() } catch (err) { console.warn('Error closing ws client (ignored):', err) }
                await new Promise(resolve => {
                    const timer = setTimeout(resolve, 500)
                    ws.once('close', () => { clearTimeout(timer); resolve() })
                })
            }
        } catch (err) {
            console.warn('Ignoring WebSocket error during cleanup', err)
        }
    }
}

/**
 * Safely closes a Node.js server instance
 */
export async function closeServer(server) {
    if (!server) return
    try {
        await new Promise((resolve, reject) => {
            server.close((err) => (err ? reject(err) : resolve()))
            setTimeout(resolve, 1000) // fallback timeout
        })
    } catch (err) {
        console.warn('Error closing server (ignored):', err)
    }
}

export async function sha256File(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256')
        const stream = fsSync.createReadStream(filePath)

        stream.on('data', d => hash.update(d))
        stream.on('error', reject)
        stream.on('end', () => resolve(hash.digest('hex')))
    })
}

export function getFolderSize(dirPath) {
  let total = 0
  const files = fsSync.readdirSync(dirPath, { withFileTypes: true })
  for (const file of files) {
    const fullPath = path.join(dirPath, file.name)
    if (file.isDirectory()) {
      total += getFolderSize(fullPath)
    } else if (file.isFile()) {
      total += fsSync.statSync(fullPath).size
    }
  }
  return total
}