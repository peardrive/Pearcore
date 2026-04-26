import chalk from 'chalk'
import { callDaemonRPC } from '../helpers/request.js'
import { daemonOptions } from '../helpers/options.js'

export const profileCreateCommand = {
  command: 'create',
  describe: 'Create or update the current user profile on the running daemon',

  builder: {
    ...daemonOptions,

    username: {
      type: 'string',
      demandOption: true,
      describe: 'Username for the profile'
    },

    tag: {
      type: 'string',
      demandOption: true,
      describe: 'Tag for the profile'
    },

    profileURL: {
      type: 'string',
      describe: 'Optional profile URL'
    }
  },

  handler(argv) {
    const { username, tag, profileURL, json } = argv

    callDaemonRPC({
      argv,
      method: 'profile.update',
      params: { username, tag, profileURL },

      onSuccess(msg) {
        if (json) {
          // handled by callDaemonRPC, but kept for clarity
          return
        }

        console.log(chalk.green('Profile updated successfully:'))
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
