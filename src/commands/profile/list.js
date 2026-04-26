import chalk from 'chalk'
import { callDaemonRPC } from '../helpers/request.js'
import { daemonOptions } from '../helpers/options.js'

export const profilesListCommand = {
  command: 'list',
  describe: 'List user profiles from the running daemon',

  builder: {
    ...daemonOptions,

    publicKey: {
      type: 'string',
      describe: 'Filter by public key'
    },

    username: {
      type: 'string',
      describe: 'Filter by username'
    },

    tag: {
      type: 'string',
      describe: 'Filter by tag'
    }
  },

  handler(argv) {
    const { publicKey, username, tag, json } = argv

    callDaemonRPC({
      argv,
      method: 'profile.list',
      params: { publicKey, username, tag },

      onSuccess(msg) {
        const profiles = msg.profiles || []

        if (json) {
          // handled centrally by callDaemonRPC
          return
        }

        if (profiles.length === 0) {
          console.log(chalk.yellow('No profiles match your query.'))
          return
        }

        console.log(chalk.green(`Found ${profiles.length} profiles:`))
        console.log('')

        profiles.forEach((p) => {
          console.log(chalk.blue.bold(`${p.username}#${p.tag}`))
          console.log(`  Public Key : ${chalk.magenta(p.publicKey)}`)

          if (p.profileURL) {
            console.log(`  Profile URL: ${chalk.cyan(p.profileURL)}`)
          }

          console.log(`  Timestamp  : ${new Date(p.timestamp).toISOString()}`)
          console.log('')
        })
      },

      onError(msg) {
        console.error('Daemon error:', msg.error ?? 'Unknown error')
      }
    })
  }
}
