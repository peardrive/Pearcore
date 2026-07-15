import * as EVENTS from '../constants/events.constants.js';
import * as MESSAGES from '../constants/messages.constants.js';
import { hex } from '../utils/crypto.utils.js';
import { BaseProtocolHandler } from "./base.js";
import { parseFilePath } from '../utils/parsers.utils.js';
import { publicKeyIsAllowedToBroadcast, publicKeyIsAllowedToRead } from '../utils/policy.utils.js';
import { SpaceFileAction, SpaceFileActionOptions } from '../constants/events.constants.js';
import {
    verifySpaceFileEvent,
    createSpaceFileEventMessage,
    validateSpaceFileEventPayload,
    verifySpaceFileRecordSignature,
    validateSpaceFileTreeRequestPayload,
    createSpaceFileTreeResponseMessage,
    validateSpaceFileTreeResponsePayload,
} from '../utils/protocol.utils.js';
import { getDownloadRecord, getFileTreeRecord, queryFileRegistryRecords } from '../utils/files.utils.js';
import { verifyMerkleTree } from '../utils/merkletree.utils.js';


export class SpaceFileEventHandler extends BaseProtocolHandler {

    /**
     * Filter file records by the signatrue and permission.
     * @param {object} space - The space record
     * @param {string} topic - Space topic hash
     * @param {Array} recordStack - File list stack
     * @returns {Promise<Array>} Resolves when all signatures has been processed.
     */
    async filterVerifiedRecords(space, topic, recordStack) {
        const verifiedRecords = [];

        for (const record of recordStack) {
            const [path, publicKey, timestamp, rootHash, signature] = record;

            // ensure records are authorized
            if (!publicKeyIsAllowedToBroadcast(publicKey, space)) continue;

            const result = await verifySpaceFileRecordSignature({
                topic,
                path,
                publicKey,
                timestamp,
                rootHash,
                signature
            });

            if (result) { verifiedRecords.push(record); }
        }

        return verifiedRecords;
    }

    async handle(socket, message, info) {
        const topicMap = await this.storageManager.generateSpaceTopicHashMap();
        const space = topicMap[message.topic];

        if (!space) {
            await this.messageManager.reject(socket, message, MESSAGES.SPACE_NOT_FOUND_MESSAGE);
            return;
        }

        if (!publicKeyIsAllowedToBroadcast(message.publicKey, space)) {
            await this.messageManager.reject(socket, message, MESSAGES.BROADCAST_PERMISSION_NOT_ALLOWED_MESSAGE);
            return;
        }

        const senderPublicKey = hex(info.publicKey);
        if (!publicKeyIsAllowedToRead(senderPublicKey, space)) {
            await this.messageManager.reject(socket, message, MESSAGES.READ_PERMISSION_NOT_ALLOWED_MESSAGE);
            return;
        }

        const { isValid: payloadIsValid, reason } = validateSpaceFileEventPayload(message);

        if (!payloadIsValid) {
            await this.messageManager.reject(socket, message, reason);
            return;
        }

        const eventStack = [];

        for (const event of message.payload) {
            const { action, files } = event;
            const records = await this.filterVerifiedRecords(space, message.topic, files);
            const fileList = this.spaceFileListManager.convertStackToList(records);

            const diff = this.spaceFileListManager.diff({
                topic: message.topic,
                fileList: fileList,
                mode: action
            });

            if (Object.keys(diff).length === 0) continue;

            switch (action) {
                case EVENTS.SpaceFileEventOptions.ADD:

                    this.spaceFileListManager.merge({
                        topic: message.topic,
                        fileList: diff
                    });


                    if (Object.keys(diff).length > 0) {
                        const broadcastStack = this.spaceFileListManager.convertListToStack(diff);
                        eventStack.push({ action: action, files: broadcastStack });
                    }

                    break;

                case EVENTS.SpaceFileEventOptions.REMOVE:

                    diff.forEach(record => {
                        const [filepath, publicKey, timestamp, rootHash, signature] = record;

                        this.spaceFileListManager.remove({
                            topic: message.topic,
                            publicKey: publicKey,
                            path: filepath
                        });
                    });

                    if (Object.keys(diff).length > 0) {
                        const broadcastStack = this.spaceFileListManager.convertListToStack(diff);
                        eventStack.push({ action: action, files: broadcastStack });
                    }

                    break;
            }
        }

        // emit the received message before broadcasting the space
        this.emit(EVENTS.SpaceFileEvent, { info, message });

        if (eventStack.length > 0) {
            const { publicKey, secretKey } = this.sessionManager.getCredentials();

            const broadcastMessage = await createSpaceFileEventMessage({
                topic: message.topic,
                events: eventStack,
                publicKey: publicKey,
                secretKey: secretKey,
            });

            const senderPublicKey = hex(info.publicKey);

            const peers = this.socketManager.getPeerKeys(publicKey => {
                return publicKeyIsAllowedToRead(publicKey, space) &&
                    publicKey !== senderPublicKey &&
                    publicKey !== message.publicKey;
            });
            const sockets = this.socketManager.getConnectedSockets({ peers: peers, topics: [message.topic] });
            await this.messageManager.broadcastMessageToSockets(broadcastMessage, sockets);
        }
    }
}


