import { logger } from "./logger.js"
import WebSocket, { WebSocketServer } from 'ws'
import { createRouter } from './rpc/router.js'
import { createCore } from './core.js'

// rpc register handlers
import { registerAccountHandlers } from './rpc/accounts.handler.js'
import { registerSpaceHandlers } from "./rpc/space.handler.js"
import { registerProfileHandlers } from "./rpc/profile.handler.js"
import { registerMessageHandlers } from "./rpc/messages.handler.js"


/**
 * Start the daemon WebSocket server with RPC routing and optional
 *
 * @param {object} options
 * @param {number} [options.port=8787]
 *        Port to bind the WebSocket server.
 *
 * @param {string} [options.root_path]
 *        Optional root path for account storage. If provided, it is stored
 *        in the session instance.
 *
 * @param {string|object} [options.bootstrap]
 *        Optional bootstrap peer configuration. Accepts either:
 *          – a string: "host:port"
 *          – an object: { host, port }
 *        When set, the bootstrap address is applied to the session.
 * 
 * @param {object} [options.user]
 *        Optional user credential (username/password) configuration.
 *        When set, the session automatically logins into the account. 
 *
 * @returns {Promise<WebSocketServer>}
 *          Resolves with the WebSocketServer instance once successfully
 *          bound and listening. Rejects if the port is in use or if any
 *          WebSocket binding error occurs during startup.
 */
export async function startDaemon({
  port = 8787,
  rootPath = DEFAULT_ACCOUNT_DIR,
  bootstrap = null,
  user = null,
} = {}) {

  const core = await createCore({
    rootPath: rootPath,
    bootstrap: bootstrap,
    user: user 
  })

  // RPC commands router
  const router = createRouter()

  // register account-related RPC handlers
  registerAccountHandlers(router, core)
  // register space-related RPC handlers
  registerSpaceHandlers(router, core)
  // register profile-related RPC handlers
  registerProfileHandlers(router, core)
  // register p2p message-related RPC handler
  registerMessageHandlers(router, core)

  // start WebSocket server
  const wss = await new Promise((resolve, reject) => {
    const server = new WebSocketServer({ port, host: '127.0.0.1' })

    server.once('listening', () => resolve(server))

    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`[daemon] Port ${port} is already in use`)
      } else {
        logger.error(`[daemon] WebSocket server error: ${err.message}`)
      }
      reject(err)
    })
  })

  // websocket connection handler
  wss.on('connection', (ws) => {
    ws.on('message', async (raw) => {
      let msg
      try {
        msg = JSON.parse(raw)
      } catch {
        return ws.send(JSON.stringify({ error: 'invalid json' }))
      }

      // link incoming message to RPC router
      const reply = await router.dispatch(msg, { ws })
      ws.send(JSON.stringify(reply))
    })
  })

  // websocket server runtime error handler
  wss.on('error', (err) => {
    logger.error(`[daemon] WebSocket runtime error: ${err.message}`)
  })

  logger.info(
    `daemon listening on ws://127.0.0.1:${port}` +
    (rootPath ? ` [root=${rootPath}]` : '') +
    (bootstrap ? ` [bootstrap=[${bootstrap}]` : '[bootstrap=[default]')
  )

  return wss
}
