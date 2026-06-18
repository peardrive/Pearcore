import { verifySignedJSON } from "../utils/crypto.utils";

/**
 * Manages file availability metadata for space.
 * 
 * This class maintains a nested map that tracks which peers provide which
 * file variants (identified by Merkle root hashes) within a space. Each
 * file path can have multiple variants, but a given public key may appear
 * in at most one variant per path. 
 * 
 * Timestamps are used to resolve conflicts: an incoming record is only 
 * applied if its timestamp is strictly greater than the locally
 * stored timestamp. The local node is considered the sole authority 
 * for its own public key; any external claim about the local key is ignored during
 * merges.
 * 
 * @example
 * const sessionManager = new sessionManager();
 * const manager = new SpaceFileListManager({ sessionManager });
 *
 * // Peer A announces file "/doc.txt" with variant "abc" at timestamp 1000
 * manager.add({
 *   topic: 'space1',
 *   path: '/doc.txt',
 *   rootHash: 'abc',
 *   publicKey: 'A',
 *   timestamp: 1000,
 *   signature: '...'
 * });
 * 
 * // A later moves to variant "def" (timestamp 2000)
 * manager.add({
 *   topic: 'space1',
 *   path: '/doc.txt',
 *   rootHash: 'def',
 *   publicKey: 'A',
 *   timestamp: 2000,
 *   signature: '...'
 * });
 * 
 * // Now "/doc.txt" only lists variant "def" with peer "A" (timestamp 2000).
 *
 * // Removing peer A (unconditional, no timestamp needed)
 * manager.remove({ topic: 'space1', path: '/doc.txt', publicKey: 'A' });
 *
 * // Merge a remote file list (e.g. received via gossip)
 * manager.merge({
 *   topic: 'space1',
 *   fileList: {
 *     '/doc.txt': {
 *       'xyz': { peers: { 'B': { timestamp: 2000, signature: '...' } } }
 *     }
 *   }
 * });
 *
 * // Query the current state
 * console.log(manager.get('space1'));
 */
export class SpaceFileListManager {
    constructor(emitter, managers) {
        this.sessionManager = managers.sessionManager;

        this.spaceFileMap = {};
    }

    /**
     * Get space's file list using space topic hash
     * @param {string} topic 
     * @returns {Object}
     */
    get(topic) {
        return this.spaceFileMap[topic] || {};
    }

    clear() {
        this.spaceFileMap = {};
    }

    /**
     * Convert the list structure for into a stack (flat array).
     * @param {Object} spaceFiles - Space file list.
     * @returns {Array<Object>} Stack array of { filepath, publickey, timestamp, rootHash, signature }
     */
    convertListToStack(spaceFiles) {
        const stack = [];

        for (const [filepath, variants] of Object.entries(spaceFiles)) {

            for (const [rootHash, variant] of Object.entries(variants)) {

                const peers = variant.peers || {};
                for (const [publicKey, info] of Object.entries(peers)) {
                    const { timestamp, signature } = info;

                    stack.push([filepath, publicKey, timestamp, rootHash, signature]);
                }
            }

        }

        return stack;
    }

    /**
     * Convert a stack (flat array) into a list structure for a given topic.
     * @param {Array<Object>} stack - Stack array of { filepath, publickey, timestamp, rootHash, signature }.
     * @returns {Object} List structure ready to be used with merge() or diff().
     */
    convertStackToList(stack) {
        const fileList = {};

        for (const entry of stack) {
            const [filepath, publicKey, timestamp, rootHash, signature] = entry;

            if (!fileList[filepath]) fileList[filepath] = {};
            if (!fileList[filepath][rootHash]) {
                fileList[filepath][rootHash] = { peers: {} };
            }

            const variant = fileList[filepath][rootHash];
            const existing = variant.peers[publicKey];

            if (!existing || timestamp > existing.timestamp) {
                variant.peers[publicKey] = { timestamp, signature };
            }
        }

        return fileList;
    }

