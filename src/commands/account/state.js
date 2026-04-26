import chalk from 'chalk'
import { callDaemonRPC } from '../helpers/request.js'
import { daemonOptions } from '../helpers/options.js'

export const accountsStateCommand = {
  command: 'state',
  describe: 'Get state information for the current running account from the daemon',

  builder: {
    ...daemonOptions,
    json: {
      type: 'boolean',
      default: false,
      describe: 'Get RPC output as JSON'
    }
  },

  handler(argv) {
    callDaemonRPC({
      argv,
      method: 'accounts.state',

      onSuccess(state) {
        if (argv.json) {
          console.log(JSON.stringify(state, null, 2))
          return
        }

        switch (state.state) {
          case 'login required':
            console.log(chalk.red('Login required'))
            break

          case 'authenticated':
            console.log(chalk.green('Authenticated'))
            if (state.username) console.log(chalk.cyan('Username: '), state.username)
            if (state.publicKey) console.log(chalk.yellow('Public Key: '), state.publicKey)
            break

          case 'error':
            console.log(chalk.red(`Error: ${state.message || '<unknown>'}`))
            break

          default:
            console.log(chalk.yellow(`Unknown state: ${state.state}`))
        }
      },

      onError(msg) {
        console.error(chalk.red('Daemon error:'), msg.error ?? 'Unknown error')
      }
    })
  }
}
