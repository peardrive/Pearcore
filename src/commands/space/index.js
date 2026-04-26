import { spaceListCommand } from './list.js'
import { spaceCreateCommand } from './create.js'
import { spaceStateCommand } from './state.js'
import { spaceJoinCommand } from './join.js'


export const spaceCommand = {
  command: 'space <subcommand>',
  describe: 'space operations (list, create, join, leave)',
  builder: (yargs) =>
    yargs
      .command(spaceListCommand)
      .command(spaceCreateCommand)
      .command(spaceStateCommand)
      .command(spaceJoinCommand)
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
