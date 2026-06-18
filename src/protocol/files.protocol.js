import * as EVENTS from '../constants/events.constants.js';
import * as MESSAGES from '../constants/messages.constants.js';
import { hex } from '../utils/crypto.utils.js';
import { BaseProtocolHandler } from "./base.js";
import { publicKeyIsAllowedToBroadcast, publicKeyIsAllowedToRead } from '../utils/policy.utils.js';
import { SpaceFileAction, SpaceFileActionOptions } from '../constants/events.constants.js';
import {
    createSpaceFileEventMessage,
    validateSpaceFileEventPayload,
    verifySpaceFileEvent,
    verifySpaceFileRecordSignature
} from '../utils/protocol.utils.js';


export class SpaceFileEventHandler extends BaseProtocolHandler {

    /**
     * Filter file records by the signatrue.
     * @param {string} topic - Space topic hash
     * @param {Array} recordStack - File list stack
     * @returns {Promise<Array>} Resolves when all signatures has been processed.
     */
    async filterVerifiedRecords(topic, recordStack) {
        const verifiedRecords = [];

        for (const record of recordStack) {
            const [path, publicKey, timestamp, rootHash, signature] = record;

            const result = await verifySpaceFileRecordSignature({
                topic,
                path,
                publicKey,
                timestamp,
                rootHash,
                signature
            });

            if (result) { verifiedRecords.push(record); }
            else { console.log('signatrue failed for: ', record) }
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

        const { isValid: payloadIsValid, reason } = validateSpaceFileEventPayload(message);

        if (!payloadIsValid) {
            await this.messageManager.reject(socket, message, reason);
            return;
        }

        const eventStack = [];

        for (const event of message.payload) {
            const { action, files } = event;
            const records = await this.filterVerifiedRecords(message.topic, files);
            const fileList = this.spaceFileListManager.convertStackToList(records);

            const diff = this.spaceFileListManager.diff({
                topic: message.topic,
                fileList: fileList,
                mode: action
            });

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
        this.emit(EVENTS.SpaceFileEvent, message);

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


export class SpaceFileTreeRequest extends BaseProtocolHandler {
    async handle(socket, message, topic) {
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

    }
}