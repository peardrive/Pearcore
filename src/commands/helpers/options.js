export const daemonOptions = {
    host: { type: 'string', default: '127.0.0.1', describe: 'Daemon host' },
    port: { type: 'number', default: 8787, describe: 'Daemon WebSocket port' },
    json: { type: 'boolean', default: false, describe: 'Get RPC output as JSON' }
}