/**
 * Factory function to create a session manager for a single user.
 * Maintains session state including authentication credentials, swarm reference, and optional root path.
 */
export function createSession() {
  let state = {
    authenticated: false,
    username: null,
    publicKey: null,
    secretKey: null,
    swarm: null,
    rootPath: null
  }

  return {
    get: () => state,

    setCredentials: ({ username, publicKey, secretKey }) => {
      state = { ...state, authenticated: true, username, publicKey, secretKey }
    },

    attachSwarm: (swarm) => {
      state.swarm = swarm
    },

    clear: () => {
      state = {
        authenticated: false,
        username: null,
        publicKey: null,
        secretKey: null,
        swarm: null,
        rootPath: null
      }
    },

    getCredentials: () => {
      if (!state.authenticated) return null
      return {
        username: state.username,
        publicKey: state.publicKey,
        secretKey: state.secretKey
      }
    },

    /**
     * Set the root path for accounts storage for this session.
     * @param {string} rootPath
     */
    setRootPath: (rootPath) => {
      state.rootPath = rootPath
    },

    /**
     * Get the root path currently set for this session.
     * Returns null if not set.
     * @returns {string|null}
     */
    getRootPath: () => state.rootPath
  }
}
