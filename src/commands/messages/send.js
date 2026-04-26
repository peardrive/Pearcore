import chalk from 'chalk'
import { callDaemonRPC } from '../helpers/request.js'
import { daemonOptions } from '../helpers/options.js'
import { generateSpaceTopic } from '../../utils/space.utils.js'
import { decodeShareLink } from '../../utils/sharelink.utils.js'

export const messagesSendCommand = {
  command: 'send',
  describe: 'Send a message to a space using sharelink or topic',

  builder: {
    ...daemonOptions,

    sharelink: {
      type: 'string',
      describe: 'Space sharelink (alternative to topic)'
    },

    topic: {
      type: 'string',
      describe: 'Space topic (hex string, alternative to sharelink)'
    },

    message: {
      type: 'string',
      demandOption: true,
      describe: 'Message content to send'
    }
  },

  handler(argv) {
    const { sharelink, topic: inputTopic, message } = argv

    let topic = inputTopic

    // Resolve topic from sharelink if provided
    if (sharelink) {
      try {
        const decoded = decodeShareLink(sharelink)
        if (!decoded) {
          console.error(chalk.red('Invalid sharelink'))
          return
        }

        topic = generateSpaceTopic(
          decoded.spaceName,
          decoded.publicKey,
          decoded.nonce
        )
      } catch (err) {
        console.error(chalk.red('Failed to decode sharelink:'), err.message)
        return
      }
    }

    if (!topic) {
      console.error(chalk.red('Either a sharelink or a topic must be provided'))
      return
    }

    callDaemonRPC({
      argv,
      method: 'messages.send',
      params: {
        topic,
        message: {
          payload: { text: message },
          type: 'text'
        }
      },

      onSuccess() {
        console.log(chalk.green('Message sent successfully!'))
        let suggestedCommand = `"pearcore message get --topic ${topic} --orderDirection asc"`
        console.log(`Run ${chalk.gray(suggestedCommand)} to see all messages sent into same space`)
      },

      onError(msg) {
        console.error(chalk.red('Daemon error:'), msg.error ?? 'Unknown error')
      }
    })
  }
}
