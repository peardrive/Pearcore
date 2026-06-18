import * as EVENTS from '../../src/constants/events.constants.js';
import * as MESSAGES from '../../src/constants/messages.constants.js';
import { describe, it, expect, beforeEach } from "vitest";
import { initializeManagers } from "../../src/managers/initialization.js";
import { createProfileUpdateMessage } from "../../src/utils/protocol.utils.js";
import { createFakeP2PConnection, buildTestProfilePayload } from "../general.utils.js";


describe('ProfileProtocolHandler', () => {
    const generalTopicHash = 'a'.repeat(64)
    let primary = {};
    let secondary = {};

    beforeEach(async () => {
        const [primaryManager, primarySocket, primaryInfo] = await createFakeP2PConnection();
        const [secondaryManager, secondarySocket, secondaryInfo] = await createFakeP2PConnection();

        const { publicKey: primaryPublicKey, secretKey: primarySecretKey } = primaryManager.session.getCredentials();
        const { publicKey: secondaryPublicKey, secretKey: secondarySecretKey } = secondaryManager.session.getCredentials();

        // 1:1 connection
        primaryManager.sockets.addSocket(secondarySocket, secondaryPublicKey, [generalTopicHash]);
        secondaryManager.sockets.addSocket(primarySocket, primaryPublicKey, [generalTopicHash]);


        primary = {
            manager: primaryManager,
            socket: primarySocket,
            info: primaryInfo,
            publicKey: primaryPublicKey,
            secretKey: primarySecretKey
        };

        secondary = {
            manager: secondaryManager,
            socket: secondarySocket,
            info: secondaryInfo,
            publicKey: secondaryPublicKey,
            secretKey: secondarySecretKey
        }
    })

    it('should exist within the protocol map', () => {
        const managers = initializeManagers();
        expect(managers.message).toBeDefined();
        expect(managers.message.protocolHandlers.has(EVENTS.ProfileUpdate)).toBe(true);
    })

    it('should handle valid ProfileUpdate message', async () => {
        const profile = await buildTestProfilePayload({
            username: 'alice',
            publicKey: primary.publicKey,
            secretKey: primary.secretKey
        });

        const message = await createProfileUpdateMessage({
            profile: profile,
            topics: [ generalTopicHash ],
            publicKey: primary.publicKey,
            secretKey: primary.secretKey
        });

        // this makes primaryManager think it already sent the message
        primary.manager.throttle.updateByMessage(message);

        let eventContext = null;
        secondary.manager.emitter.on(EVENTS.ProfileUpdate, ({ message }) => {
            eventContext = message;
        });

        await secondary.manager.message.handleIncomingMessage(primary.socket, JSON.stringify(message), primary.info);
        const profileRecord = await secondary.manager.storage.getProfileByPublicKey(profile.publicKey);

        expect(eventContext).toBeDefined();
        expect(eventContext).toEqual(message);

        expect(profileRecord).toEqual(message.payload.profile);
    })

    it('should update record base on valid ProfileUpdate message', async () => {
        const profile = {
            username: 'alice',
            tag: '@pancake',
            profileURL: null,
            publicKey: secondary.publicKey,
        };

        // generate the base profile payload in the secondary
        const originalProfile = await secondary.manager.storage.createProfileForPublicKey(profile, secondary.secretKey);
        
        // update the recorded profile payload with new parameters
        const newProfileParams = { ...profile, username: 'alice likes pancake' };
        await secondary.manager.storage.updateProfileForPublicKey(newProfileParams, secondary.secretKey);
        // fetch the updated payload from the secondary
        const updatedProfile = await secondary.manager.storage.getProfileByPublicKey(originalProfile.publicKey);

        // only store the base profile in the primary to differentiate with the newer one
        await primary.manager.storage.createProfile(originalProfile);

        const message = await createProfileUpdateMessage({
            profile: updatedProfile,
            topics: [ generalTopicHash ],
            publicKey: secondary.publicKey,
            secretKey: secondary.secretKey
        });

        let eventContext = null;
        primary.manager.emitter.on(EVENTS.ProfileUpdate, ({ message }) => {
            eventContext = message;
        });

        // primary with older profile payload will receive updated profile
        await primary.manager.message.handleIncomingMessage(secondary.socket, JSON.stringify(message), secondary.info);
        const profileRecord = await primary.manager.storage.getProfileByPublicKey(secondary.publicKey);

        // now the profile payload within the primary should also be updated
        expect(profileRecord).toEqual(updatedProfile);
    })
})