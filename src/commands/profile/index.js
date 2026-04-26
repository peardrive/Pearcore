import { profileCreateCommand } from "./create.js"
import { profilesListCommand } from "./list.js"
import { profileStateCommand } from "./state.js"

export const profileCommand = {
  command: 'profile <subcommand>',
  describe: 'profile operations (state, create)',
  builder: (yargs) =>
    yargs
      .command(profileCreateCommand)
      .command(profileStateCommand)
      .command(profilesListCommand)
      .demandCommand(
        1,
        'Please specify a network subcommand. Available: state, create'
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
