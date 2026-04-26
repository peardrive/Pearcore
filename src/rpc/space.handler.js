export function registerSpaceHandlers(router, core) {
    router.register('space.state', async ({ id = undefined } = {}) => {
        try {
            core.accounts.loginRequired();
            return { id, ok: true, state: core.space.getState() };
        } catch (err) {
            return { id, ok: false, error: err.message || "Failed to get space state" };
        }
    })

    // List all spaces, optionally filtered by publicKey
    router.register('space.list', async ({ id = undefined, ...params } = {}) => {
        try {
            core.accounts.loginRequired();
            const spaces = await core.space.list(params);

            return { id, ok: true, spaces };
        } catch (err) {
            return { id, ok: false, error: err.message || "Failed to list spaces" };
        }
    })

    // Create a new space with permissions
    router.register('space.create', async ({ id = undefined, ...params } = {}) => {
        try {
            core.accounts.loginRequired();
            const result = await core.space.create(params);

            return { id, ok: true, ...result };
        } 
        catch (err) {
            return { id, ok: false, error: err.message || "Failed to create space" };
        }
    })

    router.register('space.join', async ({ id = undefined, ...params } = {}) => {
        try {
            core.accounts.loginRequired();
            const spaceInfo = await core.space.join(params.shareLink);

            return { id, ok: true, space: spaceInfo || null };
        } 
        catch (err) {
            return { id, ok: false, error: err.message || "Failed to join space" };
        }
    })

    router.register('space.leave', async (_ = {}) => ({ ok: false, error: "Not implemented" }))
}
