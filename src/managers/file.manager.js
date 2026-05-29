import path from "path";
import { SpaceFileActionOptions } from '../constants/events.constants.js';
import { fileExists } from "../utils/system.utils.js";
import { createWatcher, WatchTypes } from "../utils/files.utils.js";
import { getSpaceTopicHash } from "../utils/space.utils.js";
import { createSpaceFileAction, createSpaceFileRequest } from "../utils/protocol.utils.js";
import { publicKeyIsAllowedToBroadcast, publicKeyIsAllowedToRead } from "../utils/policy.utils.js";
import crypto from 'crypto';
import fs from 'fs';

export class SpaceFileListManager {
    constructor(managers) {
        this.storageManager = managers.storageManager;
        this.sessionManager = managers.sessionManager;

        this.fileListMap = {};
    }

    getFileList(topic) {
        return this.fileListMap[topic] || {};
    }

    clear() {
        this.fileListMap = {};
    }

    /**
     * Add new file record to hierarcy.
     * @param {Object} record 
     * @param {string} record.topic - Space topic hash
     * @param {string} record.spaceFilePath - Full space file path (spacePath + spaceFilename)
     * @param {Object} record.info - Peer info including identity and file hash.
     * @param {string} record.info.publicKey - Peer's publicKey.
     * @param {string} record.info.rootHash - The root hash of the file record from Merkle Tree.
     */
    addFile(record) {
        const { topic, spaceFilePath, info } = record;

        this.removeFile(record);

        if (!this.fileListMap[topic]) {
            this.fileListMap[topic] = {};
        }

        const hierarchy = this.fileListMap[topic];

        if (!hierarchy[spaceFilePath]) {
            hierarchy[spaceFilePath] = [];
        }

        const variants = hierarchy[spaceFilePath];
        let targetVariant = variants.find(v => v.rootHash === info.rootHash);

        if (!targetVariant) {
            targetVariant = { rootHash: info.rootHash, peers: [] };
            variants.push(targetVariant);
        }

        if (!targetVariant.peers.includes(info.publicKey)) {
            targetVariant.peers.push(info.publicKey);
        }
    }

    /**
     * Remove peer as provider from single file's provider list.
     * @param {Object} record 
     * @param {string} record.topic - Space topic hash
     * @param {string} record.spaceFilePath - Full space file path (spacePath + spaceFilename)
     * @param {Object} record.info - Peer info including identity and file hash.
     * @param {string} record.info.publicKey - Peer's publicKey.
     * @param {string} record.info.rootHash - The root hash of the file record from Merkle Tree.
     */
    removeFile(record) {
        const { topic, spaceFilePath, info } = record;

        if (!this.fileListMap[topic]) return;

        const hierarchy = this.fileListMap[topic];

        if (!hierarchy[spaceFilePath]) return;

        const variants = hierarchy[spaceFilePath];
        const newVariants = [];

        for (const variant of variants) {
            const newPeers = variant.peers.filter(pk => pk !== info.publicKey);
            if (newPeers.length > 0) {
                newVariants.push({ ...variant, peers: newPeers });
            }
        }

        if (newVariants.length > 0) {
            hierarchy[spaceFilePath] = newVariants;
        } else {
            delete hierarchy[spaceFilePath];
        }
    }

    /**
     * Merge a remote file hierarchy into the local hierarchy.
     * @param {Object} remoteHierarchy - The remote hierarchy to merge.
     */
    mergeHierarchy(topic, remoteHierarchy) {
        const entries = Object.entries(remoteHierarchy);
        for (const [spaceFilePath, variants] of entries) {
            // add all variants one by one
            for (const variant of variants) {
                if (!variant.peers) continue;

                for (const publicKey of variant.peers) {
                    this.addFile({
                        topic: topic,
                        spaceFilePath,
                        info: {
                            publicKey,
                            rootHash: variant.rootHash
                        }
                    });
                }
            }
        }
    }
}