export class SpaceFileTreeRequestHandler extends BaseProtocolHandler {
    async handle(socket, message, info) {

        if (message.publicKey !== hex(info.publicKey)) {
            await this.messageManager.reject(socket, message, MESSAGES.NO_RELAY_MESSAGE);
            return;
        }

        const topicMap = await this.storageManager.generateSpaceTopicHashMap();
        const space = topicMap[message.topic];

        if (!space) {
            await this.messageManager.reject(socket, message, MESSAGES.SPACE_NOT_FOUND_MESSAGE);
            return;
        }

        if (!publicKeyIsAllowedToRead(message.publicKey, space)) {
            await this.messageManager.reject(socket, message, MESSAGES.BROADCAST_PERMISSION_NOT_ALLOWED_MESSAGE);
            return;
        }

        const { isValid: payloadIsValid, reason } = validateSpaceFileTreeRequestPayload(message);

        if (!payloadIsValid) {
            await this.messageManager.reject(socket, message, reason);
            return;
        }

        const { spaceFilePath, rootHash } = message.payload;
        const parsedSpacePath = parseFilePath(spaceFilePath);

        const registryQuery = await queryFileRegistryRecords(this.db, {
            rootHash: rootHash,
            spacePath: parsedSpacePath.dir,
            spaceFilename: parsedSpacePath.filename,
        });

        if (registryQuery.length === 0) {
            await this.messageManager.reject(socket, message, MESSAGES.SPACE_FILE_NOT_FOUND);
            return;
        }

        const registry = registryQuery[0];
        const tree = await getFileTreeRecord(this.db, registry.id);

        let lastRequestableLeaf = 0;

        const downloadRecord = await getDownloadRecord(this.db, registry.id);

        if (downloadRecord) {
            lastRequestableLeaf = downloadRecord.lastPushedLeaf + 1; // index + 1 
        }
        else {
            lastRequestableLeaf = registry.leafCount;
        }

        const { publicKey, secretKey } = this.sessionManager.getCredentials();
        const response = await createSpaceFileTreeResponseMessage({
            topic: message.topic,
            tree: tree,
            lastRequestableLeaf: lastRequestableLeaf,
            replyNonce: message.nonce,
            publicKey: publicKey,
            secretKey: secretKey
        });

        this.emit(EVENTS.SpaceFileTreeRequest, { info, message });
        await this.messageManager.sendMessageToSocket(response, socket);
    }
}


export class SpaceFileTreeResponseHandler extends BaseProtocolHandler {
    async handle(socket, message, info) {
        if (message.publicKey !== hex(info.publicKey)) {
            await this.messageManager.reject(socket, message, MESSAGES.NO_RELAY_MESSAGE);
            return;
        }

        const topicMap = await this.storageManager.generateSpaceTopicHashMap();
        const space = topicMap[message.topic];

        if (!space) {
            await this.messageManager.reject(socket, message, MESSAGES.SPACE_NOT_FOUND_MESSAGE);
            return;
        }

        if (!publicKeyIsAllowedToRead(message.publicKey, space)) {
            await this.messageManager.reject(socket, message, MESSAGES.BROADCAST_PERMISSION_NOT_ALLOWED_MESSAGE);
            return;
        }

        const validationResult = validateSpaceFileTreeResponsePayload(message);

        if (!validationResult.isValid) {
            await this.messageManager.reject(socket, message, reason);
            return;
        }

        const verificationResult = verifyMerkleTree(message.payload.tree);
        
        if (!verificationResult.isValid) {
            await this.messageManager.reject(socket, message, verificationResult.reason);
        }

        this.emit(EVENTS.SpaceFileTreeResponse, { info, message });
    }
}