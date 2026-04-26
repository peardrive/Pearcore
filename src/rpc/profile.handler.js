import { logger } from '../logger.js';

export function registerProfileHandlers(router, core) {

  router.register('profile.list', async ({ id = undefined, ...options } = {}) => {
    try {
      core.accounts.loginRequired()

      const profiles = await core.profile.list(options);
      return { id, ok: true, profiles };
    } catch (err) {
      logger.error("[RPC] profile.state failed:", err.message);
      return { id, ok: false, error: err.message };
    }
  });

  // Handler to get the current user's profile state
  router.register('profile.state', async ({ id = undefined } = {}) => {
    try {
      core.accounts.loginRequired()

      const profile = await core.profile.getCurrentProfile();
      return { id, ok: true, profile };
    } catch (err) {
      logger.error("[RPC] profile.state failed:", err.message);
      return { id, ok: false, error: err.message };
    }
  });

  // Handler to update the current user's profile
  router.register('profile.update', async ({ id = undefined, ...params } = {}) => {
    try {
      core.accounts.loginRequired()

      const updatedProfile = await core.profile.update(params);
      return { id, ok: true, profile: updatedProfile };
    } catch (err) {
      logger.error("[RPC] profile.update failed:", err.message);
      return { id, ok: false, error: err.message };
    }
  });
}