export class SpaceFileManager {
    constructor(managers) {
        this.sessionManager = managers.sessionManager;
        this.storageManager = managers.storageManager;
        this.socketManager = managers.socketManager;
        this.messageManager = managers.messageManager;
        this.spaceFileListManager = managers.spaceFileListManager;

        this.watcher = null;
        this.activeDownloads = new Map();
    }

    async init() {
        const { publicKey } = this.sessionManager.getCredentials();
        const registryRecords = await this.storageManager.listFileRecords();

        const filesToWatch = [];

        for (const record of registryRecords) {

            // delete all records that are no longer available
            const exists = await fileExists(record.fileSourcePath);
            if (!exists) {
                await this.storageManager.deleteFileRecords(record);
                continue;
            }

            const space = await this.storageManager.getSpaceFromFileRecord(record);
            const topicHash = getSpaceTopicHash(space);

            const spaceFilePath = path.posix.join(record.spacePath, record.spaceFilename);
            this.spaceFileListManager.addFile({
                topic: topicHash,
                spaceFilePath: spaceFilePath,
                info: {
                    publicKey: publicKey,
                    rootHash: record.rootHash
                }
            });

            filesToWatch.push(record.fileSourcePath);
        }

        this.watcher = createWatcher(filesToWatch);

        this.watcher.on(WatchTypes.CHANGE,
            async filePath => await this.handleLocalFileEvent(filePath, 'change'));

        this.watcher.on(WatchTypes.DELETE,
            async filePath => await this.handleLocalFileEvent(filePath, 'remove'));
    }

    async stop() {
        if (this.watcher) {
            await this.watcher.close();
        }
    }

    async handleLocalFileEvent(filePath, action) {
        const registryRecords = await this.storageManager.queryFileRegistryRecords({ fileSourcePath: filePath });

        switch (action) {
            case 'change':
                for (const record of registryRecords) {
                    const space = await this.storageManager.getSpaceFromFileRecord(record);
                    await this.deleteLocalFile(space, { filePath });
                    await this.addLocalFile(space, {
                        filePath,
                        spacePath: record.spacePath,
                        spaceFilename: record.spaceFilename,
                    });
                }

                return;

            case 'remove':
                for (const record of registryRecords) {
                    const space = await this.storageManager.getSpaceFromFileRecord(record);
                    await this.deleteLocalFile(space, { filePath });
                }

                return;
        }
    }

    /**
     * Handle incoming Stream frames from multiplexer.
     * @param {Object} socket - Socket connection
     * @param {Buffer} payload - Stream payload
     * @param {Object} info - Hyperswarm info object
     */
    async handleIncomingStream(socket, payload, info) {
        // avoid empty streams
        if (payload.length < 1) return;

        const taskKeyLen = payload[0];
        // rare condition. should not happen.
        if (payload.length < 1 + taskKeyLen) return;

        const taskKey = payload.subarray(1, 1 + taskKeyLen).toString();
        const chunk = payload.subarray(1 + taskKeyLen);

        const download = this.activeDownloads.get(taskKey);
        if (!download) {
            console.error(`Received stream from unkown taskKey ${taskKey}`);
            return;
        }

        if (chunk.length === 0) {
            download.writeStream.end();
            download.resolve();
            this.activeDownloads.delete(taskKey);
        }

        else {
            download.writeStream.write(chunk, (error) => {
                if (error) {
                    download.reject(error);
                    download.writeStream.destroy();
                    this.activeDownloads.delete(taskKey);
                }
            })
        }
    }

