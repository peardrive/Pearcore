import path from 'path';
import { EventEmitter } from 'stream';
import { describe, it, afterEach, beforeEach, expect } from "vitest";
import { createSpace } from '../../src/utils/space.utils.js';
import { generateFileRecord, generateMerkleTree, getfileRegistryRecord, listFiles } from '../../src/utils/files.utils.js';
import { cleanup, makeTempDir, generateRandomFile, createTempDatabase, buildTestSpacePayload, createNestedFiles } from '../general.utils.js';

describe('File Utils', () => {
    let root = null;
    let db = null;

    beforeEach(async () => {
        root = await makeTempDir();
        const { db: dbInstance } = await createTempDatabase();
        db = dbInstance;
    })

    afterEach(async () => {
        await cleanup(root);
    })

    describe('listFiles', () => {
        it('should list files recursively', async () => {
            const files = await createNestedFiles(root);
            const list = await listFiles(root);

            expect(list).toEqual(files);
        })
    })

    describe('createWatcher', () => {
        it('should trigger callback for file changes');
    })

    describe('generateMerkleTree', () => {
        it('should generate merkle-tree for 10MB file', async () => {
            const filePath = path.join(root, 'tempfile');
            await generateRandomFile(filePath, 10);

            const emitter = new EventEmitter();

            const progressEvents = [];
            emitter.on(filePath, context => { progressEvents.push(context) });

            const { levels, height, leafCount } = await generateMerkleTree(filePath, emitter);

            expect(levels.length).toBe(height + 1);
            expect(leafCount).toBeGreaterThan(0);
            expect(progressEvents.length).toBeGreaterThan(0);

            const leafLevel = levels[height];
            for (let index = 0; index < leafLevel.length; index++) {
                const leaf = leafLevel[index];
                expect(leaf.leafIndex).toBe(index);
                expect(leaf.hash).toBeInstanceOf(Uint8Array);
                expect(leaf.leftChild).toBeUndefined();
                expect(leaf.rightChild).toBeUndefined();
            }
        });
    })

    describe('generateFileRecord', () => {
        let filePath = null;
        let spaceId = null;
        let emitter = null;

        beforeEach(async () => {
            filePath = path.join(root, 'tempfile');
            await generateRandomFile(filePath, 10);
            emitter = new EventEmitter();

            const spacePayload = await buildTestSpacePayload({ spaceName: 'test' });
            const space = await createSpace(db, spacePayload);
            spaceId = space.spaceId;

        });

        it('should save full record of file indexes', async () => {
            const progressEvents = [];
            emitter.on(filePath, context => { progressEvents.push(context) });

            const { registryId, fileIndexRecords } = await generateFileRecord({
                db: db,
                fileSourcePath: filePath,
                spaceId: spaceId
            });

            const registryRecord = await getfileRegistryRecord(db, registryId);
            for (const record of fileIndexRecords) {
                expect(record.registryId).toBe(registryId);
                expect(record.rootHash).toBe(registryRecord.rootHash);
                expect(record.hash).toBeDefined();
            }
        })

        it('should derive space virtual info from source if not provided', async () => {
            const progressEvents = [];
            emitter.on(filePath, context => { progressEvents.push(context) });

            const { registryId, fileIndexRecords } = await generateFileRecord({
                db: db,
                fileSourcePath: filePath,
                spacePath: '/home/',
                spaceFilename: 'movie.mp4',
                spaceId: spaceId
            });

            const registryRecord = await getfileRegistryRecord(db, registryId);
            expect(registryRecord.spacePath).toBeDefined();
            expect(registryRecord.spaceFilename).toBeDefined();
        })
    })
})