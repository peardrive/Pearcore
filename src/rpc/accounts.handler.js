import { logger } from "../logger"

/**
 * Registers WebSocket RPC handlers for account management.
 * All account operations accept an optional `root` path to override ACCOUNTS_ROOT.
 * 
 * @param {object} router - RPC router instance
 * @param {object} services - { accounts, session, swarm }
 */
export function registerAccountHandlers(router, services) {
  // Return the current state of the account (who is logged in)
  router.register('accounts.state', async () => {
    try {
      const creds = services.session.getCredentials()
      if (!creds) {
        return { state: 'login required' }
      }
      return {
        state: 'authenticated',
        username: creds.username,
        publicKey: Buffer.from(creds.publicKey).toString('hex')
      }
    } catch (err) {
      logger.error('Error getting account state:', err)
      return { state: 'error', message: err.message }
    }
  })

  // List all accounts under optional root
  router.register('accounts.list', async ({ root } = {}) => {
    try {
      const accounts = await services.accounts.listAccounts(root)
      return { ok: true, accounts }
    } catch (err) {
      logger.error('Error listing accounts:', err)
      return { ok: false, error: err.message }
    }
  })

  // Create a new account under optional root
  router.register('accounts.create', async ({ username, password, root } = {}) => {
    try {
      const account = await services.accounts.createAccount(username, password, root)
      return { ok: true, account }
    } catch (err) {
      logger.error('Error creating account:', err)
      return { ok: false, error: err.message }
    }
  })

  // Login
  router.register('auth.login', async ({ username, password, root } = {}) => {
    try {
      const creds = await services.accounts.authenticate(username, password, root)

      // Store credentials in session
      services.session.setCredentials({
        username: creds.username,
        publicKey: creds.publicKey,
        secretKey: creds.secretKey,
      })

      // Start swarm after login
      try {
        const { swarm } = await services.swarm.startSwarmNode({
          keyPair: { publicKey: creds.publicKey, secretKey: creds.secretKey },
          session: services.session
        })
        services.session.attachSwarm(swarm)
      } catch (err) {
        logger.error('Failed to start swarm:', err)
        return { ok: false, error: 'Login succeeded, but swarm failed to start' }
      }

      return { ok: true, publicKey: Buffer.from(creds.publicKey).toString('hex') }
    } catch (err) {
      logger.warn(`Login failed for user: ${username} | error: ${err.message}`)
      return { ok: false, error: 'Invalid username or password' }
    }
  })

  // Logout
  router.register('auth.logout', async () => {
    try {
      await services.session.clear() // destroys swarm if exists and clears credentials
      return { ok: true }
    } catch (err) {
      logger.error('Error during logout:', err)
      return { ok: false, error: err.message }
    }
  })
}
