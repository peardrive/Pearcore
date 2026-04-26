import chalk from 'chalk'
import { callDaemonRPC } from '../helpers/request.js'
import { daemonOptions } from '../helpers/options.js'

export const accountsListCommand = {
  command: 'list',
  describe: 'List all accounts on the running daemon',

  builder: {
    ...daemonOptions,
    json: {
      type: 'boolean',
      default: false,
      describe: 'Get RPC output as JSON'
    },
    compact: {
      type: 'boolean',
      default: false,
      describe: 'Compact output mode'
    },
    count: {
      type: 'boolean',
      default: false,
      describe: 'Only show number of accounts'
    }
  },

  handler(argv) {
    callDaemonRPC({
      argv,
      method: 'accounts.list',

      onSuccess(res) {
        const accounts = res.accounts || []

        if (argv.json) {
          console.log(JSON.stringify(accounts, null, 2))
          return
        }

        if (argv.count) {
          console.log(chalk.green(`Found ${accounts.length} account(s)`))
          return
        }

        if (!accounts.length) {
          console.log(chalk.yellow('No accounts found.'))
          return
        }

        accounts.forEach((acc, index) => {
          if (!argv.compact) {
            console.log(chalk.gray('─'.repeat(60)))
          }

          console.log(chalk.cyan('Username:'), acc.username)
          console.log(chalk.yellow('Public Key:'), acc.publicKey || 'N/A')
          console.log(chalk.green('Created At:'), acc.createdAt ? new Date(acc.createdAt).toLocaleString() : 'N/A')
          if (acc.path) console.log(chalk.gray('Path:'), acc.path)
          if (acc.mnemonic) console.log(chalk.blue('Mnemonic:'), acc.mnemonic)

          if (!argv.compact && index < accounts.length - 1) {
            console.log('')
          }
        })

        if (!argv.compact) {
          console.log('')
          console.log(chalk.gray('─'.repeat(60)))
          console.log(chalk.green(`✓ Listed ${accounts.length} account(s) successfully`))
        }
      },

      onError(msg) {
        console.error(chalk.red('Daemon error:'), msg.error ?? 'Unknown error')
      }
    })
  }
}
