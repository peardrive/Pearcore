import chalk from 'chalk'
import { callDaemonRPC } from '../helpers/request.js'
import { daemonOptions } from '../helpers/options.js'
import { shortenHashBy4 } from "../../utils/general.utils.js"
import archy from 'archy'

export const spaceJoinCommand = {
    command: 'join <shareLink>',
    describe: 'Join an existing space on the running daemon using a share link',

    builder: {
        ...daemonOptions,

        shareLink: {
            type: 'string',
            demandOption: true,
            describe: 'Encoded share link for the space'
        }
    },

    handler(argv) {
        callDaemonRPC({
            argv,
            method: 'space.join',
            params: {
                shareLink: argv.shareLink
            },

            onError(msg) {
                if (argv.json) {
                    console.error(JSON.stringify(msg, null, 2))
                } else {
                    console.error(chalk.red('Daemon error:'), msg.error)
                }
            },

            onSuccess(msg) {
                console.log(chalk.green('Your request to join the space has been queued.'))

                if (msg.space) {
                    const { space } = msg
                    const tree = {
                        label: chalk.gray('Space Info'),
                        nodes: [
                            `Name: ${chalk.gray(space.spaceName)}`,
                            `Owner: ${chalk.magenta(shortenHashBy4(space.publicKey) || 'N/A')}`,
                            `Nonce: ${chalk.yellow(space.nonce)}`
                        ]
                    }
                    console.log(archy(tree))
                    console.log("")
                    console.log(`Run "pearcore space state" to check progress for space sync.`)
                } else {
                    console.error("Daemon did not respond with decoded space.")
                }
            }
        })
    }
}
