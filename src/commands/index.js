// src/commands/index.js
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { networkCmd } from "./network/index.js"

/**
 * CLI Entry Point
 *
 * This function initializes the yargs-powered CLI for prototype-core.
 * Commands are modular and loaded from the /commands directory.
 *
 * Example:
 *   $ prototype-core network bootstrap
 *
 * @param {string[]} [argv=process.argv] - CLI arguments passed from Node.js
 */
export function runCLI(argv = process.argv) {
  yargs(hideBin(argv))
    .scriptName("prototype-core")
    .usage("Usage:\n  $0 <command> [options]")
    .command(networkCmd)
    .recommendCommands() // suggests closest commands for typos
    .demandCommand(1, "You must specify a valid command")
    .strict() // ensures invalid options are rejected
    .alias("h", "help")
    .alias("v", "version")
    .wrap(Math.min(120, yargs().terminalWidth())) // format help text to terminal width
    .epilog("© 2025 Prototype Drive — distributed file system toolkit")
    .help()
    .parse()
}