    async addLocalFile(space, { filePath, spacePath, spaceFilename }) {
        const exists = await fileExists(filePath);
        if (!exists) {
            throw new Error('File does not exists');
        }

        const { publicKey, secretKey } = this.sessionManager.getCredentials();

        if (!publicKeyIsAllowedToBroadcast(publicKey, space)) {
            throw new Error('Peer is not allowed to broadcast into this space');
        }

        const rootHash = await this.storageManager.createFileRecord({
            space,
            filePath,
            spacePath,
            spaceFilename,
        });

        const topicHash = getSpaceTopicHash(space);
        const spaceFilePath = path.posix.join(spacePath, spaceFilename);

        this.spaceFileListManager.addFile({
            topic: topicHash,
            spaceFilePath: spaceFilePath,
            info: { publicKey, rootHash }
        });

        this.watcher.add(filePath);

        const message = await createSpaceFileAction({
            topic: topicHash,
            action: SpaceFileActionOptions.ADD,
            context: { spaceFilePath, rootHash },
            publicKey: publicKey,
            secretKey: secretKey
        });

        const peers = this.socketManager.getPeerKeys(key => publicKeyIsAllowedToRead(key, space));
        const sockets = this.socketManager.getConnectedSockets({
            peers: peers, topics: [topicHash]
        });

        return await this.messageManager.broadcastMessageToSockets(message, sockets);
    }

    async deleteLocalFile(space, { filePath }) {
        // delete registry records from database
        const records = await this.storageManager.deleteFileRecords(filePath);
        this.watcher.unwatch(filePath);

        const topicHash = getSpaceTopicHash(space);
        const { publicKey, secretKey } = this.sessionManager.getCredentials();

        if (!publicKeyIsAllowedToBroadcast(publicKey, space)) {
            throw new Error('Peer is not allowed to broadcast into this space');
        }

        // remove from space file hierarchy
        const broadcastResults = [];
        for (const record of records) {
            const { spacePath, spaceFilename, rootHash } = record;
            const spaceFilePath = path.posix.join(spacePath, spaceFilename);

            this.spaceFileListManager.removeFile({
                topic: topicHash,
                spaceFilePath: spaceFilePath,
                info: { publicKey, rootHash }
            });

            const message = await createSpaceFileAction({
                topic: topicHash,
                action: SpaceFileActionOptions.DELETE,
                context: { spaceFilePath, rootHash },
                publicKey: publicKey,
                secretKey: secretKey
            });

            const peers = this.socketManager.getPeerKeys(key => publicKeyIsAllowedToRead(key, space));
            const sockets = this.socketManager.getConnectedSockets({
                peers: peers, topics: [topicHash]
            });

            const result = await this.messageManager.broadcastMessageToSockets(message, sockets);
            broadcastResults.push(result);
        }

        return broadcastResults;
    }

    async downloadFromSpace(space, spaceFilePath, rootHash, destination) {
        const topic = getSpaceTopicHash(space);
        const fileList = this.spaceFileListManager.getFileList(topic);
        const variants = fileList[spaceFilePath];

        if (!variants) {
            throw new Error(`no provider found for ${spaceFilePath}`);
        }

        const variant = variants.find(v => v.rootHash === rootHash);
        if (!variant || variant.peers.length === 0) {
            throw new Error(`No provider found for rootHash ${rootHash}`);
        }

        const providerPublicKey = variant.peers[0];
        const sockets = this.socketManager.getConnectedSockets({
            peers: [providerPublicKey],
            topics: [topic]
        });

        if (sockets.length === 0) {
            throw new Error(`No active connection to provider node [${providerPublicKey}]`);
        }

        const socket = sockets[0];
        const taskKey = crypto.randomBytes(16).toString('hex');

        const writeStream = fs.createWriteStream(destination);
        const downloadPromise = new Promise((resolve, reject) => {
            this.activeDownloads.set(taskKey, {
                writeStream,
                resolve,
                reject,
                destination
            });
        });

        const { publicKey, secretKey } = this.sessionManager.getCredentials();
        const message = await createSpaceFileRequest({
            topic: topic,
            taskKey: taskKey,
            rootHash: rootHash,
            spaceFilePath: spaceFilePath,
            publicKey: publicKey,
            secretKey: secretKey
        });

        await this.messageManager.sendMessageToSocket(message, socket);
        return downloadPromise;
    }
}