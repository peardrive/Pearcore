import { accountsCreateCommand } from "./create.js"
import { accountsListCommand } from "./list.js"
import { accountsStateCommand } from "./state.js"
import { accountsLoginCommand } from "./login.js"
import { accountsLogoutCommand } from "./logout.js"

/**
 * Account command CLI entry
 * Handles account-related operations list creating account, 
 * authenticate and currect account state
 */
export const accountCommand = {
  command: 'account <subcommand>',
  describe: 'account operations (create, login, state, logout)',
  builder: (yargs) =>
    yargs
      .command(accountsListCommand)
      .command(accountsStateCommand)
      .command(accountsCreateCommand)
      .command(accountsLoginCommand)
      .command(accountsLogoutCommand)
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

