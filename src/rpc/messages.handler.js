import { parseSpaceTopic } from '../utils/parsers.utils.js';

export function registerMessageHandlers(router, core) {
    router.register('messages.get', async ({ id = undefined, ...options } = {}) => {
        try {
            core.accounts.loginRequired();
            const messages = await core.messages.list(options);
            return { id, ok: true, messages };
        } catch (err) {
            return { id, ok: false, error: err.message || "Failed to get space state" };
        }

    });

    router.register('messages.send', async ({ id = undefined, topic, message } = {}) => {
        try {
            core.accounts.loginRequired();
            const space = parseSpaceTopic(topic);
            const messages = await core.messages.send(space, message);
            return { id, ok: true, messages };
        } catch (err) {
            return { id, ok: false, error: err.message || "Failed to get space state" };
        }

    });

    router.register('messages.flush', async ({ id = undefined, ...options } = {}) => {
        try {
            core.accounts.loginRequired();
            const messages = await core.messages.flush(options);
            return { id, ok: true, messages };
        } catch (err) {
            return { id, ok: false, error: err.message || "Failed to get space state" };
        }

    });
}