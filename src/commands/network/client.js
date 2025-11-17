import { startSwarmClient } from "../../network/hyperswarmClient.js";
import {BOOTSTRAP_HOST, BOOTSTRAP_PORT, DEFAULT_TOPIC} from "../../constants.js"

export const networkClient = {
  command: "client",
  describe: "Start a pearDrive client node that connects to DHT via Hyperswarm",
  builder: {
    topic: { type: "string", demandOption: true,default: DEFAULT_TOPIC, describe: "Topic string for peer discovery" },
    bootstrap: { type: "string", default: `${BOOTSTRAP_HOST}:${BOOTSTRAP_PORT}`, describe: "Bootstrap DHT address" }
  },
  async handler(argv) {
    const topic = argv.topic;
    const bootstrap = argv.bootstrap;
    await startSwarmClient({ topic, bootstrap });
  }
};