    /**
     * Add a new file registry to the space.
     * @param {Object} context 
     * @param {string} context.topic - Space topic hash
     * @param {string} context.path - Space file path
     * @param {string} context.rootHash - File's merkle tree root hash
     * @param {string} context.publicKey - Peer publicKey
     * @param {Number} context.timestamp - File's action event timestamp 
     */
    add(context) {
        const { topic, path, rootHash, publicKey, timestamp, signature } = context;

        // get space file list, create object map if not exists
        if (!this.spaceFileMap[topic]) { this.spaceFileMap[topic] = {}; }
        const spaceFiles = this.spaceFileMap[topic];

        // file path does not exists in the map
        // register the path and add the provider
        if (!spaceFiles[path]) {
            spaceFiles[path] = {
                [rootHash]: {
                    peers: { [publicKey]: { timestamp, signature } }
                }
            };

            return;
        }

        const variants = spaceFiles[path];

        // remove the peer as provider of other variants of the file path
        for (const [existingRootHash, variant] of Object.entries(variants)) {
            if (existingRootHash !== rootHash && publicKey in variant.peers) {
                // avoid the action if local timestamp is newer
                const currentTimestamp = variant.peers[publicKey].timestamp;
                if (currentTimestamp >= timestamp) return;

                delete variant.peers[publicKey];

                if (Object.keys(variant.peers).length === 0) {
                    delete variants[existingRootHash];
                }

                break;
            }
        }

        if (!variants[rootHash]) {
            variants[rootHash] = {
                peers: { [publicKey]: { timestamp, signature } }
            };

            return;
        }

        const variant = variants[rootHash];
        const existingEntry = variant.peers[publicKey];

        if (existingEntry && existingEntry.timestamp >= timestamp) return;

        // update the provider registry timestamp
        variant.peers[publicKey] = { timestamp, signature };
    }

    /**
     * Remove publicKey as a provider for file path
     * @param {Object} context 
     * @param {string} context.topic - Space topic hash
     * @param {string} context.path - Space file path
     * @param {string} context.publicKey - Peer publicKey
     */
    remove(context) {
        const { topic, path, publicKey } = context;
        const spaceFiles = this.spaceFileMap[topic];
        if (!spaceFiles) return;

        const variants = spaceFiles[path];
        if (!variants) return;

        for (const [rootHash, variant] of Object.entries(variants)) {
            if (publicKey in variant.peers) {
                delete variant.peers[publicKey];

                // delete the variant if no provider has left after delettion
                if (Object.keys(variant.peers).length === 0) {
                    delete variants[rootHash];
                }

                break;
            }
        }

        // cleanup file path if no variant has been left
        if (Object.keys(variants).length === 0) {
            delete spaceFiles[path];
        }

        // remove topic from the map if left empty
        if (Object.keys(spaceFiles).length === 0) {
            delete this.spaceFileMap[topic];
        }
    }

    /**
     * Merge external space file list with the internal record.
     * @param {Object} context 
     * @param {string} context.topic - Space topic hash.
     * @param {Object} context.fileList - External space file list for merge
     */
    merge(context) {
        const { topic, fileList } = context;
        const { publicKey: localPublicKey } = this.sessionManager.getCredentials();

        for (const [path, variants] of Object.entries(fileList)) {
            for (const [rootHash, variant] of Object.entries(variants)) {
                // skip if the provider list is empty
                if (!variant.peers) continue;

                for (const [publicKey, info] of Object.entries(variant.peers)) {
                    const { timestamp, signature } = info;
                    // add the provider registry only if it's foreign publicKey
                    if (publicKey !== localPublicKey) {
                        this.add({ topic, path, rootHash, publicKey, timestamp, signature });
                    }
                }
            }
        }
    }

    /**
     * Creates new file list that is the substraction of remote and local file list.
     * @param {Object} context 
     * @param {string} context.topic - Space topic hash.
     * @param {Object} context.fileList - External space file list for substraction
     * @returns {Object} Returns substracted file list.
     */
    diff(context) {
        const { topic, fileList, mode = 'add' } = context;
        const { publicKey: localPublicKey } = this.sessionManager.getCredentials();

        const localSpace = this.spaceFileMap[topic] || {};

        const diffResult = {};

        for (const [path, remoteVariants] of Object.entries(fileList)) {
            const localPath = localSpace[path];

            for (const [rootHash, remoteVariant] of Object.entries(remoteVariants)) {
                const localVariant = localPath?.[rootHash];
                const remotePeers = remoteVariant.peers || {};

                const relevantPeers = {};

                for (const [publicKey, remoteInfo] of Object.entries(remotePeers)) {
                    if (publicKey === localPublicKey) continue;

                    const localPeerInfo = localVariant?.peers?.[publicKey];
                    const localTimestamp = localPeerInfo?.timestamp ?? null;

                    if (mode === 'add') {
                        // include only if peer is missing or remote timestamp is newer
                        if (!localPeerInfo || remoteInfo.timestamp > localTimestamp) {
                            relevantPeers[publicKey] = { ...remoteInfo };
                        }
                    }

                    if (mode === 'remove') {
                        if (localPeerInfo && remoteInfo.timestamp > localTimestamp) {
                            relevantPeers[publicKey] = { ...remoteInfo };
                        }
                    }
                }

                if (Object.keys(relevantPeers).length > 0) {
                    // create the file path object if not already exists
                    if (!diffResult[path]) { diffResult[path] = {}; }
                    diffResult[path][rootHash] = { peers: relevantPeers };
                }
            }
        }

        return diffResult;
    }
}

export class SpaceFileManager {
    constructor(emitter, managers) {}
    async handleIncomingStream(socket, data, info) {}
}