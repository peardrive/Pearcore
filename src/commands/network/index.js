import { networkBootstrapCommand } from './bootstrap.js'

/**
 * Network command CLI entry
 * Handles network-related operations like starting bootstrap or client nodes.
 */
export const networkCommand = {
  command: 'network <subcommand>',
  describe: 'Network operations (bootstrap, client)',
  builder: (yargs) =>
    yargs
      // bootstraper command
      .command(networkBootstrapCommand)
      // client (daemon service) starter command
      .demandCommand(
        1,
        'Please specify a network subcommand. Available: bootstrap, client, state'
      )
      .strict() // Only allow defined commands
      .help()
      .alias('h', 'help'),
  handler: (argv) => {
    // Yargs dispatches automatically to the matching subcommand
    if (!argv.subcommand) {
      console.error('Error: Missing network subcommand.')
      process.exit(1)
    }
  },
}
