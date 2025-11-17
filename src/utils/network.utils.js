import crypto from 'hypercore-crypto'
import { createHash } from 'crypto'

import HyperDHT from 'hyperdht'
import Hyperswarm from 'hyperswarm'
import Hyperdrive from 'hyperdrive'
import Corestore from 'corestore'
import { Buffer } from 'buffer'
import { logger } from "../logger.js"
import { BOOTSTRAP_HOST, BOOTSTRAP_PORT, DEFAULT_TOPIC } from '../constants.js'
import { registerGracefulShutdown } from "./system.utils.js"


/**
 * Start a HyperDHT node with selectable operating mode.
 * @param {Object} opts
 * @param {string} [opts.host=BOOTSTRAP_HOST] - Interface to bind the DHT node to
 * @param {number} [opts.port=BOOTSTRAP_PORT] - UDP port to listen on
 * @returns {Promise<HyperDHT>} Resolves when the DHT node is fully ready
 */
export async function startDHTServer({ host = BOOTSTRAP_HOST, port = BOOTSTRAP_PORT } = {}) {
    const opts = { host, port }

    const dht = new HyperDHT(opts)
    await dht.ready()

    const keyHex = dht?.defaultKeyPair?.publicKey?.toString('hex') || '(none)'
    const bootstraperNodes = dht.bootstrapNodes.map(({host, port}) => host)
    logger.info(`[DHT] Listening at ${host}:${port}`)
    logger.info(`[DHT] Public key: ${keyHex}`)
    logger.info(`[DHT] Bootstrap: ${JSON.stringify(bootstraperNodes)}\n`)

    registerGracefulShutdown("DHT", async () => {
        await dht.destroy()
    })

    return dht
}

/**
 * Connect to a Hyperswarm topic.
 *
 * If a bootstrap host/port is provided, connects using that DHT bootstrap.
 * Otherwise, it connects using the default public bootstrap configuration.
 *
 * @param {Object} opts
 * @param {string} [opts.topic=DEFAULT_TOPIC] - Topic string used to derive the discovery key
 * @param {string} [opts.bootstrapHost] - Optional bootstrap host (e.g., '127.0.0.1')
 * @param {number} [opts.bootstrapPort] - Optional bootstrap port (e.g., 49737)
 * @returns {Promise<Hyperswarm>} The connected swarm instance
 */
export async function connectSwarm({
  keyPair,  // optional: { publicKey, secretKey } to maintain identity
  topic = DEFAULT_TOPIC,
  bootstrapHost,
  bootstrapPort
} = {}) {
  // create discovery key from topic
  const topicBuffer = crypto.discoveryKey(
    createHash('sha256').update(topic).digest()
  )

  // setup bootstrap if provided
  const bootstrap = (bootstrapHost && bootstrapPort)
    ? [{ host: bootstrapHost, port: Number(bootstrapPort) }]
    : undefined

  // create swarm with optional key pair and bootstrap
  const swarm = new Hyperswarm({ keyPair, bootstrap })

  // join topic for announce + lookup
  const discovery = swarm.join(topicBuffer, { announce: true, lookup: true })
  if (discovery?.flushed) await discovery.flushed()

  const bootstrapLog = bootstrap ? `via ${bootstrapHost}:${bootstrapPort}` : '(default bootstrap)'
  logger.info(`[SWARM] Joined topic "${topic}" ${bootstrapLog}`)
  logger.info(`[SWARM] Public key (hex): ${keyPair ? keyPair.publicKey.toString('hex') : '<ephemeral>'}`)

  // register shutdown
  registerGracefulShutdown('SWARM', async () => {
    logger.info('[SWARM] Shutting down...')
    await swarm.destroy()
  })

  return swarm
}

/**
 * Encode a file path as base64 for share links.
 * Generates a peardrive://<nodePubKey>:<encodedFilePath> link.
 * @param {string} nodePubKey - Public key of the node sharing the drive.
 * @param {string} filePath - Path inside the Hyperdrive to share.
 * @returns {string} - Share link.
 */
export function createShareLink(nodePubKey, filePath) {
    const encoded = Buffer.from(filePath).toString('base64url')
    return `peardrive://${nodePubKey}:${encoded}`
}

/**
 * Parse a share link, validate it, and connect to the remote Hyperdrive.
 * Requires an existing Corestore instance.
 * @param {Corestore} store - Local Corestore to attach the remote drive to.
 * @param {string} shareLink - peardrive://<pubkey>:<encodedPath>
 * @returns {Promise<{drive: Hyperdrive, path: string}>} - Hyperdrive instance and decoded path.
 */
export async function connectFromShareLink(store, shareLink) {
    if (!shareLink.startsWith('peardrive://')) {
        throw new Error('Invalid share link')
    }

    const stripped = shareLink.replace('peardrive://', '')
    const [pubkey, encodedPath] = stripped.split(':')
    if (!pubkey || !encodedPath) {
        throw new Error('Malformed share link')
    }

    const filePath = Buffer.from(encodedPath, 'base64url').toString('utf8')
    const drive = new Hyperdrive(store, pubkey)
    await drive.ready()

    console.log(`🔗 Connected to remote drive: ${pubkey}`)
    return { drive, path: filePath }
}
