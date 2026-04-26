import chalk from 'chalk'
import { callDaemonRPC } from '../helpers/request.js'
import { daemonOptions } from '../helpers/options.js'

export const accountsLogoutCommand = {
  command: 'logout',
  describe: 'Log out the current account from the daemon',

  builder: {
    ...daemonOptions,
    json: {
      type: 'boolean',
      default: false,
      describe: 'Return output as JSON'
    }
  },

  handler(argv) {
    callDaemonRPC({
      argv,
      method: 'auth.logout',
      params: {},

      onSuccess(res) {
        if (argv.json) {
          console.log(JSON.stringify(res, null, 2))
          return
        }

        if (res.ok) {
          console.log(chalk.green('Logout successful'))
        } else {
          console.log(chalk.red(`Logout failed: ${res.error ?? '<unknown error>'}`))
        }
      },

      onError(msg) {
        console.error(chalk.red('Daemon error:'), msg.error ?? 'Unknown error')
      }
    })
  }
}
