import path from "path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { CoreFactory } from "../factory.js";
import { cleanup, generateRandomFile, makeTempDir } from "../general.utils.js";
import { getSpaceTopicHash } from "../../src/utils/space.utils.js";

describe('SpaceFileListManager', () => {
    const spaceFilePath = '/folder/file.txt';
    const rootHash = 'abc...xyz';
    const otherPublicKey = 'otherPeerPublicKey';
    const otherRootHash = 'xyz...abc';

    let factory = null;
    let core = null;
    let space = null;
    let topicHash = null;
    let publicKey = null;
    let root = null;

    beforeEach(async () => {
        root = await makeTempDir();
        factory = new CoreFactory();
        await factory.init();

        core = await factory.createCore('user');
        space = await core.space.create({ spaceName: 'test space' });
        topicHash = getSpaceTopicHash(space);
        publicKey = core.publicKey;
    })

    afterEach(async () => {
        await cleanup(root);
    })

    describe('init', () => {
        it('should load local hierarcy', async () => {
            const fileOne = path.join(root, 'movie1.mp4');
            const fileTwo = path.join(root, 'fileTwo.mp4');

            await generateRandomFile(fileOne, 1);
            await generateRandomFile(fileTwo, 1);

            await core.managers.storage.createFileRecord({
                space: space,
                filePath: fileOne,
                spacePath: '/movies/classic',
                spaceFilename: 'fileone.mp4'
            })

            await core.managers.storage.createFileRecord({
                space: space,
                filePath: fileTwo,
                spacePath: '/movies/classic',
                spaceFilename: 'filetwo.mp4'
            });

            const hierarcy = core.managers.spaceFileList.getFileList(topicHash);

            for (const [spaceFilePath, variants] of Object.entries(hierarcy)) {
                // check file path to be valid posix path
                expect(spaceFilePath).toMatch(/^\/[^\\]+$/);
                // check path to contain 3 component (2 folder name and 1 file name)
                const components = spaceFilePath.split('/').filter(c => c !== '');
                expect(components.length).toBe(3);
                // check publicKey to be included as primary provider of the first variant
                expect(variants[0].rootHash).toBeDefined();
                expect(variants[0].peers).toContain(core.publicKey);
            }
        });
    });

    describe('addFile', () => {
        it('should add file to file list', async () => {
            core.managers.spaceFileList.addFile({
                topic: topicHash,
                spaceFilePath: spaceFilePath,
                info: {
                    publicKey: publicKey,
                    rootHash: rootHash
                }
            });

            const hierarchy = core.managers.spaceFileList.getFileList(topicHash);
            expect(hierarchy[spaceFilePath]).toBeDefined();
            expect(hierarchy[spaceFilePath]).toHaveLength(1);
            expect(hierarchy[spaceFilePath][0].rootHash).toBe(rootHash);
            expect(hierarchy[spaceFilePath][0].peers).toEqual([publicKey]);
        })

        it('should not duplicate peer for same file', () => {
            core.managers.spaceFileList.addFile({
                topic: topicHash,
                spaceFilePath: spaceFilePath,
                info: {
                    publicKey: publicKey,
                    rootHash: rootHash
                }
            });

            const hierarchy = core.managers.spaceFileList.getFileList(topicHash);
            const variants = hierarchy[spaceFilePath];

            expect(variants).toHaveLength(1);
            expect(variants[0].peers).toHaveLength(1);
            expect(variants[0].peers[0]).toBe(publicKey);
        })

        it('should add different peer to same variant', () => {
            core.managers.spaceFileList.addFile({
                topic: topicHash,
                spaceFilePath: spaceFilePath,
                info: {
                    publicKey: publicKey,
                    rootHash: rootHash
                }
            });

            core.managers.spaceFileList.addFile({
                topic: topicHash,
                spaceFilePath: spaceFilePath,
                info: {
                    publicKey: otherPublicKey, // new publicKey
                    rootHash: rootHash
                }
            });

            const hierarchy = core.managers.spaceFileList.getFileList(topicHash);
            const variants = hierarchy[spaceFilePath];

            expect(variants).toHaveLength(1);
            expect(variants[0].peers).toHaveLength(2);
            expect(variants[0].peers).toContain(publicKey);
            expect(variants[0].peers).toContain(otherPublicKey);
        })

        it('should add different rootHash as new variant for same peer', () => {
            core.managers.spaceFileList.addFile({
                topic: topicHash,
                spaceFilePath: spaceFilePath,
                info: {
                    publicKey: publicKey,
                    rootHash: rootHash
                }
            });

            core.managers.spaceFileList.addFile({
                topic: topicHash,
                spaceFilePath: spaceFilePath,
                info: {
                    publicKey: publicKey,
                    rootHash: otherRootHash // different root hash
                }
            });

            const hierarchy = core.managers.spaceFileList.getFileList(topicHash);
            const variants = hierarchy[spaceFilePath];

            expect(variants).toHaveLength(1);
            expect(variants[0].peers).toEqual([publicKey]);
        })
    })

    describe('removeFile', () => {
        it('should remove a peer from variant but keep variant if other peers exist', () => {
            core.managers.spaceFileList.addFile({
                topic: topicHash,
                spaceFilePath,
                info: { publicKey, rootHash: rootHash }
            });

            core.managers.spaceFileList.addFile({
                topic: topicHash,
                spaceFilePath,
                info: { publicKey: otherPublicKey, rootHash: rootHash }
            });

            let hierarchy = core.managers.spaceFileList.getFileList(topicHash);
            let variants = hierarchy[spaceFilePath];

            expect(variants).toHaveLength(1);
            expect(variants[0].peers).toEqual([publicKey, otherPublicKey]);

            core.managers.spaceFileList.removeFile({
                topic: topicHash,
                spaceFilePath,
                info: { publicKey, rootHash: rootHash }
            });

            hierarchy = core.managers.spaceFileList.getFileList(topicHash);
            variants = hierarchy[spaceFilePath];

            expect(variants).toHaveLength(1);
            expect(variants[0].peers).toEqual([otherPublicKey]);
            expect(variants[0].rootHash).toBe(rootHash);
        })

        it('should remove the entire variant when the last peer is removed', () => {
            core.managers.spaceFileList.addFile({
                topic: topicHash,
                spaceFilePath,
                info: { publicKey, rootHash: rootHash }
            });

            let hierarchy = core.managers.spaceFileList.getFileList(topicHash);
            expect(hierarchy[spaceFilePath]).toBeDefined();

            core.managers.spaceFileList.removeFile({
                topic: topicHash,
                spaceFilePath,
                info: { publicKey, rootHash: rootHash }
            });

            hierarchy = core.managers.spaceFileList.getFileList(topicHash);
            expect(hierarchy[spaceFilePath]).toBeUndefined();
        })
    })

    describe('mergeHierarchy', () => {
        it('should merge a remove hierarchy', async () => {
            const remoteHierarchy = {
                [spaceFilePath]: [
                    { rootHash: rootHash, peers: [publicKey] }
                ]
            };

            core.managers.spaceFileList.mergeHierarchy(topicHash, remoteHierarchy);
            const hierarchy = core.managers.spaceFileList.getFileList(topicHash);

            expect(hierarchy[spaceFilePath]).toBeDefined();
            expect(hierarchy[spaceFilePath]).toHaveLength(1);
            expect(hierarchy[spaceFilePath][0].rootHash).toBe(rootHash);
            expect(hierarchy[spaceFilePath][0].peers).toEqual([publicKey]);
        })
    })
})

describe('SpaceFileManager', () => {
    
})