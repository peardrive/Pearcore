import { describe, it, expect, beforeEach } from "vitest";
import * as EVENTS from '../../src/constants/events.constants.js';
import * as MESSAGES from '../../src/constants/messages.constants.js';
import { initializeManagers } from "../../src/managers/initialization.js";
import { createSpaceHashListMessage, createSpaceMessage, createSpaceSyncMessage, encryptPayload } from "../../src/utils/protocol.utils.js";
import { buildTestSpacePayload, createFakeP2PConnection } from "../general.utils.js";
import { generateSpaceTopic, getSpaceTopicHash } from "../../src/utils/space.utils.js";
import { SpaceSyncHandler } from "../../src/protocol/space.protocol.js";
import { now } from "../../src/utils/general.utils.js";
import { hex, randomNonce } from "../../src/utils/crypto.utils.js";

/**
 * Creates stack of [manager, socket, info]. 
 * @param {number} numNodes 
 * @returns {Array[]} returns array of fake P2P managers.
 */
async function createP2PNetwork(numNodes) {
    const nodes = [];
    for (let index = 0; index < numNodes; index++) {
        const [manager, socket, info] = await createFakeP2PConnection(`node-${index}`);
        const { publicKey, secretKey } = manager.session.getCredentials();
        nodes.push({ manager, socket, info, publicKey, secretKey });
    }

    return nodes;
}

/**
 * Connects stack of P2P managers to each other using one space as topic subscription.
 * @param {Object} space - The space to derive topic hash.
 * @param {Array} nodes - stack of [manager, socket, info].
 */
function createConnections(topicHash, nodes) {
    for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
        const currentNode = nodes[nodeIndex];

        for (let selectIndex = 0; selectIndex < nodes.length; selectIndex++) {
            if (selectIndex !== nodeIndex) {
                const targetNode = nodes[selectIndex];
                currentNode.manager.sockets.addSocket(targetNode.socket, targetNode.publicKey, [topicHash]);
            }
        }
    }
}

/**
 * In this test subject we use 4 virtual nodes with different purposes:
 * 
 * 1. primary and secondary nodes are the ones that 'communicate' and handle messages from each other.
 * 2. standby node is allowed to receive and read messages, but does not communicate. it only receives broadcast messages.
 * 3. outlier node is subscribed to the common topic, but is not allowed for read or broadcast.
 *    We consider outlier receiving any message from the space, an exception that should be avoided.
 */
