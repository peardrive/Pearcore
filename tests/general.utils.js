import os from "os";
import path from "path";
import WebSocket from 'ws';
import { vi } from 'vitest';
import fs from "fs/promises";
import * as cryptoUtils from '../src/utils/crypto.utils.js';
import { initializeManagers } from "../src/managers/initialization.js";
import { createDatabase } from "../src/database/database.js";
import { buildSpacePayload, generateSpaceSecret } from "../src/utils/space.utils.js";
import { now } from "../src/utils/general.utils.js";
import { buildProfilePayload } from "../src/utils/profile.utils.js";

const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');

export async function generateKeypair() {
    return await cryptoUtils.edKeyPairFromSeed(
        cryptoUtils.hexToUint8(cryptoUtils.generateRandomSecretKey(32))
    )
}

export async function createSandbox() {
    const root = await makeTempDir()
    const dbPath = path.join(root, 'db.sqlite')
    return { root, dbPath }
}

export async function createTempDatabase() {
    const { dbPath, root } = await createSandbox();
    const { db, sqlite } = await createDatabase(dbPath, MIGRATIONS_DIR);
    return { db, sqlite };
}

export async function cleanup(dir) {
    await fs.rm(dir, { recursive: true, force: true })
}

export async function makeTempDir() {
    return await fs.mkdtemp(path.join(os.tmpdir(), 'spacebook-test-'))
}

export function getMockSocket(name = 'mock socket') {
    return {
        name: name,
        write: vi.fn(),
        destroy: vi.fn()
    }
}

export async function buildTestSpacePayload(params) {
    const { publicKey, secretKey } = await generateKeypair();
    const input = buildSpacePayload({
        spaceName: 'My Space',
        publicKey: cryptoUtils.hex(publicKey),
        timestamp: now(),
        permissionBroadcast: 0,
        broadcastWhitelist: [cryptoUtils.hex(publicKey)],
        permissionRead: 0,
        readWhitelist: [cryptoUtils.hex(publicKey)],
        nonce: cryptoUtils.hex(cryptoUtils.randomNonce()),
        secret: generateSpaceSecret(),
        ...params,
    });

    const signature = await cryptoUtils.signJSON(input, secretKey);
    return { ...input, signature };
}

export async function buildTestProfilePayload(params = {}) {
    const { publicKey, secretKey } = await generateKeypair();
    const input = buildProfilePayload({
        username: 'My Profile',
        tag: '@pancake',
        publicKey: params.publicKey ?? cryptoUtils.hex(publicKey),
        profileURL: 'https://example.com',
        timestamp: now(),
        ...params
    });

    const signature = await cryptoUtils.signJSON(input, params.secretKey ?? secretKey);
    return { ...input, signature };
}

export async function createManagerInstance() {
    const { db, sqlite } = await createTempDatabase();
    const { publicKey, secretKey } = await generateKeypair();
    const managers = initializeManagers();

    managers.session.setDatabase({ db: db, sqlite: sqlite });
    managers.session.setCredentials({
        publicKey: cryptoUtils.hex(publicKey),
        secretKey: cryptoUtils.hex(secretKey)
    });

    return managers;
}

export async function createFakeP2PConnection(name = 'testSubject') {
    const managers = await createManagerInstance();
    const { publicKey, secretKey } = await generateKeypair();
    const info = { publicKey: publicKey };
    const socket = getMockSocket(name);

    managers.session.setCredentials({
        publicKey: cryptoUtils.hex(publicKey),
        secretKey: cryptoUtils.hex(secretKey)
    });

    return [managers, socket, info];
}

/**
 * generates random port number
 * @returns {number}
 */
export function getRandomPort() {
    return 3000 + Math.floor(Math.random() * 2000)
}