import { validateHexString } from "./general.utils.js";

/**
 * Checks if the space has requirements for message encryption.
 * @param {Object} space - The space object
 * @returns {boolean} True if the space object meets the criteria.
 */
export function spaceShouldEncryptMessages(space) {
    return !space.permissionRead &&
        space.readWhitelist.length > 0 &&
        typeof space.secret === 'string' &&
        validateHexString(space.secret);
}

/**
 * Checks if a publicKey is allowed to read from a space
 * @param {String} publicKey - The publicKey to check permission
 * @param {Object} space - The space object containing permission settings
 * @returns {boolean} True if the publicKey is allowed to read, false otherwise
 */
export function publicKeyIsAllowedToRead(publicKey, space) {
    if (space.publicKey === publicKey) return true;
    if (space.permissionRead) return true;
    if (space.readWhitelist.includes(publicKey)) return true;

    return false;
}

/**
 * Checks if a publicKey is allowed to broadcast into a space
 * @param {String} publicKey - The publicKey to check permission
 * @param {Object} space - The space object containing permission settings
 * @returns {boolean} True if the publicKey is allowed to broadcast message, false otherwise
 */
export function publicKeyIsAllowedToBroadcast(publicKey, space) {
    if (space.publicKey === publicKey) return true;
    if (space.permissionBroadcast) return true;
    if (space.broadcastWhitelist.includes(publicKey)) return true;

    return false;
}