describe('Space Protocols', () => {
    let primary;
    let secondary;
    let standby;
    let outlier;
    let spaceParams;
    let spaceTopicHash;

    beforeEach(async () => {
        [primary, secondary, standby, outlier] = await createP2PNetwork(4);

        spaceParams = await buildTestSpacePayload({
            spaceName: 'TestSpace',
            publicKey: primary.publicKey,
            permissionRead: 0,
            permissionBroadcast: 0,
            readWhitelist: [primary.publicKey, secondary.publicKey, standby.publicKey],
            broadcastWhitelist: [secondary.publicKey],
        });

        spaceTopicHash = getSpaceTopicHash(spaceParams);
        createConnections(spaceTopicHash, [primary, secondary, standby, outlier]);
    })

    describe('SpaceHashListHandler', () => {
        let message;

        beforeEach(async () => {
            message = await createSpaceHashListMessage({
                hashList: [spaceTopicHash],
                publicKey: primary.publicKey,
                secretKey: primary.secretKey
            });
        })

        it('should exist within the protocol map', () => {
            const managers = initializeManagers();
            expect(managers.message).toBeDefined();
            expect(managers.message.protocolHandlers.has(EVENTS.SpaceHashList)).toBe(true);
        })

        it('should handle valid SpaceHashList message', async () => {
            let eventContext = null;
            primary.manager.message.on(EVENTS.SpaceHashList, ({ message }) => {
                eventContext = message;
            })

            await primary.manager.message.handleIncomingMessage(primary.socket, JSON.stringify(message), primary.info);
            const socketState = primary.manager.sockets.getSnapShot({ sortByPeers: true });

            expect(primary.socket.write.mock.calls.length).toBe(0); // no message reply back
            expect(socketState[primary.publicKey]).toEqual([spaceTopicHash]);
            expect(eventContext).toEqual(message);
        });

        it('should handle repeated SpaceHashList topic updates', async () => {
            await primary.manager.message.handleIncomingMessage(primary.socket, JSON.stringify(message), primary.info);
            const socketState = primary.manager.sockets.getSnapShot({ sortByPeers: true });

            expect(primary.socket.write.mock.calls.length).toBe(0); // no message reply back
            expect(socketState[primary.publicKey]).toEqual([spaceTopicHash]);

            const secondSpaceTopicHash = 'b'.repeat(64);
            const secondaryMessage = await createSpaceHashListMessage({
                hashList: [secondSpaceTopicHash], //different topic
                publicKey: primary.publicKey,
                secretKey: primary.secretKey
            });

            await primary.manager.message.handleIncomingMessage(primary.socket, JSON.stringify(secondaryMessage), primary.info);
            const updatedSocketState = primary.manager.sockets.getSnapShot({ sortByPeers: true });

            expect(primary.socket.write.mock.calls.length).toBe(0); // no message reply back
            expect(updatedSocketState[primary.publicKey]).toEqual([secondSpaceTopicHash]);
        });

        it('should reject invalid spaceHashList message', async () => {
            const message = await createSpaceHashListMessage({
                hashList: { data: 123 }, // non-Array hash list
                publicKey: primary.publicKey,
                secretKey: primary.secretKey
            });

            await primary.manager.message.handleIncomingMessage(primary.socket, JSON.stringify(message), primary.info);
            const callStack = primary.socket.write.mock.calls
            expect(callStack.length).toBe(1);

            const response = JSON.parse(callStack[0]);
            expect(response.type).toEqual(EVENTS.Reject);
            expect(response.topic).toEqual(EVENTS.noTopic);
            expect(response.payload.linkedMessageNonce).toEqual(message.nonce);
            expect(response.payload.reason).toEqual('SpaceHashList payload should be an array');
        });

        it('should reject relayed spaceHashList message', async () => {
            await primary.manager.message.handleIncomingMessage(primary.socket, JSON.stringify(message), secondary.info);
            const callStack = primary.socket.write.mock.calls
            expect(callStack.length).toBe(1);

            const response = JSON.parse(callStack[0]);
            expect(response.type).toEqual(EVENTS.Reject);
            expect(response.topic).toEqual(EVENTS.noTopic);
            expect(response.payload.linkedMessageNonce).toEqual(message.nonce);
            expect(response.payload.reason).toEqual(MESSAGES.NO_RELAY_MESSAGE);
        });
    })

    describe('SpaceSyncHandler', () => {
        let newerSpaceParams;

        beforeEach(() => {
            newerSpaceParams = {
                spaceName: spaceParams.spaceName,
                publicKey: spaceParams.publicKey,
                nonce: spaceParams.nonce,
                timestamp: now() // newer space timestamp
            };
        })

        it('should handle FIRST_ENCOUNTER space sync scenario', async () => {
            const space = await primary.manager.storage.createSpace(spaceParams, primary.secretKey);
            await secondary.manager.storage.createShareLink(space);

            const message = await createSpaceSyncMessage({
                topic: spaceTopicHash,
                space: space,
                publicKey: primary.publicKey,
                secretKey: primary.secretKey
            });

            let actionContext = null;
            secondary.manager.message.on(EVENTS.SpaceSync, ({ message, action }) => { actionContext = action; });

            await secondary.manager.message.handleIncomingMessage(primary.socket, JSON.stringify(message), primary.info);
            expect(actionContext).toBe(SpaceSyncHandler.STATES.FIRST_ENCOUNTER);

            // no reply back to the sender.
            const primaryCallStack = primary.socket.write.mock.calls;
            expect(primaryCallStack.length).toBe(0);

            // standby should receive message from first encounter
            const standbyCallStack = standby.socket.write.mock.calls;
            expect(standbyCallStack.length).toBe(1);

            const standbyReceivedMessage = JSON.parse(standbyCallStack[0]);
            expect(standbyReceivedMessage).toEqual(message);

            // outlier should not receive message
            const outlierCallStack = outlier.socket.write.mock.calls;
            expect(outlierCallStack.length).toBe(0);
        });

        it('should handle INDENTICAL space sync scenario', async () => {
            const space = await primary.manager.storage.createSpace(spaceParams, primary.secretKey);

            // add space information to the second node to trigger INDETICAL scenario
            await secondary.manager.storage.upsertSpace(space);

            const message = await createSpaceSyncMessage({
                topic: spaceTopicHash,
                space: space,
                publicKey: primary.publicKey,
                secretKey: primary.secretKey
            });

            let actionContext = null;
            secondary.manager.message.on(EVENTS.SpaceSync, ({ message, action }) => { actionContext = action; });

            await secondary.manager.message.handleIncomingMessage(primary.socket, JSON.stringify(message), primary.info);

            expect(actionContext).toBe(SpaceSyncHandler.STATES.IDENTICAL);

            // no response for identical spaces.
            const primaryCallStack = primary.socket.write.mock.calls;
            expect(primaryCallStack.length).toBe(0);

            // standby should not receive broadcast message in identical situation
            const standbyCallStack = standby.socket.write.mock.calls;
            expect(standbyCallStack.length).toBe(0);

            // outlier should not receive message
            const outlierCallStack = outlier.socket.write.mock.calls;
            expect(outlierCallStack.length).toBe(0);
        });

        it('should handle LOCAL_SPACE_REQUIRE_UPDATE space sync scenario', async () => {
            const space = await primary.manager.storage.createSpace(spaceParams, primary.secretKey);

            // add space information to the second node to trigger INDETICAL scenario
            await secondary.manager.storage.upsertSpace(space);
            // update the space from the primary to maintain newer timestamp
            await primary.manager.storage.updateSpace({ ...space, ...newerSpaceParams }, primary.secretKey);
            const [updatedSpace] = await primary.manager.storage.querySpace({
                spaceName: space.spaceName,
                publicKey: space.publicKey,
                nonce: space.nonce
            });

            const [secondarySpace] = await secondary.manager.storage.listSpaces();

            // ensure that the primary space has newer timestamp and both 
            // nodes already have the original space stored
            expect(secondarySpace).toBeDefined();
            expect(updatedSpace.timestamp).toBeGreaterThan(secondarySpace.timestamp);

            const message = await createSpaceSyncMessage({
                topic: spaceTopicHash,
                space: updatedSpace,
                publicKey: primary.publicKey,
                secretKey: primary.secretKey
            });

            let actionContext = null;
            secondary.manager.message.on(EVENTS.SpaceSync, ({ message, action }) => { actionContext = action; });

            await secondary.manager.message.handleIncomingMessage(primary.socket, JSON.stringify(message), primary.info);

            expect(actionContext).toBe(SpaceSyncHandler.STATES.LOCAL_SPACE_REQUIRE_UPDATE);

            // stored space from the secondary should now be updated
            const [updatedSecondarySpace] = await secondary.manager.storage.listSpaces();
            expect(updatedSecondarySpace).toEqual(updatedSpace);

            // no reply back to the primary
            expect(primary.socket.write.mock.calls.length).toBe(0);

            // standby should receive message for update
            const standbyCallStack = standby.socket.write.mock.calls;
            expect(standbyCallStack.length).toBe(1);

            const standbyReceivedMessage = JSON.parse(standbyCallStack[0]);
            expect(standbyReceivedMessage).toEqual(message);

            // outlier should not receive message
            const outlierCallStack = outlier.socket.write.mock.calls;
            expect(outlierCallStack.length).toBe(0);
        });

        it('should handle PEER_REQUIRE_UPDATE space sync scenario', async () => {
            const space = await primary.manager.storage.createSpace(spaceParams, primary.secretKey);
            const spaceTopic = generateSpaceTopic(space.spaceName, space.publicKey, space.nonce);

            // add space information to the second node to trigger INDETICAL scenario
            await secondary.manager.storage.upsertSpace(space);
            // update the space from the primary to maintain newer timestamp
            await primary.manager.storage.updateSpace({ ...space, ...newerSpaceParams }, primary.secretKey);
            const [primaryUpdatedSpace] = await primary.manager.storage.querySpace({
                spaceName: space.spaceName,
                publicKey: space.publicKey,
                nonce: space.nonce
            });

            const [secondarySpace] = await secondary.manager.storage.listSpaces();

            // ensure that the primary space has newer timestamp and both 
            // nodes already have the original space stored
            expect(secondarySpace).toBeDefined();
            expect(primaryUpdatedSpace.timestamp).toBeGreaterThan(secondarySpace.timestamp);

            const message = await createSpaceSyncMessage({
                topic: spaceTopic,
                space: secondarySpace,
                publicKey: secondary.publicKey,
                secretKey: secondary.secretKey
            });

            let actionContext = null;
            primary.manager.message.on(EVENTS.SpaceSync, ({ message, action }) => { actionContext = action; });

            await primary.manager.message.handleIncomingMessage(secondary.socket, JSON.stringify(message), secondary.info);

            expect(actionContext).toBe(SpaceSyncHandler.STATES.PEER_REQUIRE_UPDATE);

            // this response is an attemp update sender's space record with the new data
            const secondaryReceivedMessage = JSON.parse(secondary.socket.write.mock.calls[0]);
            expect(secondaryReceivedMessage.type).toEqual(EVENTS.SpaceSync);
            expect(secondaryReceivedMessage.topic).toEqual(message.topic);
            expect(secondaryReceivedMessage.payload).toEqual(primaryUpdatedSpace);

            expect(standby.socket.write.mock.calls.length).toBe(0);

            // send primary response back to secondary to update the space data
            await secondary.manager.message.handleIncomingMessage(primary.socket, JSON.stringify(secondaryReceivedMessage), primary.info);
            const [updatedSecondarySpace] = await secondary.manager.storage.listSpaces();
            expect(updatedSecondarySpace).toEqual(primaryUpdatedSpace);

            // standby should receive message from secondary
            const standbyCallStack = standby.socket.write.mock.calls;
            expect(standbyCallStack.length).toBe(1);

            const standbyReceivedMessage = JSON.parse(standbyCallStack[0]);
            expect(standbyReceivedMessage).toEqual(secondaryReceivedMessage);

            // outlier should not receive message
            const outlierCallStack = outlier.socket.write.mock.calls;
            expect(outlierCallStack.length).toBe(0);
        });
    })

    describe('SpaceMessageHandler', () => {
        it('should broadcast message from allowed publicKey', async () => {
            const space = await primary.manager.storage.createSpace(spaceParams, primary.secretKey);

            const content = { data: 'hello world' };
            const nonce = hex(randomNonce());
            const encryptedContent = await encryptPayload({
                payload: content,
                spaceSecret: space.secret,
                nonce: nonce
            });

            const message = await createSpaceMessage({
                topic: spaceTopicHash,
                messagePayload: encryptedContent,
                publicKey: primary.publicKey,
                secretKey: primary.secretKey,
                nonce: nonce
            });

            let eventContext = null;
            primary.manager.message.on(EVENTS.SpaceMessage, (context) => {
                eventContext = context;
            })

            await primary.manager.message.handleIncomingMessage(secondary.socket, JSON.stringify(message), secondary.info);

            expect(eventContext.content).toEqual(content);

            expect(secondary.socket.write.mock.calls.length).toBe(0);

            const standbyCallStack = standby.socket.write.mock.calls[0];
            expect(standbyCallStack.length).toBe(1);

            const standbyReceivedMessage = JSON.parse(standbyCallStack[0]);
            expect(standbyReceivedMessage).toEqual(message);

            const outlierCallStack = outlier.socket.write.mock.calls;
            expect(outlierCallStack.length).toBe(0);
        })
    })
})