import chalk from 'chalk'
import { callDaemonRPC } from '../helpers/request.js'
import { daemonOptions } from '../helpers/options.js'

export const profileStateCommand = {
  command: 'state',
  describe: 'Get the current user profile from the running daemon',

  builder: {
    ...daemonOptions
  },

  handler(argv) {
    const { json } = argv

    callDaemonRPC({
      argv,
      method: 'profile.state',
      params: {},

      onSuccess(msg) {
        if (json) {
          // handled centrally by callDaemonRPC
          return
        }

        if (!msg.profile) {
          console.log(chalk.yellow('No profile found for the current session.'))
          return
        }

        console.log(chalk.green('Profile retrieved successfully:'))
        console.log(`Username: ${chalk.blue(msg.profile.username)}`)
        console.log(`Tag: ${chalk.blue(msg.profile.tag)}`)

        if (msg.profile.profileURL) {
          console.log(`Profile URL: ${chalk.blue(msg.profile.profileURL)}`)
        }
      },

      onError(msg) {
        console.error('Daemon error:', msg.error ?? 'Unknown error')
      }
    })
  }
}
