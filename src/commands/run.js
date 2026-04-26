import { startDaemon } from "../daemon.js"
import { DEFAULT_ACCOUNT_DIR, PEARCORE_LOG_LEVEL } from "../constants/global.js"


export const networkClientCommand = {
  command: "run",
  describe: "Start the pearDrive daemon server",
  builder: {
    port: {
      type: "number",
      default: 8787,
      describe: "Port for the WebSocket daemon server"
    },
    root: {
      type: "string",
      default: DEFAULT_ACCOUNT_DIR,
      describe: "Root path for account storage"
    },
    bootstrap: {
      type: "string",
      describe: "Optional DHT bootstrap address (host:port)"
    },
    username: {
      type: "string",
      describe: "Optional username for automatic login"
    },
    password: {
      type: "string",
      describe: "Optional password for automatic login"
    }
  },

  async handler(argv) {
    const { port, root, bootstrap } = argv

    console.log(`[CLI] Starting daemon on ws://127.0.0.1:${port} ...`)
    console.log(`[CLI] Log level set to "${PEARCORE_LOG_LEVEL}"`)

    if (bootstrap) {
      console.log(`[CLI] Using custom bootstrap: ${bootstrap}`)
    } else {
      console.log(`[CLI] No bootstrap provided (daemon will use defaults or none).`)
    }

    await startDaemon({
      port,
      rootPath: root,
      bootstrap: bootstrap || null,
      user:
        argv.username && argv.password
          ? { username: argv.username, password: argv.password }
          : null
    })
  }
} 