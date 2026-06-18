import * as EVENTS from '../../src/constants/events.constants.js';
import * as MESSAGES from '../../src/constants/messages.constants.js';
import { describe, it, beforeEach, expect } from "vitest";
import { getSpaceTopicHash } from '../../src/utils/space.utils.js';
import { publicKeyIsAllowedToBroadcast } from '../../src/utils/policy.utils.js';
import { createSpaceFileEventMessage, createSpaceFileRecordSignature } from "../../src/utils/protocol.utils.js";
import { CoreFactory } from '../factory.js';
import { createP2PNetwork, createConnections, buildTestSpacePayload, unframeJson } from '../general.utils.js';

describe('Space File Protocols', () => {
    let primary = null;
    let secondary = null;
    let standby = null;
    let spaceParams = null;
    let spaceTopicHash = null;

    beforeEach(async () => {
        [primary, secondary, standby] = await createP2PNetwork(3);

        spaceParams = await buildTestSpacePayload({
            spaceName: 'TestSpace',
            publicKey: primary.publicKey,
            permissionRead: 0,
            permissionBroadcast: 0,
            readWhitelist: [primary.publicKey, secondary.publicKey, standby.publicKey],
            broadcastWhitelist: [secondary.publicKey],
        });

        const space = await primary.manager.storage.createSpace(spaceParams, primary.secretKey);
        await secondary.manager.storage.upsertSpace(space);
        await standby.manager.storage.upsertSpace(space);

        spaceTopicHash = getSpaceTopicHash(spaceParams);

        createConnections(spaceTopicHash, [primary, secondary, standby]);
    })

    describe('SpaceFileEventHandler', () => {

        const createRecord = async params => {
            const records = {
                path: '/file1.txt',
                timestamp: 1000,
                rootHash: 'rootHash1',
                ...params
            };

            const signature = await createSpaceFileRecordSignature(records);
            return { ...params, signature };
        };

        const toEvent = record => {
            return [
                record.path,
                record.publicKey,
                record.timestamp,
                record.rootHash,
                record.signature
            ];
        }

        it('should reject message from unknown space', async () => {
            const unkownTopic = "0x012345";
            const message = await createSpaceFileEventMessage({
                topic: unkownTopic,
                events: [],
                publicKey: secondary.publicKey,
                secretKey: secondary.secretKey
            });

            await secondary.manager.message.handleIncomingMessage(
                primary.socket,
                JSON.stringify(message),
                primary.info
            );

            const primaryCalls = primary.socket.write.mock.calls;
            expect(primaryCalls.length).toBe(1);

            const secondaryResponse = JSON.parse(unframeJson(primary.socket.write.mock.calls[0][0]));
            expect(secondaryResponse.payload.reason).toBe(MESSAGES.SPACE_NOT_FOUND_MESSAGE);
        });

        it('should reject when node is not allowed to broadcast', async () => {
            const message = await createSpaceFileEventMessage({
                topic: spaceTopicHash,
                events: [],
                publicKey: standby.publicKey,
                secretKey: standby.secretKey
            });

            await secondary.manager.message.handleIncomingMessage(
                primary.socket,
                JSON.stringify(message),
                primary.info
            );

            const primaryCalls = primary.socket.write.mock.calls;
            expect(primaryCalls.length).toBe(1);

            const rejection = JSON.parse(unframeJson(primaryCalls[0][0]));
            expect(rejection.payload.reason).toBe(MESSAGES.BROADCAST_PERMISSION_NOT_ALLOWED_MESSAGE);
        });

        it('should broadcast the event stack while duplicates are removed and locally stored events are dropped', async () => {
            const fileOneRecord = await createRecord({
                topic: spaceTopicHash,
                path: '/file1.txt',
                rootHash: 'hash1',
                timestamp: 1000,
                publicKey: secondary.publicKey,
                secretKey: secondary.secretKey
            });

            const fileOneRenewalRecord = await createRecord({
                ...fileOneRecord,
                timestamp: 2000,
            });

            const fileTwoRecord = await createRecord({
                ...fileOneRecord,
                path: '/file2.txt',
                rootHash: 'hash2',
            });

            primary.manager.spaceFileList.add(fileOneRecord);

            const eventStack = [
                {
                    action: EVENTS.SpaceFileEventOptions.ADD,
                    files: [
                        toEvent(fileOneRecord), // duplicate => drop
                        toEvent(fileOneRenewalRecord), // new timestamp => include
                        toEvent(fileTwoRecord) // new record => include
                    ]
                }
            ];

            const message = await createSpaceFileEventMessage({
                topic: spaceTopicHash,
                events: eventStack,
                publicKey: secondary.publicKey,
                secretKey: secondary.secretKey
            });

            await primary.manager.message.handleIncomingMessage(
                secondary.socket,
                JSON.stringify(message),
                secondary.info
            );

            const primaryFiles = primary.manager.spaceFileList.get(spaceTopicHash);
            expect(primaryFiles['/file1.txt']).toBeDefined();

            const file1Peers = primaryFiles['/file1.txt']['hash1'].peers;
            expect(file1Peers[secondary.publicKey].timestamp).toBe(2000);

            const standbyCalls = standby.socket.write.mock.calls;
            expect(standbyCalls.length).toBe(1);

            const primaryBroadcastMessage = JSON.parse(unframeJson(standby.socket.write.mock.calls[0][0]));
            const broadcastEvents = primaryBroadcastMessage.payload[0].files;

            expect(broadcastEvents).toEqual([
                toEvent(fileOneRenewalRecord),
                toEvent(fileTwoRecord)
            ]);
        });
    });

    describe('SpaceFileRequestHandler');
})