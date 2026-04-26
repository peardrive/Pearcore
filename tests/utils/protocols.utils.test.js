import { describe, it, expect, beforeEach } from 'vitest'
import * as EVENTS from '../../src/constants/events.constants.js'
import * as cryptoUtils from '../../src/utils/crypto.utils.js'
import * as protocolUtils from '../../src/utils/protocol.utils.js'
import { generateSpaceSecret } from '../../src/utils/space.utils.js'
import { buildTestProfilePayload, generateKeypair } from '../general.utils.js'

const { hex } = cryptoUtils

describe('Protocol Messages', () => {
    let secretKey, publicKey

    beforeEach(async () => {
        const keys = await generateKeypair();
        secretKey = hex(keys.secretKey);
        publicKey = hex(keys.publicKey);
    })

    describe('generateNonceFromPayoad', () => {
        it('should generate identical nonce for indentical payload', () => {
            const payloadOne = { data: 10 };
            const nonceOne = protocolUtils.generateNonceFromPayoad(payloadOne);
            const nonceTwo = protocolUtils.generateNonceFromPayoad(payloadOne);

            expect(nonceOne).toBe(nonceTwo);
            expect(nonceOne.length).toBe(24);
            expect(nonceTwo.length).toBe(24);
        })

        it('should generate different nonce with different payload', () => {
            const payloadOne = { data: 10 };
            const payloadTwo = { data: 11 };
            const nonceOne = protocolUtils.generateNonceFromPayoad(payloadOne);
            const nonceTwo = protocolUtils.generateNonceFromPayoad(payloadTwo);

            expect(nonceOne).not.toBe(nonceTwo);
            expect(nonceOne.length).toBe(24);
            expect(nonceTwo.length).toBe(24);
        })
    })

    describe('createBaseMessage', () => {

        it('creates a signed base message', async () => {
            const payload = { hello: 'world' }

            const msg = await protocolUtils.createBaseMessage({
                type: 'message',
                topic: 'test-topic',
                payload,
                secretKey: secretKey,
                publicKey: publicKey
            })

            expect(msg).toHaveProperty('type', 'message')
            expect(msg).toHaveProperty('topic', 'test-topic')
            expect(msg).toHaveProperty('payload')
            expect(msg).toHaveProperty('nonce')
            expect(msg).toHaveProperty('timestamp')
            expect(msg).toHaveProperty('signature')
            expect(msg).toHaveProperty('publicKey')

            expect(typeof msg.nonce).toBe('string')
            expect(typeof msg.timestamp).toBe('number')

            expect(msg.payload).toEqual(payload)
        })

        it('produces a verifiable signature', async () => {
            const payload = { foo: 'bar' }

            const msg = await protocolUtils.createBaseMessage({
                type: 'message',
                topic: 'topic',
                payload,
                secretKey: secretKey,
                publicKey: publicKey
            })

            const { signature, ...unsigned } = msg

            const isValid = await cryptoUtils.verifySignedJSON(unsigned, signature, publicKey)
            expect(isValid).toBe(true)
        })

        it('fails verification if payload is tampered', async () => {
            const payload = { secure: true }

            const msg = await protocolUtils.createBaseMessage({
                type: 'message',
                topic: 'topic',
                payload,
                secretKey,
                publicKey
            })

            // Tamper with payload
            msg.payload.secure = false

            const { signature, ...unsigned } = msg
            const isValid = await cryptoUtils.verifySignedJSON(unsigned, signature, publicKey)

            expect(isValid).toBe(false)
        })

        it('allows deterministic nonce and timestamp', async () => {
            const payload = { test: 123 }
            const fixedNonce = 'deadbeefdeadbeefdeadbeef'
            const fixedTimestamp = 1234567890

            const msg = await protocolUtils.createBaseMessage({
                type: 'message',
                topic: 'deterministic',
                payload,
                secretKey,
                publicKey,
                nonce: fixedNonce,
                timestamp: fixedTimestamp
            })

            expect(msg.nonce).toBe(fixedNonce)
            expect(msg.timestamp).toBe(fixedTimestamp)
        })

        it('generates unique nonce per message when not provided', async () => {

            const msg1 = await protocolUtils.createBaseMessage({
                type: 'message',
                topic: 'topic',
                payload: { a: 1 },
                secretKey,
                publicKey
            })

            const msg2 = await protocolUtils.createBaseMessage({
                type: 'message',
                topic: 'topic',
                payload: { a: 1 },
                secretKey,
                publicKey
            })

            expect(msg1.nonce).not.toBe(msg2.nonce)
        })
    })

    describe('validateBaseMessage', () => {
        it('should validate valid message', async () => {
            const validMessage = await protocolUtils.createBaseMessage({
                type: 'update',
                topic: 'some-space-topic',
                publicKey: publicKey,
                secretKey: secretKey,
                payload: { data: 123 }
            });

            const result = protocolUtils.validateBaseMessage(validMessage);
            expect(result.isValid).toBe(true);
        })

        it('should reject missing parameters', async () => {
            const validMessage = await protocolUtils.createBaseMessage({
                type: 'update',
                topic: 'some-space-topic',
                publicKey: publicKey,
                secretKey: secretKey,
                payload: { data: 123 }
            });

            const testCases = [
                { field: 'type', value: undefined, reason: 'type is required' },
                { field: 'topic', value: undefined, reason: 'topic is required' },
                { field: 'nonce', value: undefined, reason: 'nonce is required' },
                { field: 'publicKey', value: undefined, reason: 'publicKey is required' },
                { field: 'timestamp', value: undefined, reason: 'timestamp is required' },
                { field: 'signature', value: undefined, reason: 'signature is required' }
            ];

            testCases.forEach(({ field, value, reason }) => {
                const invalidMessage = { ...validMessage, [field]: value };
                const result = protocolUtils.validateBaseMessage(invalidMessage);
                expect(result.isValid).toBe(false);
                expect(result.reason).toBe(reason);
            });
        });

        it('should reject topic longer than 158 characters', async () => {
            const validMessage = await protocolUtils.createBaseMessage({
                type: 'update',
                topic: 'some-space-topic',
                publicKey: publicKey,
                secretKey: secretKey,
                payload: { data: 123 }
            });

            const message = { ...validMessage, topic: 'a'.repeat(159) };
            const result = protocolUtils.validateBaseMessage(message);
            expect(result.isValid).toBe(false);
            expect(result.reason).toBe('topic should not be larger than 158 characters');
        })

        it('should reject invalid nonce', async () => {
            const validMessage = await protocolUtils.createBaseMessage({
                type: 'update',
                topic: 'some-space-topic',
                publicKey: publicKey,
                secretKey: secretKey,
                payload: { data: 123 }
            });

            const shortNonceMessage = { ...validMessage, nonce: 'a'.repeat(9) };
            const shortNonceResult = protocolUtils.validateBaseMessage(shortNonceMessage);

            const badHexNonceMessage = { ...validMessage, nonce: 'x'.repeat(24) };
            const badHexNonceResult = protocolUtils.validateBaseMessage(badHexNonceMessage);

            expect(shortNonceResult.isValid).toBe(false);
            expect(shortNonceResult.reason).toBe('nonce should be 24 characters long');

            expect(badHexNonceResult.isValid).toBe(false);
            expect(badHexNonceResult.reason).toBe('nonce should be a valid hex string');
        })

        it('should reject invalid publicKeys', async () => {
            const validMessage = await protocolUtils.createBaseMessage({
                type: 'update',
                topic: 'some-space-topic',
                publicKey: publicKey,
                secretKey: secretKey,
                payload: { data: 123 }
            });

            const numericalPublicKeyMessage = { ...validMessage, publicKey: 123 };
            const numericalPublicKeyResult = protocolUtils.validateBaseMessage(numericalPublicKeyMessage);

            const shortPublicKeyMessage = { ...validMessage, publicKey: 'a'.repeat(12) };
            const shortPublicKeyResult = protocolUtils.validateBaseMessage(shortPublicKeyMessage);

            const badHexPublicKeyMessage = { ...validMessage, publicKey: 'x'.repeat(64) };
            const badHexPublicKeyResult = protocolUtils.validateBaseMessage(badHexPublicKeyMessage);

            expect(numericalPublicKeyResult.isValid).toBe(false);
            expect(numericalPublicKeyResult.reason).toBe('publicKey should be a string');

            expect(shortPublicKeyResult.isValid).toBe(false);
            expect(shortPublicKeyResult.reason).toBe('publicKey should be 64 characters long');

            expect(badHexPublicKeyResult.isValid).toBe(false);
            expect(badHexPublicKeyResult.reason).toBe('publicKey should be a valid hex string');
        })

        it('should reject invalid timestamp', async () => {
            const validMessage = await protocolUtils.createBaseMessage({
                type: 'update',
                topic: 'some-space-topic',
                publicKey: publicKey,
                secretKey: secretKey,
                payload: { data: 123 }
            });

            const badTimeStampMessage = { ...validMessage, timestamp: -1000 };
            const badTimeStampResult = protocolUtils.validateBaseMessage(badTimeStampMessage);

            expect(badTimeStampResult.isValid).toBe(false);
            expect(badTimeStampResult.reason).toBe('timestamp should be a valid date');
        })

        it('should reject invalid signatures', async () => {
            const validMessage = await protocolUtils.createBaseMessage({
                type: 'update',
                topic: 'some-space-topic',
                publicKey: publicKey,
                secretKey: secretKey,
                payload: { data: 123 }
            });

            const numericalSignatureMessage = { ...validMessage, signature: 123 };
            const numericalSignatureResult = protocolUtils.validateBaseMessage(numericalSignatureMessage);

            const shortSignatureMessage = { ...validMessage, signature: 'a'.repeat(127) };
            const shortSignatureResult = protocolUtils.validateBaseMessage(shortSignatureMessage);

            const badHexSignatureMessage = { ...validMessage, signature: 'x'.repeat(128) };
            const badHexSignatureResult = protocolUtils.validateBaseMessage(badHexSignatureMessage);

            expect(numericalSignatureResult.isValid).toBe(false);
            expect(numericalSignatureResult.reason).toBe('signature should be a string');

            expect(shortSignatureResult.isValid).toBe(false);
            expect(shortSignatureResult.reason).toBe('signature should be 128 characters long');

            expect(badHexSignatureResult.isValid).toBe(false);
            expect(badHexSignatureResult.reason).toBe('signature should be a valid hex string');
        })
    })

    describe('verifyMessageSignature', () => {
        it('should return true for a valid signed message', async () => {
            const payload = { foo: 'bar' }

            const message = await protocolUtils.createBaseMessage({
                type: 'test',
                topic: 'topic',
                payload: payload,
                secretKey: secretKey,
                publicKey: publicKey
            })

            const result = await protocolUtils.verifyMessageSignature(message);
            expect(result).toBe(true)
        })

        it('should return false if payload is tampered', async () => {
            const payload = { secure: true }

            const msg = await protocolUtils.createBaseMessage({
                type: 'test',
                topic: 'topic',
                payload,
                secretKey: secretKey,
                publicKey: publicKey
            })

            // Tamper payload
            msg.payload.secure = false

            const result = await protocolUtils.verifyMessageSignature(msg)
            expect(result).toBe(false)
        })

        it('should throw error if signature is missing', async () => {
            const payload = { foo: 'bar' }

            const message = await protocolUtils.createBaseMessage({
                type: 'test',
                topic: 'topic',
                payload: payload,
                secretKey: secretKey,
                publicKey: publicKey
            })

            delete message.signature
            await expect(protocolUtils.verifyMessageSignature(message)).rejects.toThrow(
                'Message missing signature or publicKey'
            )
        })

        it('should throw error if publicKey is missing', async () => {
            const payload = { foo: 'bar' }

            const msg = await protocolUtils.createBaseMessage({
                type: 'test',
                topic: 'topic',
                payload,
                secretKey: secretKey,
                publicKey: publicKey
            })

            delete msg.publicKey

            await expect(protocolUtils.verifyMessageSignature(msg)).rejects.toThrow(
                'Message missing signature or publicKey'
            )
        })
    })

    describe('createRejectionMessage', () => {

        it('creates a rejection message with given reason', async () => {
            const topic = 'some random topic';
            const replyNonce = hex(cryptoUtils.randomNonce());
            const reason = 'invalid message !';

            const msg = await protocolUtils.createRejectionMessage({
                topic: topic,
                linkedMessageNonce: replyNonce,
                reason: reason,
                secretKey,
                publicKey
            });

            expect(msg.type).toBe(EVENTS.Reject);
            expect(msg.topic).toBe(topic);
            expect(msg.payload.linkedMessageNonce).toBe(replyNonce);
            expect(msg.payload.reason).toBe(reason);

            const valid = await protocolUtils.verifyMessageSignature(msg);
            expect(valid).toBe(true);
        })

        it('throws error if required fields are missing', async () => {
            await expect(protocolUtils.createRejectionMessage({
                topic: 't1',
                linkedMessageNonce: 'nonce',
                reason: 'reason',
                secretKey: null,
                publicKey
            })).rejects.toThrow('secretKey is required');
        })
    })

    describe('createProfileUpdateMessage', () => {
        it('creates and verifies a signed profile update message', async () => {
            const profile = await buildTestProfilePayload({ username: 'bob' });
            const topics = ['a'.repeat(64)];

            const msg = await protocolUtils.createProfileUpdateMessage({
                profile,
                topics: topics,
                secretKey,
                publicKey
            });

            expect(msg.type).toBe(EVENTS.ProfileUpdate);
            expect(msg.payload).toEqual({ profile, topics });
            expect(msg.publicKey).toBeDefined();
            expect(msg.signature).toBeDefined();

            const valid = await protocolUtils.verifyMessageSignature(msg);
            expect(valid).toBe(true);
        })
    })

    describe('createSpaceSyncMessage', () => {
        it('creates and verifies a signed space sync message', async () => {

            const topic = 'My Space topic'

            const space = {
                name: 'My Space',
                owner: publicKey,
                secret: generateSpaceSecret()
            }

            const msg = await protocolUtils.createSpaceSyncMessage({
                topic,
                space,
                secretKey,
                publicKey
            })

            expect(msg.type).toBe(EVENTS.SpaceSync)
            expect(msg.topic).toBe(topic)
            expect(msg.payload).toEqual(space)
            expect(msg.publicKey).toBeDefined()
            expect(msg.signature).toBeDefined()

            const valid = await protocolUtils.verifyMessageSignature(msg)
            expect(valid).toBe(true)
        })
    })

    describe('createSpaceHashListMessage', () => {
        it('creates and verifies a signed space-hash list message', async () => {

            const hashList = [
                'a1b2c3d4',
                'deadbeef',
                'ff001122'
            ]

            const msg = await protocolUtils.createSpaceHashListMessage({
                hashList,
                secretKey,
                publicKey
            })

            expect(msg.type).toBe(EVENTS.SpaceHashList)
            expect(msg.topic).toBe(EVENTS.noTopic)
            expect(msg.payload).toEqual(hashList)
            expect(Array.isArray(msg.payload)).toBe(true)
            expect(msg.publicKey).toBeDefined()
            expect(msg.signature).toBeDefined()

            // cryptographic verification
            const valid = await protocolUtils.verifyMessageSignature(msg)
            expect(valid).toBe(true)
        })
    })

    describe('validateSpaceHashListPayload', () => {
        it('should validate valid spaceHashList payload', async () => {
            const message = await protocolUtils.createSpaceHashListMessage({
                hashList: Array(10).fill().map(() => 'a'.repeat(64)),
                publicKey: publicKey,
                secretKey: secretKey
            });

            const spaceHashListResult = protocolUtils.validateSpaceHashListPayload(message);

            expect(spaceHashListResult.isValid).toBe(true);
        })

        it('should reject invalid spaceHashList payload', async () => {
            const messageWithShortHashes = await protocolUtils.createSpaceHashListMessage({
                hashList: Array(10).fill().map(() => 'a'.repeat(63)),
                publicKey: publicKey,
                secretKey: secretKey
            });

            const messageWithBadHex = await protocolUtils.createSpaceHashListMessage({
                hashList: Array(10).fill().map(() => 'x'.repeat(64)),
                publicKey: publicKey,
                secretKey: secretKey
            });

            const messageWithLongPayload = await protocolUtils.createSpaceHashListMessage({
                hashList: Array(65).fill().map(() => 'a'.repeat(64)),
                publicKey: publicKey,
                secretKey: secretKey
            });

            const shortHashResult = protocolUtils.validateSpaceHashListPayload(messageWithShortHashes);
            const badHexResult = protocolUtils.validateSpaceHashListPayload(messageWithBadHex);
            const longPayloadResult = protocolUtils.validateSpaceHashListPayload(messageWithLongPayload);

            expect(shortHashResult.isValid).toBe(false);
            expect(shortHashResult.reason).toBe('in SpaceHashList, each hash should be 64 characters long');

            expect(badHexResult.isValid).toBe(false);
            expect(badHexResult.reason).toBe('in SpaceHashList, each hash should be a valid hex string');

            expect(longPayloadResult.isValid).toBe(false);
            expect(longPayloadResult.reason).toBe('SpaceHashList payload array should not exceed 64 elements');
        })
    })

    describe('createSpaceMessage', () => {
        it('creates and verifies a signed space message', async () => {

            const topic = 'hello-space'

            const messagePayload = {
                text: 'Hello space',
                attachments: [],
                version: 1
            }

            const msg = await protocolUtils.createSpaceMessage({
                topic,
                messagePayload,
                secretKey,
                publicKey
            })

            expect(msg.type).toBe(EVENTS.SpaceMessage)
            expect(msg.topic).toBe(topic)
            expect(msg.payload).toEqual(messagePayload)
            expect(msg.publicKey).toBeDefined()
            expect(msg.signature).toBeDefined()

            const valid = await protocolUtils.verifyMessageSignature(msg)
            expect(valid).toBe(true)
        })
    })

    describe('encryptPayload', () => {
        it('should encrypt space message payload while preserving signature validity', async () => {
            const topic = 'space-enc-test';
            const originalPayload = { text: 'Encrypted hello' };
            const spaceSecret = generateSpaceSecret();
            const nonce = hex(cryptoUtils.randomNonce());

            const encryptedPayload = await protocolUtils.encryptPayload({
                payload: originalPayload,
                spaceSecret: spaceSecret,
                nonce: nonce
            });

            const encryptedMsg = await protocolUtils.createSpaceMessage({
                topic,
                messagePayload: encryptedPayload,
                secretKey,
                publicKey,
                nonce: nonce
            });

            const valid = await protocolUtils.verifyMessageSignature(encryptedMsg);
            expect(valid).toBe(true);
        })
    })

    describe('decryptPayload', () => {
        it('should decrypt space message payload for valid encrypted payload', async () => {
            const topic = 'space-enc-test';
            const originalPayload = { text: 'Encrypted hello' };
            const spaceSecret = generateSpaceSecret();
            const nonce = hex(cryptoUtils.randomNonce());

            const encryptedPayload = await protocolUtils.encryptPayload({
                payload: originalPayload,
                spaceSecret: spaceSecret,
                nonce: nonce
            });

            const encryptedMsg = await protocolUtils.createSpaceMessage({
                topic,
                messagePayload: encryptedPayload,
                secretKey,
                publicKey,
                nonce: nonce
            });

            const valid = await protocolUtils.verifyMessageSignature(encryptedMsg);
            expect(valid).toBe(true);

            const decrypted = await protocolUtils.decryptPayload({
                payload: encryptedMsg.payload,
                spaceSecret: spaceSecret,
                nonce: encryptedMsg.nonce
            });

            expect(decrypted).toEqual(originalPayload);
        })
    })
})