import chalk from 'chalk'
import { callDaemonRPC } from '../helpers/request.js'
import { daemonOptions } from '../helpers/options.js'

export const accountsCreateCommand = {
  command: 'create',
  describe: 'Create a new account on the running daemon',

  builder: {
    ...daemonOptions,
    username: { type: 'string', demandOption: true, describe: 'Username for the new account' },
    password: { type: 'string', demandOption: true, describe: 'Password for the new account' },
    json: { type: 'boolean', default: false, describe: 'Return output as JSON' },
    compact: { type: 'boolean', default: false, describe: 'Compact output mode' }
  },

  handler(argv) {
    const { username, password, json, compact } = argv

    callDaemonRPC({
      argv,
      method: 'accounts.create',
      params: { username, password },

      onSuccess(msg) {
        const account = msg.account
        if (!account) {
          console.error(chalk.red('Failed to create account: Unknown error'))
          return
        }

        if (json) {
          console.log(JSON.stringify(account, null, 2))
          return
        }

        if (!compact) console.log(chalk.green('✅ Account created successfully!'))

        console.log(chalk.cyan('Username:'), account.username)
        console.log(chalk.yellow('Public Key:'), account.publicKey)
        console.log(chalk.green('Mnemonic:'), account.mnemonic)
        console.log(chalk.magenta('Path:'), account.path)

        console.log("")
        let suggestedCommand = `"pearcore account login --username ${username} --password PASSWORD"`
        console.log(`Run ${chalk.gray(suggestedCommand)} to login with the created account.`)
      },

      onError(msg) {
        if (json) {
          console.error(JSON.stringify({ ok: false, error: msg.error ?? 'Unknown error' }, null, 2))
        } else {
          console.error(chalk.red('Failed to create account:'), msg.error ?? 'Unknown error')
        }
      }
    })
  }
}
