import { startBootstrapServer } from "../../services/bootstraper.service.js"
import { BOOTSTRAP_PORT } from "../../constants/global.js"
import { DOC_BOOTSTRAPPING_PAGE } from "../../constants/urls.constants.js"
import chalk from "chalk"
import blessed from "blessed"

const { Box, Screen } = blessed;

/**
 * CLI Command: Start a HyperDHT bootstrap server node
 *
 * This initializes a bootstrap node that allows peer discovery and coordination
 * for all connected HyperSwarm / HyperDHT clients.
 */
export const networkBootstrapCommand = {
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
      default: '127.0.0.1',
      describe: "IP to bind the DHT bootstrap server",
    },
  },
  async handler(argv) {
    const { port, host } = argv
    
    try {
      const result = await startBootstrapServer({
        ipv4: host,
        port: port
      });
      
      const screen = new Screen({
        smartCSR: true,
        title: "Pearcore Bootstrap Server"
      })

      let successMessage = chalk.bold.green(`[OK] Bootstrapper server running successfully!`);
      let addressMessage = chalk.bold.blue(`Address: `) + chalk.white(`${result.ipv4}:${result.port}`);
      let documentMessage = chalk.bold.gray(`For more information, please visit \n${DOC_BOOTSTRAPPING_PAGE}`);
      
      const box = new Box({
        content: successMessage + '\n' + addressMessage + '\n\n' + documentMessage,
        style: {
          border: { fg: "green" },
          bg: "black"
        },
        width: '100%',
        height: '50%',
        align: 'center',
        valign: 'middle'
      })
      
      screen.append(box)
      screen.render()
    } catch (error) {      
      console.error(chalk.bold.red('\n[Error] starting bootstrap server:'))
      console.error(chalk.white(error.message))
      
      process.exit(1)
    }
  },
}
