import chalk from 'chalk'
import { callDaemonRPC } from '../helpers/request.js'
import { daemonOptions } from '../helpers/options.js'

export const spaceCreateCommand = {
    command: 'create',
    describe: 'Create a new space on the running daemon',

    builder: {
        ...daemonOptions,

        name: {
            type: 'string',
            demandOption: true,
            describe: 'Name of the new space'
        },

        permissionBroadcast: {
            type: 'boolean',
            default: true,
            describe: 'Allow broadcasting?'
        },

        permissionRead: {
            type: 'boolean',
            default: true,
            describe: 'Allow reading?'
        },

        broadcastWhitelist: {
            type: 'array',
            default: [],
            describe: 'Broadcast whitelist public keys'
        },

        readWhitelist: {
            type: 'array',
            default: [],
            describe: 'Read whitelist public keys'
        }
    },

    handler(argv) {
        callDaemonRPC({
            argv,
            method: 'space.create',
            params: {
                spaceName: argv.name,
                permissionBroadcast: argv.permissionBroadcast,
                permissionRead: argv.permissionRead,
                broadcastWhitelist: argv.broadcastWhitelist,
                readWhitelist: argv.readWhitelist
            },
            onSuccess(msg) {
                console.log(
                    `Space "${chalk.green(argv.name)}" created successfully!`
                )
                console.log(
                    'Share Link:',
                    chalk.gray(msg.sharelink)
                )

                console.log("")
                console.log(`Run "pearcore space list" to display all stored spaces for your account.`)
            }
        })
    }
}
