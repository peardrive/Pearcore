import { networkBootstrap } from './bootstrap.js'

/**
 * Network command CLI entry
 * Handles network-related operations like starting bootstrap or client nodes.
 */
export const networkCmd = {
  command: 'network <subcommand>',
  describe: 'Network operations (bootstrap server, client node, etc.)',
  builder: (yargs) =>
    yargs
      .command(networkBootstrap)
      .demandCommand(
        1,
        'Please specify a network subcommand. Available: bootstrap, client, status'
      )
      .strict() // Only allow defined commands
      .help()
      .alias('h', 'help'),
  handler: (argv) => {
    // Yargs automatically dispatches to the matching subcommand
    // But we can log or validate further if needed
    if (!argv.subcommand) {
      console.error('Error: Missing network subcommand.')
      process.exit(1)
    }
  },
}
