import WebSocket from 'ws'

export function callDaemonRPC({
    argv,
    method,
    params,
    onSuccess,
    onError
}) {
    const { host, port, json } = argv
    const url = `ws://${host}:${port}`
    const ws = new WebSocket(url)

    ws.on('open', () => {
        ws.send(JSON.stringify({ method, params }))
    })

    ws.on('message', (raw) => {
        let msg
        try {
            msg = JSON.parse(raw)
        } catch {
            console.error('Invalid JSON response from daemon')
            ws.close()
            return
        }

        msg = msg.result

        if (!msg?.ok) {
            if (onError) {
                onError(msg)
            } else {
                console.error('Daemon error:', msg?.error ?? 'Unknown error')
            }
            ws.close()
            return
        }

        if (json) {
            console.log(JSON.stringify(msg, null, 2))
            ws.close()
            return
        }

        if (onSuccess) {
            onSuccess(msg)
        }

        ws.close()
    })

    ws.on('error', (err) => {
        console.error('Connection failed:', err.message)
    })
}
