import chalk from 'chalk'
import archy from 'archy'
import { callDaemonRPC } from '../helpers/request.js'
import { daemonOptions } from '../helpers/options.js'
import { shortenHashBy4 } from "../../utils/general.utils.js"

function pickFilters(argv) {
    const {
        spaceId,
        spaceName,
        spaceNameLike,
        publicKey,
        timestampFrom,
        timestampTo,
        permissionBroadcast,
        permissionRead,
        nonce,
        orderBy,
        orderDirection,
        limit
    } = argv

    return Object.fromEntries(
        Object.entries({
            spaceId,
            spaceName,
            spaceNameLike,
            publicKey,
            timestampFrom,
            timestampTo,
            permissionBroadcast,
            permissionRead,
            nonce,
            orderBy,
            orderDirection,
            limit
        }).filter(([, v]) => v !== undefined)
    )
}

export const spaceListCommand = {
    command: 'list',
    describe: 'List spaces on the running daemon',

    builder: {
        ...daemonOptions,

        spaceId: {
            type: 'string',
            describe: 'Filter by exact space ID'
        },

        spaceName: {
            type: 'string',
            describe: 'Filter by exact space name'
        },

        spaceNameLike: {
            type: 'string',
            describe: 'Filter by partial space name'
        },

        publicKey: {
            type: 'string',
            describe: 'Filter by owner public key'
        },

        nonce: {
            type: 'number',
            describe: 'Filter by space nonce'
        },

        timestampFrom: {
            type: 'number',
            describe: 'Filter by minimum timestamp'
        },

        timestampTo: {
            type: 'number',
            describe: 'Filter by maximum timestamp'
        },

        permissionBroadcast: {
            type: 'boolean',
            describe: 'Filter by broadcast permission'
        },

        permissionRead: {
            type: 'boolean',
            describe: 'Filter by read permission'
        },

        orderBy: {
            type: 'string',
            default: 'timestamp',
            describe: 'Order results by field'
        },

        orderDirection: {
            type: 'string',
            choices: ['asc', 'desc'],
            default: 'asc',
            describe: 'Sort direction'
        },

        limit: {
            type: 'number',
            describe: 'Limit number of results'
        }
    },

    handler(argv) {
        const params = pickFilters(argv)

        callDaemonRPC({
            argv,
            method: 'space.list',
            params,

            onSuccess(msg) {
                const spaces = msg.spaces || []

                if (argv.json) {
                    console.log(JSON.stringify(spaces, null, 2))
                    return
                }

                if (spaces.length === 0) {
                    console.log(chalk.gray('No spaces found.'))
                    return
                }

                const tree = {
                    label: chalk.green('Spaces'),
                    nodes: spaces.map(space => ({
                        label: `${chalk.cyan(space.spaceName)} ${chalk.gray(`(nonce: ${space.nonce})`)}`,
                        nodes: [
                            `Owner: ${chalk.magenta(shortenHashBy4(space.publicKey) || 'N/A')}`,
                            `Is Synced: ${space.isSync ? chalk.green(true) : chalk.red(false)}`,
                            `Broadcast Allowed: ${space.permissionBroadcast ? chalk.green('yes') : chalk.red('no')}`,
                            `Read Allowed: ${space.permissionRead ? chalk.green('yes') : chalk.red('no')}`,
                            space.broadcastWhitelist?.length
                                ? `Broadcast Whitelist: ${space.broadcastWhitelist.join(', ')}`
                                : null,
                            space.readWhitelist?.length
                                ? `Read Whitelist: ${space.readWhitelist.join(', ')}`
                                : null,
                            `Messages Encrypted: ${
                                space.secret ? chalk.green('yes') : chalk.cyan('no')
                            }`,
                            `Sharelink: ${chalk.gray(space.sharelink)}`
                        ].filter(Boolean)
                    }))
                }

                console.log(archy(tree))
            }
        })
    }
}
