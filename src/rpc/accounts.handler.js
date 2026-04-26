import { logger } from "../logger.js"

/**
 * Registers WebSocket RPC handlers for account management.
 * The handler only processes JSON and calls service methods.
 * @param {object} router - RPC router
 * @param {object} core - { accounts, session, swarm }
 */
export function registerAccountHandlers(router, core) {

  /**
   * Returns the current state of the accounts service.
   * Logs and returns an error object if fetching the state fails.
   */
  router.register('accounts.state', async ({id = undefined} = {}) => {
    try {
      const response = core.accounts.getCurrentState();
      return { id, ok: true, ...response };
    } catch (err) {
      logger.error('Error getting account state:', err);
      return { id, ok: false, error: err.message };
    }
  });

  /**
   * Lists all accounts in the specified root directory (or default drive directory).
   * Returns an object with `ok: true` and the accounts array on success.
   * Logs and returns an error object with `ok: false` if listing fails.
   */
  router.register('accounts.list', async ({ id = undefined } = {}) => {
    try {
      const accounts = await core.accounts.list();
      return { id, ok: true, accounts };
    } catch (err) {
      logger.error('Error listing accounts:', err);
      return { id, ok: false, error: err.message };
    }
  });

  /**
   * Creates a new account with the given username and password in the specified root directory (or default drive directory).
   * Returns an object with `ok: true` and the created account on success.
   * Validates that username and password are provided.
   * Logs and returns an error object with `ok: false` if creation fails.
   */
  router.register('accounts.create', async ({ id = undefined, username, password } = {}) => {
    try {
      const account = await core.accounts.create(username, password);
      return { id, ok: true, account };
    } catch (err) {
      logger.error('Failed creating account', err);
      return { id, ok: false, error: err.message };
    }
  })

  /**
   * Authenticates a user with the given username and password in the specified root directory (or default drive directory).
   * Returns `ok: true` and the user's public key (hex string) on successful authentication.
   * Logs a warning and returns `ok: false` with a generic error message if authentication fails.
   */
  router.register('auth.login', async ({ id = undefined, username, password } = {}) => {
    if (!username?.trim() || !password?.trim()) return { id, ok: false, error: 'username and password required' }
    try {
      const creds = await core.accounts.authenticate(username, password)
      return { id, ok: true, publicKey: creds.publicKey }
    } catch (err) {
      logger.warn(`Login failed for user: ${username} | error: ${err.message}`)
      return { id, ok: false, error: err.message }
    }
  })

  /**
   * RPC handler for 'auth.logout'.
   * Logs out the current user using the accounts service.
   * Returns `ok: true` on success.
   * Logs and returns `ok: false` with an error message if logout fails.
   */
  router.register('auth.logout', async ({ id = undefined } = {}) => {
    try {
      await core.accounts.logout()
      return { id, ok: true }
    } catch (err) {
      logger.error('Logout failed:', err)
      return { id, ok: false, error: err.message }
    }
  })
}
