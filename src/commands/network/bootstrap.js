import { startBootstrapServer } from "../../services/bootstraper.service.js"
import {
  BOOTSTRAP_HOST,
  BOOTSTRAP_PORT,
} from "../../constants.js"

/**
 * CLI Command: Start a HyperDHT bootstrap server node
 *
 * This initializes a bootstrap node that allows peer discovery and coordination
 * for all connected HyperSwarm / HyperDHT clients.
 */
export const networkBootstrap = {
  command: "bootstrap",
  describe: "Start a HyperDHT bootstrap server node",
  builder: {
    port: {
      type: "number",
      default: BOOTSTRAP_PORT,
      describe: "Port to bind the DHT bootstrap server",
    },
    host: {
      type: "string",
      default: BOOTSTRAP_HOST,
      describe: "Host/IP address to bind",
    },
  },
  async handler(argv) {
    const { host, port } = argv
    console.log(`[CLI] Starting bootstrap server at ${host}:${port}...`)
    await startBootstrapServer({ host, port })
  },
}
