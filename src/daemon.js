import WebSocket, { WebSocketServer } from 'ws'
import { createRouter } from './rpc/router.js'
import { registerAccountHandlers } from './rpc/accounts.handler.js'
import * as accounts from './services/accounts.service.js'
import * as swarm from './services/swarm.service.js'
import { createSession } from './services/session.service.js'
import { logger } from "./logger.js"
import { ACCOUNTS_ROOT } from "./constants.js"

/**
 * Start the daemon server.
 * @param {object} options
 * @param {number} [options.port=8787] - Port to bind the WebSocket server
 * @param {string} [options.root_path] - Optional root path for accounts
 * @returns {Promise<WebSocketServer>} - WebSocket server instance
 */
export async function startDaemon({ port = 8787, root_path = ACCOUNTS_ROOT } = {}) {
  const session = createSession()
  if (root_path) session.setRootPath(root_path)

  const router = createRouter()
  registerAccountHandlers(router, { accounts, session, swarm })

  const wss = new WebSocketServer({ port, host: '127.0.0.1' })
  wss.on('connection', (ws) => {
    ws.on('message', async (raw) => {
      let msg
      try {
        msg = JSON.parse(raw)
      } catch {
        return ws.send(JSON.stringify({ error: 'invalid json' }))
      }

      const reply = await router.dispatch(msg, { session, ws })
      ws.send(JSON.stringify(reply))
    })
  })

  logger.info(`daemon listening on ws://127.0.0.1:${port}${root_path ? ' [root=' + root_path + ']' : ''}`)
  return wss
}
