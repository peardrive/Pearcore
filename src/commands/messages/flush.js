import chalk from 'chalk'
import readline from 'readline'
import { callDaemonRPC } from '../helpers/request.js'
import { daemonOptions } from '../helpers/options.js'

import { shortenHashBy4 } from '../../utils/general.utils.js'
import { parseTimestamp } from '../helpers/general.js'
import { messagesGetCommand } from './get.js'

export const messagesFlushCommand = {
  command: 'flush',
  describe: 'Delete messages matching specific filters',

  builder: {
    ...daemonOptions,

    // Reuse filters from get command
    sharelink: messagesGetCommand.builder.sharelink,
    topic: messagesGetCommand.builder.topic,

    id: messagesGetCommand.builder.id,
    type: messagesGetCommand.builder.type,
    isRelay: messagesGetCommand.builder.isRelay,
    senderPublicKey: messagesGetCommand.builder.senderPublicKey,
    messageOwnerPublicKey: messagesGetCommand.builder.messageOwnerPublicKey,
    nonce: messagesGetCommand.builder.nonce,
    signature: messagesGetCommand.builder.signature,

    broadcastTimestampStart: messagesGetCommand.builder.broadcastTimestampStart,
    broadcastTimestampEnd: messagesGetCommand.builder.broadcastTimestampEnd,
    messageTimestampStart: messagesGetCommand.builder.messageTimestampStart,
    messageTimestampEnd: messagesGetCommand.builder.messageTimestampEnd,

    payloadContains: messagesGetCommand.builder.payloadContains,

    limit: messagesGetCommand.builder.limit,
    offset: messagesGetCommand.builder.offset,

    confirm: {
      type: 'boolean',
      default: false,
      describe: 'Skip confirmation prompt and proceed with deletion'
    },

    preview: {
      type: 'boolean',
      default: false,
      describe: 'Show what would be deleted without prompting for confirmation'
    }
  },

  async handler(argv) {
    const { confirm, preview, ...filters } = argv

    // Clean yargs internals
    const cleanFilters = { ...filters }
    delete cleanFilters._
    delete cleanFilters.$0
    delete cleanFilters.handler
    delete cleanFilters._parseResults

    const requestFilters = { ...cleanFilters }

    // Timestamp normalization
    if (filters.broadcastTimestampStart || filters.broadcastTimestampEnd) {
      requestFilters.broadcastTimestamp = {}
      if (filters.broadcastTimestampStart) {
        requestFilters.broadcastTimestamp.start = parseTimestamp(filters.broadcastTimestampStart)
      }
      if (filters.broadcastTimestampEnd) {
        requestFilters.broadcastTimestamp.end = parseTimestamp(filters.broadcastTimestampEnd)
      }
    }

    if (filters.messageTimestampStart || filters.messageTimestampEnd) {
      requestFilters.messageTimestamp = {}
      if (filters.messageTimestampStart) {
        requestFilters.messageTimestamp.start = parseTimestamp(filters.messageTimestampStart)
      }
      if (filters.messageTimestampEnd) {
        requestFilters.messageTimestamp.end = parseTimestamp(filters.messageTimestampEnd)
      }
    }


    const showPreview = () =>
      new Promise((resolve) => {
        console.log(chalk.yellow('Preview: Messages to be deleted'))
        console.log(chalk.gray('Filters to be applied:'))

        Object.entries(requestFilters).forEach(([key, value]) => {
          if (
            value !== undefined &&
            value !== null &&
            key !== 'broadcastTimestamp' &&
            key !== 'messageTimestamp'
          ) {
            console.log(chalk.gray(`  ${key}:`), chalk.white(value))
          }
        })

        if (requestFilters.broadcastTimestamp) {
          const ts = requestFilters.broadcastTimestamp
          console.log(
            chalk.gray('  broadcastTimestamp:'),
            chalk.white(
              `start=${ts.start ? new Date(ts.start).toISOString() : 'any'}, ` +
              `end=${ts.end ? new Date(ts.end).toISOString() : 'any'}`
            )
          )
        }

        if (requestFilters.messageTimestamp) {
          const ts = requestFilters.messageTimestamp
          console.log(
            chalk.gray('  messageTimestamp:'),
            chalk.white(
              `start=${ts.start ? new Date(ts.start).toISOString() : 'any'}, ` +
              `end=${ts.end ? new Date(ts.end).toISOString() : 'any'}`
            )
          )
        }

        console.log('')

        callDaemonRPC({
          argv,
          method: 'messages.get',
          params: {
            ...requestFilters,
            limit: requestFilters.limit || 10,
            orderBy: 'broadcastTimestamp',
            orderDirection: 'desc'
          },

          onSuccess(msg) {
            const messages = msg.messages || []
            const total = msg.total || messages.length

            console.log(chalk.yellow(`Found ${total} message(s) matching these filters`))

            if (messages.length > 0) {
              console.log(chalk.gray('Sample of messages that would be deleted:\n'))

              messages.forEach((m, i) => {
                console.log(
                  chalk.gray(`${i + 1}.`),
                  chalk.white(`ID: ${m.id}`),
                  chalk.gray(`Type: ${m.type}`),
                  chalk.gray(`From: ${shortenHashBy4(m.senderPublicKey)}`),
                  chalk.gray(`At: ${new Date(m.broadcastTimestamp).toLocaleString()}`)
                )
                if (i < messages.length - 1) {
                  console.log(chalk.gray('   ─'))
                }
              })
            }

            resolve(total)
          },

          onError(err) {
            console.error(chalk.red('Daemon error:'), err.error)
            resolve(0)
          }
        })
      })


    const askForConfirmation = () =>
      new Promise((resolve) => {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        })

        rl.question(
          chalk.yellow('Are you sure you want to flush these records? [y/N]: '),
          (answer) => {
            rl.close()
            const normalized = answer.trim().toLowerCase()
            resolve(normalized === 'y' || normalized === 'yes')
          }
        )
      })

    const executeFlush = () =>
      new Promise((resolve) => {
        callDaemonRPC({
          argv,
          method: 'messages.flush',
          params: requestFilters,

          onSuccess(result) {
            const deletedCount =
              result.deleted || result.messages?.length || 0

            console.log(chalk.green(`Successfully deleted ${deletedCount} message(s)`))

            if (result.messages?.length) {
              console.log(chalk.gray('Deleted messages:'))
              result.messages.forEach((m) => {
                console.log(
                  chalk.gray(`  • ${m.id}: ${m.type} from ${shortenHashBy4(m.senderPublicKey)}`)
                )
              })
            }

            resolve()
          },

          onError(err) {
            console.error(chalk.red('Error:'), err.error)
            resolve()
          }
        })
      })


    try {
      const messageCount = await showPreview()

      if (messageCount === 0) {
        console.log(chalk.yellow('\nNo messages found matching the specified filters.'))
        return
      }

      if (preview) {
        console.log(chalk.gray('\nPreview only - no messages were deleted.'))
        console.log(chalk.gray('Use --confirm to proceed with deletion.'))
        return
      }

      if (confirm) {
        console.log(chalk.yellow('\nProceeding with deletion (--confirm flag provided)...'))
        await executeFlush()
        return
      }

      console.log('')
      const shouldProceed = await askForConfirmation()

      if (shouldProceed) {
        await executeFlush()
      } else {
        console.log(chalk.gray('Operation cancelled.'))
      }
    } catch (err) {
      console.error(chalk.red('Error:'), err.message)
    }
  }
}
