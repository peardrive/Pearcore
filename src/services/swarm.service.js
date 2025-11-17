import b4a from 'b4a'
import crypto from 'hypercore-crypto'
import { logger } from '../logger.js'
import { DEFAULT_TOPIC } from '../constants.js'
import { connectSwarm } from "../utils/network.utils.js"

/**
 * Starts a hyperswarm node for a given key pair and optional bootstrap
 * @param {object} opts
 * @param {Uint8Array} [opts.secretKey] Optional 32-byte secret key. If not provided, generates a new one.
 * @param {Uint8Array} [opts.publicKey] Optional public key (paired with secretKey)
 * @param {string} [opts.topic=DEFAULT_TOPIC] Topic to join
 * @param {string} [opts.bootstrapHost] Optional bootstrap host
 * @param {number} [opts.bootstrapPort] Optional bootstrap port
 * @returns {Promise<{ swarm: import('hyperswarm') }>} The active swarm instance
 */
export async function startSwarmNode({
  topic = DEFAULT_TOPIC,
  session,
  secretKey,
  publicKey,
  bootstrapHost,
  bootstrapPort,
} = {}) {
  try {
    // Generate key pair if not provided
    let keyPair
    if (secretKey && publicKey) {
      keyPair = { secretKey, publicKey }
    } else {
      const sk = secretKey || crypto.randomBytes(32)
      keyPair = crypto.keyPair(sk)
    }

    const username = session?.getCredentials()?.username || '<unknown>'
    const publicKeyHex = b4a.toString(keyPair.publicKey, 'hex')

    logger.info(
      `[Swarm] Joined topic: "${topic}" | username: ${username} | publicKey: ${publicKeyHex}` +
      (bootstrapHost && bootstrapPort ? ` | bootstrap: ${bootstrapHost}:${bootstrapPort}` : '')
    )

    // Only include bootstrap if provided
    const swarmOpts = { keyPair, topic }
    if (bootstrapHost && bootstrapPort) {
      swarmOpts.bootstrapHost = bootstrapHost
      swarmOpts.bootstrapPort = bootstrapPort
    }

    const swarm = await connectSwarm(swarmOpts)
    logger.info(`[Swarm] Joined topic: "${topic}"`)

    // Provide a destroy method without exiting process
    swarm.shutdown = async () => {
      logger.info('[Swarm] Shutting down swarm...')
      try { await swarm.destroy() } catch (err) { logger.error('Error destroying swarm:', err) }
    }

    return { swarm }
  } catch (err) {
    logger.error('Failed to start swarm node:', err)
    throw err
  }
}
