/*
 * Session state manager used by daemon service 
 * to manage authentication and node connection
 */

export class SessionState {
  constructor() {
    this.reset()
  }

  reset() {
    this.authenticated = false
    this.username = null
    this.publicKey = null
    this.secretKey = null
    this.swarm = null
  }

  setCredentials({ username, publicKey, secretKey }) {
    this.authenticated = true
    this.username = username
    this.publicKey = publicKey
    this.secretKey = secretKey
  }

  attachSwarm(swarm) {
    this.swarm = swarm
  }

  logout() {
    this.reset()
  }
}

export const session = new SessionState()
