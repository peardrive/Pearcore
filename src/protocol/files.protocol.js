import * as MESSAGES from '../constants/messages.constants.js';
import { BaseProtocolHandler } from "./base.js";
import { SpaceFileAction, SpaceFileActionOptions } from '../constants/events.constants.js';
import { publicKeyIsAllowedToRead } from '../utils/policy.utils.js';
import { hex } from '../utils/crypto.utils.js';
import fs, { createReadStream } from 'fs';
import { FrameTypes } from '../managers/multiplexer.manager.js';

export class SpaceFileActionHandler extends BaseProtocolHandler {
    async handle(socket, message, info) {
        try {
            const { action, context } = message.payload;
            const record = {
                topic: message.topic,
                spaceFilePath: context.spaceFilePath,
                info: {
                    publicKey: message.publicKey,
                    rootHash: context.rootHash
                }
            }

            switch (action) {
                case SpaceFileActionOptions.ADD:
                    this.spaceFileListManager.addFile(record);
                    break;

                case SpaceFileActionOptions.DELETE:
                    this.spaceFileListManager.removeFile(record);
                    break;

                case SpaceFileActionOptions.SYNC:
                    this.spaceFileListManager.mergeHierarchy(message.topic, context);
                    break;

                default:
                    await this.messageManager.reject(socket, message, MESSAGES.INTERNAL_ERROR_MESSAGE);
                    return;
            }

            this.emit(SpaceFileAction, message);

            const topicMap = await this.storageManager.generateSpaceTopicHashMap();
            const messageTopic = message.topic;
            const space = topicMap[messageTopic];

            if (!space) {
                await this.messageManager.reject(socket, message, MESSAGES.SPACE_NOT_FOUND_MESSAGE);
                return;
            }

            const peers = this.socketManager.getPeerKeys(key => {
                return publicKeyIsAllowedToRead(key, space) &&
                    key != message.publicKey &&
                    key != hex(info.publicKey)
            });

            const sockets = this.socketManager.getConnectedSockets({
                peers: peers, topics: [message.topic]
            });

            return await this.messageManager.broadcastMessageToSockets(message, sockets);
        }

        catch (error) { console.error(error) }
    }
}

export class SpaceFileRequestHandler extends BaseProtocolHandler {
    async handle(socket, message, info) {
        const { taskKey, rootHash, spaceFilePath } = message.payload;
        const requesterPublicKey = hex(info.publicKey);

        const topicMap = await this.storageManager.generateSpaceTopicHashMap();
        const messageTopic = message.topic;
        const space = topicMap[messageTopic];

        if (!publicKeyIsAllowedToRead(requesterPublicKey, space)) {
            // Optionally send an error JSON message
            await this.messageManager.reject(socket, message, MESSAGES.READ_PERMISSION_NOT_ALLOWED_MESSAGE);
            return;
        }

        const recordQuery = await this.storageManager.queryFileRegistryRecords({ rootHash });
        if (recordQuery.length < 1) {
            await this.messageManager.reject(socket, message, 'no file record has been found');
            return;
        }

        const registry = recordQuery[0];
        const readStream = createReadStream(registry.fileSourcePath);
        const taskKeyBuf = Buffer.from(taskKey, 'utf8');
        const taskKeyLen = taskKeyBuf.length;
        const header = Buffer.allocUnsafe(1 + taskKeyLen);
        header[0] = taskKeyLen;
        taskKeyBuf.copy(header, 1);


        readStream.on('data', (chunk) => {
            const framePayload = Buffer.concat([header, chunk]);
            this.muxManager.send(socket, framePayload, FrameTypes.STREAM).catch(err => {
                console.error('Error sending STREAM frame:', err);
                readStream.destroy();
            });
        });

        readStream.on('end', () => {
            // Send zero-length chunk to signal EOF
            const eofPayload = Buffer.concat([header, Buffer.alloc(0)]);
            this.muxManager.send(socket, eofPayload, FrameTypes.STREAM).catch(console.error);
        });

        readStream.on('error', (err) => {
            console.error(`File read error for rootHash ${rootHash}:`, err);
            // Optionally send error JSON
            this.muxManager.send(socket, JSON.stringify({
                type: 'FILE_REQUEST_ERROR',
                payload: { taskKey, error: err.message }
            }), FrameTypes.JSON).catch(console.error);
        });
    }
}