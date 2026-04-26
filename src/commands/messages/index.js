import { messagesFlushCommand } from './flush.js'
import { messagesGetCommand } from './get.js'
import { messagesSendCommand } from './send.js'


export const messageCommand = {
  command: 'message <subcommand>',
  describe: 'message operations (get, send)',
  builder: (yargs) =>
    yargs
      .command(messagesGetCommand)
      .command(messagesFlushCommand)
      .command(messagesSendCommand)
      .demandCommand(
        1,
        'Please specify a subcommand'
      )
      .strict() // Only allow defined commands
      .help()
      .alias('h', 'help'),
  handler: (argv) => {
    // Yargs dispatches automatically to the matching subcommand
    if (!argv.subcommand) {
      console.error('Error: Missing subcommand.')
      process.exit(1)
    }
  },
}
