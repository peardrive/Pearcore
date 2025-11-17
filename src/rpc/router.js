export function createRouter() {
  const routes = new Map()
  return {
    register: (method, handler) => routes.set(method, handler),
    async dispatch(msg, ctx) {
      const { id, method, params } = msg
      if (!routes.has(method)) return { id, error: 'Unknown method' }
      try {
        const result = await routes.get(method)(params, ctx)
        return { id, result }
      } catch (err) {
        return { id, error: err.message || String(err) }
      }
    }
  }
}
