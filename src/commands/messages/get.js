import chalk from 'chalk'
import { callDaemonRPC } from '../helpers/request.js'
import { daemonOptions } from '../helpers/options.js'
import {
  displayMessage,
  parseTimestamp
} from '../helpers/general.js'

export const messagesGetCommand = {
  command: 'get',
  describe: 'Fetch messages for a space sharelink from the running daemon',

  builder: {
    ...daemonOptions,

    sharelink: {
      type: 'string',
      describe: 'Space sharelink (alternative to topic)'
    },

    topic: {
      type: 'string',
      describe: 'Space topic to query messages for'
    },

    // Basic filters
    id: { type: 'number', describe: 'Exact message ID' },
    type: { type: 'string', describe: 'Message type (text, media, space-metadata, etc.)' },
    isRelay: { type: 'boolean', describe: 'Filter by relay status (true/false)' },
    senderPublicKey: { type: 'string', describe: 'Sender public key (exact match)' },
    messageOwnerPublicKey: { type: 'string', describe: 'Original message owner public key' },
    nonce: { type: 'string', describe: 'Message nonce (exact match)' },
    signature: { type: 'string', describe: 'Message signature (exact match)' },

    // Timestamp filters
    broadcastTimestampStart: {
      type: 'string',
      describe: 'Broadcast timestamp start (ISO date or timestamp)'
    },
    broadcastTimestampEnd: {
      type: 'string',
      describe: 'Broadcast timestamp end (ISO date or timestamp)'
    },
    messageTimestampStart: {
      type: 'string',
      describe: 'Original message timestamp start (ISO date or timestamp)'
    },
    messageTimestampEnd: {
      type: 'string',
      describe: 'Original message timestamp end (ISO date or timestamp)'
    },

    // Payload content filter
    payloadContains: {
      type: 'string',
      describe: 'Search for substring in payload content (case-insensitive)'
    },

    // Pagination and sorting
    limit: {
      type: 'number',
      default: 50,
      describe: 'Maximum number of messages to return (max: 1000)'
    },
    offset: {
      type: 'number',
      default: 0,
      describe: 'Number of messages to skip'
    },
    orderBy: {
      type: 'string',
      default: 'broadcastTimestamp',
      choices: ['broadcastTimestamp', 'messageTimestamp', 'id'],
      describe: 'Field to order messages by'
    },
    orderDirection: {
      type: 'string',
      default: 'desc',
      choices: ['asc', 'desc'],
      describe: 'Sort direction'
    },

    // Output options
    raw: {
      type: 'boolean',
      default: false,
      describe: 'Show raw payload as-is'
    },
    compact: {
      type: 'boolean',
      default: false,
      describe: 'Compact output mode (less verbose)'
    },
    formatPayload: {
      type: 'boolean',
      default: true,
      describe: 'Format JSON payloads for readability'
    },
    showOnly: {
      type: 'array',
      default: [],
      describe: 'Show only specific fields (e.g., id,type,payload)'
    },
    count: {
      type: 'boolean',
      default: false,
      describe: 'Only show count of messages'
    }
  },

  handler(argv) {
    const {
      sharelink,
      topic,
      id,
      type,
      isRelay,
      senderPublicKey,
      messageOwnerPublicKey,
      nonce,
      signature,
      broadcastTimestampStart,
      broadcastTimestampEnd,
      messageTimestampStart,
      messageTimestampEnd,
      payloadContains,
      limit,
      offset,
      orderBy,
      orderDirection,
      json,
      raw,
      compact,
      formatPayload,
      showOnly,
      count
    } = argv

    // Enforce limit cap
    const safeLimit = Math.min(limit, 1000)
    if (limit > 1000) {
      console.warn(chalk.yellow('Warning:'), `Limit capped at 1000 (requested: ${limit})`)
    }

    const filters = {
      sharelink,
      topic,
      id,
      type,
      isRelay,
      senderPublicKey,
      messageOwnerPublicKey,
      nonce,
      signature,
      payloadContains,
      limit: safeLimit,
      offset,
      orderBy,
      orderDirection
    }

    if (broadcastTimestampStart || broadcastTimestampEnd) {
      filters.broadcastTimestamp = {}
      if (broadcastTimestampStart) {
        filters.broadcastTimestamp.start = parseTimestamp(broadcastTimestampStart)
      }
      if (broadcastTimestampEnd) {
        filters.broadcastTimestamp.end = parseTimestamp(broadcastTimestampEnd)
      }
    }

    if (messageTimestampStart || messageTimestampEnd) {
      filters.messageTimestamp = {}
      if (messageTimestampStart) {
        filters.messageTimestamp.start = parseTimestamp(messageTimestampStart)
      }
      if (messageTimestampEnd) {
        filters.messageTimestamp.end = parseTimestamp(messageTimestampEnd)
      }
    }

    callDaemonRPC({
      argv,
      method: 'messages.get',
      params: filters,

      onSuccess(msg) {
        if (json) {
          return
        }

        const messages = msg.messages || []
        const totalCount = msg.total || messages.length

        if (count) {
          console.log(chalk.green(`Found ${totalCount} message(s)`))
          return
        }

        if (!compact) {
          console.log(chalk.gray(`Displaying ${messages.length} of ${totalCount} message(s)`))
          console.log(
            chalk.gray(`Filters: offset=${offset}, limit=${safeLimit}, order=${orderBy} ${orderDirection}`)
          )
          console.log('')
        }

        if (messages.length === 0) {
          console.log(chalk.yellow('No messages found matching the filters'))
          return
        }

        for (const [index, record] of messages.entries()) {
          if (!compact) {
            console.log(chalk.gray('─'.repeat(80)))
            console.log(chalk.cyan(`Message ${index + 1 + offset}`))
          }

          if (showOnly.length > 0) {
            const selected = {}
            for (const field of showOnly) {
              if (field in record) {
                selected[field] = record[field]
              }
            }
            console.log(chalk.white(JSON.stringify(selected, null, 2)))
          } else {
            displayMessage(record, { compact, raw, formatPayload })
          }

          if (!compact && index < messages.length - 1) {
            console.log('')
          }
        }

        if (!compact) {
          console.log('')
          console.log(chalk.gray('─'.repeat(80)))
          console.log(chalk.green(`✓ Fetched ${messages.length} message(s) successfully`))
        }
      },

      onError(msg) {
        if (json) {
          console.error(JSON.stringify(msg, null, 2))
        } else {
          console.error(chalk.red('Daemon error:'), msg.error)
        }
      }
    })
  }
}
