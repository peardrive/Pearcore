import { BOOTSTRAP_HOST, BOOTSTRAP_PORT} from '../constants.js'
import { logger } from '../logger.js'
import { startDHTServer } from "../utils/network.utils.js"

/**
 * Starts a HyperDHT bootstrap node and a Hyperswarm node
 * that joins the default topic for logging peer joins.
 */
export async function startBootstrapServer({
  host = BOOTSTRAP_HOST,
  port = BOOTSTRAP_PORT,
} = {}) {
  logger.info(`[Bootstrap] Starting HyperDHT server at ${host}:${port}`)

  const dht = await startDHTServer({ host, port })
  logger.info(`[Bootstrap] DHT ready.`)

  dht.on('add-node', (node) => {
      logger.debug(`[DHT] Node joined: ${node.host}:${node.port}`)
  })

  dht.on('remove-node', (node) => {
      logger.debug(`[DHT] Node left: ${node.host}:${node.port}`)
  })

  dht.on('persistent', () => {
      logger.debug('[DHT] Promoted to persistent node (now routable)')
  })

  dht.on('nat-update', (publicHost, publicPort) => {
      logger.debug(`[DHT] NAT update → public ${publicHost}:${publicPort}`)
  })

  return dht
}