import chalk from 'chalk'
import { callDaemonRPC } from '../helpers/request.js'
import { daemonOptions } from '../helpers/options.js'

export const accountsLoginCommand = {
  command: 'login',
  describe: 'Authenticate with an existing account on the daemon',

  builder: {
    ...daemonOptions,

    username: {
      type: 'string',
      demandOption: true,
      describe: 'Username for the account'
    },

    password: {
      type: 'string',
      demandOption: true,
      describe: 'Password for the account'
    },

    json: {
      type: 'boolean',
      default: false,
      describe: 'Return output as JSON'
    }
  },

  handler(argv) {
    const { username, password } = argv

    callDaemonRPC({
      argv,
      method: 'auth.login',
      params: { username, password },

      onSuccess(res) {
        if (argv.json) {
          console.log(JSON.stringify(res, null, 2))
          return
        }

        if (res.ok) {
          console.log(chalk.green('Login successful'))
          console.log(chalk.cyan('Username:'), username)
          console.log(chalk.yellow('Public Key:'), res.publicKey)
        } else {
          console.log(chalk.red(`Login failed: ${res.error ?? '<unknown error>'}`))
        }
      },

      onError(msg) {
        console.error(chalk.red('Daemon error:'), msg.error ?? 'Unknown error')
      }
    })
  }
}
