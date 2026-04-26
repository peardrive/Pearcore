import WebSocket from 'ws'
import chalk from 'chalk'
import blessed from 'blessed'

import { shortenHash } from '../../utils/general.utils.js'
import { daemonOptions } from '../helpers/options.js'


function rpc(url, method, params = {}) {
  return new Promise((resolve, reject) => {
    let ws

    try {
      ws = new WebSocket(url)

      ws.on('open', () => {
        try {
          ws.send(JSON.stringify({ method, params }))
        } catch (err) {
          ws.close()
          reject(err)
        }
      })

      ws.on('message', raw => {
        try {
          const msg = JSON.parse(raw.toString()).result
          ws.close()
          msg?.ok ? resolve(msg) : reject(msg?.error || new Error('RPC error'))
        } catch {
          ws.close()
          reject(new Error('Invalid JSON response'))
        }
      })

      ws.on('error', err => {
        try { ws.close() } catch {}
        reject(err)
      })
    } catch (err) {
      try { ws?.close() } catch {}
      reject(err)
    }
  })
}

export const spaceStateCommand = {
  command: 'state',
  describe: 'Get a summary of connected peers and topics from the running daemon',

  builder: {
    ...daemonOptions,
    live: {
      type: 'boolean',
      default: true,
      describe: 'Interactive live dashboard'
    }
  },

  async handler(argv) {
    const { host, port, json, live } = argv
    const url = `ws://${host}:${port}`

    if (!live || json) {
      try {
        const msg = await rpc(url, 'space.state')
        console.log(json ? JSON.stringify(msg.state, null, 2) : msg.state)
      } catch (err) {
        console.error(chalk.red('Failed to fetch space state:'), err.message)
      }
      return
    }

    const screen = blessed.screen({
      smartCSR: true,
      mouse: true,
      title: 'PearDrive – Space State'
    })

    screen.program.enableMouse()
    screen.program.hideCursor()
    screen.key(['C-c', 'q'], () => process.exit(0))

    const header = blessed.box({
      top: 0,
      height: 1,
      width: '100%',
      style: { fg: 'green' }
    })
    screen.append(header)

    function panel(opts) {
      return blessed.list({
        ...opts,
        border: 'line',
        mouse: true,
        keys: true,
        bold: true,
        style: {
          selected: { bg: 'white', fg: 'black'}
        }
      })
    }

    const joinQueue = panel({
      label: ' Join Queue ',
      top: 1,
      height: '25%',
      width: '100%'
    })

    const topics = panel({
      label: ' Topics ',
      top: '26%',
      height: '25%',
      width: '100%'
    })

    const peers = panel({
      label: ' Connected Peers ',
      top: '52%',
      height: '48%',
      width: '100%',
      style: {
        selected: { bg: 'green', fg: 'black' }
      }
    })

    screen.append(joinQueue)
    screen.append(topics)
    screen.append(peers)

    const focusables = [joinQueue, topics, peers]
    let active = 2

    function setActive(index) {
      focusables.forEach(p => (p.style.border.fg = 'brightwhite'))
      focusables[index].style.border.fg = 'brightgreen'
      focusables[index].focus()
      screen.render()
    }

    focusables.forEach((p, i) => {
      p.on('click', () => {
        active = i
        setActive(active)
      })
    })

    screen.key('tab', () => {
      active = (active + 1) % focusables.length
      setActive(active)
    })

    let profilesByKey = {}
    let state = null

    async function loadProfiles() {
      try {
        const res = await rpc(url, 'profile.list')
        profilesByKey = Object.fromEntries(
          (res.profiles || []).map(p => [p.publicKey, p.username])
        )
      } catch {
        profilesByKey = {}
      }
    }

    async function loadState() {
      try {
        state = (await rpc(url, 'space.state')).state
      } catch {
        state = null
      }
    }

    function renderPeersTable() {
      if (!state?.peers?.length) {
        peers.setItems(['<no connected peers>'])
        return
      }

      const localTopics = new Set(state.topics || [])

      const rows = state.peers.map(pk => {
        const username = profilesByKey[pk] || 'unknown'
        const peerTopics = state.topicsByPeer?.[pk] || []
        const common = peerTopics.filter(t => localTopics.has(t)).length

        return (
          `${username.padEnd(12)} | ` +
          `pk:${shortenHash(pk, 4, 4)} | ` +
          `topics:${peerTopics.length.toString().padStart(2)} | ` +
          `common:${common.toString().padStart(2)}`
        )
      })

      peers.setItems(rows)
    }

    function render() {
      try {
        if (!state) return

        const username = profilesByKey[state.publicKey] || 'unknown'
        header.setContent(
          ` Account: ${username} | Public Key: ${shortenHash(state.publicKey, 4, 4)} `
        )

        joinQueue.setItems(state.joinQueue?.length ? state.joinQueue : ['<empty>'])
        topics.setItems((state.topics || []).map(t => shortenHash(t, 4, 4)))

        renderPeersTable()
        screen.render()
      } catch {}
    }

    await loadProfiles()
    await loadState()
    setActive(active)
    render()

    const timer = setInterval(async () => {
      await loadState()
      await loadProfiles()
      render()
    }, 500)

    screen.on('destroy', () => clearInterval(timer))
  }
}
