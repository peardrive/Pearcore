import path from "path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { CoreFactory } from "../factory.js";
import { cleanup, generateRandomFile, makeTempDir } from "../general.utils.js";
import { getSpaceTopicHash } from "../../src/utils/space.utils.js";

const exampleFileList = {
    '/doc1.txt': {
        'hashA1': {
            peers: {
                'peerA': { timestamp: 1000, signature: 'sigA1' },
                'peerB': { timestamp: 1001, signature: 'sigB1' }
            }
        },
        'hashA2': {
            peers: {
                'peerC': { timestamp: 1002, signature: 'sigC2' },
                'peerD': { timestamp: 1003, signature: 'sigD2' }
            }
        }
    },

    '/doc2.pdf': {
        'hashB1': {
            peers: {
                'peerE': { timestamp: 2000, signature: 'sigE1' },
                'peerF': { timestamp: 2001, signature: 'sigF1' }
            }
        },
        'hashB2': {
            peers: {
                'peerG': { timestamp: 2002, signature: 'sigG2' },
                'peerH': { timestamp: 2003, signature: 'sigH2' }
            }
        }
    },

    '/doc3.zip': {
        'hashC1': {
            peers: {
                'peerI': { timestamp: 3000, signature: 'sigI1' },
                'peerJ': { timestamp: 3001, signature: 'sigJ1' }
            }
        },
        'hashC2': {
            peers: {
                'peerK': { timestamp: 3002, signature: 'sigK2' },
                'peerL': { timestamp: 3003, signature: 'sigL2' }
            }
        }
    }
}

const exampleFileStack = [
    ['/doc1.txt', 'peerA', 1000, 'hashA1', 'sigA1'],
    ['/doc1.txt', 'peerB', 1001, 'hashA1', 'sigB1'],
    ['/doc1.txt', 'peerC', 1002, 'hashA2', 'sigC2'],
    ['/doc1.txt', 'peerD', 1003, 'hashA2', 'sigD2'],
    ['/doc2.pdf', 'peerE', 2000, 'hashB1', 'sigE1'],
    ['/doc2.pdf', 'peerF', 2001, 'hashB1', 'sigF1'],
    ['/doc2.pdf', 'peerG', 2002, 'hashB2', 'sigG2'],
    ['/doc2.pdf', 'peerH', 2003, 'hashB2', 'sigH2'],
    ['/doc3.zip', 'peerI', 3000, 'hashC1', 'sigI1'],
    ['/doc3.zip', 'peerJ', 3001, 'hashC1', 'sigJ1'],
    ['/doc3.zip', 'peerK', 3002, 'hashC2', 'sigK2'],
    ['/doc3.zip', 'peerL', 3003, 'hashC2', 'sigL2']
]

describe('SpaceFileListManager', () => {
    let factory = null;
    let core = null;
    let manager = null;

    beforeEach(async () => {
        factory = new CoreFactory();
        await factory.init();

        core = await factory.createCore();
        manager = core.managers.spaceFileList;
    });

    afterEach(async () => {
        await factory.cleanup();
    });

    describe('add', () => {
        it('should add new entry when nothing exists', () => {
            manager.add({
                topic: 'topic1',
                publicKey: 'peerA',
                path: '/file.txt',
                rootHash: 'abc123',
                timestamp: 1000,
                signature: 'abc'
            });

            const state = manager.get('topic1');
            expect(state).toEqual({
                "/file.txt": {
                    "abc123": {
                        peers: { "peerA": { timestamp: 1000, signature: 'abc' } }
                    }
                }
            })
        });

        it('should add new path to an existing topic', () => {
            manager.add({
                topic: "topic1",
                path: "/file1.txt",
                rootHash: "abc",
                publicKey: "peerA",
                timestamp: 1000
            });

            manager.add({
                topic: "topic1",
                path: "/file2.txt",
                rootHash: "def",
                publicKey: "peerB",
                timestamp: 2000
            });

            const state = manager.get("topic1");
            expect(state).toHaveProperty("/file1.txt");
            expect(state).toHaveProperty("/file2.txt");
            expect(Object.keys(state).length).toBe(2);
        });

        it('should add a new variant to an existing path', () => {
            manager.add({
                topic: "topic1",
                path: "/file.txt",
                rootHash: "abc",
                publicKey: "peerA",
                timestamp: 1000,
                signature: 'abc'
            });

            manager.add({
                topic: "topic1",
                path: "/file.txt",
                rootHash: "def",
                publicKey: "peerB",
                timestamp: 2000,
                signature: 'cba'
            });

            const variants = manager.get("topic1")["/file.txt"];
            expect(variants).toEqual({
                "abc": { peers: { "peerA": { timestamp: 1000, signature: 'abc' } } },
                "def": { peers: { "peerB": { timestamp: 2000, signature: 'cba' } } }
            });
        });

        it('should add a new peer to and existing variant', () => {
            manager.add({
                topic: "topic1",
                path: "/file.txt",
                rootHash: "abc",
                publicKey: "peerA",
                timestamp: 1000,
                signature: 'abc'
            });


            manager.add({
                topic: "topic1",
                path: "/file.txt",
                rootHash: "abc",
                publicKey: "peerB",
                timestamp: 2000,
                signature: 'cba'
            });

            const variant = manager.get("topic1")["/file.txt"]["abc"];
            expect(variant.peers).toEqual({
                "peerA": { timestamp: 1000, signature: 'abc' },
                "peerB": { timestamp: 2000, signature: 'cba' }
            });
        });

        it("should update timestamp when incoming is newer", () => {
            manager.add({
                topic: "t", path: "/f", rootHash: "rh", publicKey: "pk", timestamp: 1000, signature: 'abc'
            });
            manager.add({
                topic: "t", path: "/f", rootHash: "rh", publicKey: "pk", timestamp: 2000, signature: 'cba'
            });

            const variant = manager.get("t")["/f"]["rh"];
            expect(variant.peers).toEqual({ "pk": { timestamp: 2000, signature: 'cba' } });
        });

        it("should move peer to new variant when timestamp is newer", () => {
            manager.add({
                topic: "t", path: "/f", rootHash: "old", publicKey: "pk", timestamp: 1000, signature: 'abc'
            });
            manager.add({
                topic: "t", path: "/f", rootHash: "new", publicKey: "pk", timestamp: 2000, signature: 'cba'
            });

            const variants = manager.get("t")["/f"];
            expect(variants).toEqual({
                "new": { peers: { "pk": { timestamp: 2000, signature: 'cba' } } }
            });
            expect(variants["old"]).toBeUndefined();
        });

        it("should ignore move when timestamp is older than existing variant", () => {
            manager.add({
                topic: "t", path: "/f", rootHash: "new", publicKey: "pk", timestamp: 2000, signature: 'abc'
            });
            manager.add({
                topic: "t", path: "/f", rootHash: "old", publicKey: "pk", timestamp: 1000, signature: 'cba'
            });

            const variants = manager.get("t")["/f"];
            expect(variants).toEqual({
                "new": { peers: { "pk": { timestamp: 2000, signature: 'abc' } } }
            });
        });
    });

    describe('remove', () => {
        it('should remove peer from variation', () => {
            manager.add({
                topic: "t", path: "/f", rootHash: "old", publicKey: "pk", timestamp: 1000, signature: 'abc'
            });

            manager.remove({ topic: 't', path: '/f', publicKey: 'pk' });
            expect(manager.get('t')).toEqual({});
        });
    });

    describe('merge', () => {
        it('should merge foreign entries and ignore the local publickey', () => {
            manager.add({
                topic: 't',
                path: '/existing.txt',
                rootHash: 'rh1',
                publicKey: 'peerA',
                timestamp: 1000,
                signature: 'sigA'
            });

            const remoteFileList = {
                '/existing.txt': {
                    'rh1': {
                        peers: {
                            'peerB': { timestamp: 2000, signature: 'sigB' }   // new foreign peer
                        }
                    }
                },
                '/new.txt': {
                    'rh2': {
                        peers: {
                            'peerC': { timestamp: 4000, signature: 'sigC' }
                        }
                    }
                }
            };

            manager.merge({ topic: 't', fileList: remoteFileList });

            const state = manager.get('t');

            expect(state['/existing.txt']).toEqual({
                'rh1': {
                    peers: {
                        'peerA': { timestamp: 1000, signature: 'sigA' },
                        'peerB': { timestamp: 2000, signature: 'sigB' }
                    }
                }
            });

            expect(state['/new.txt']).toEqual({
                'rh2': {
                    peers: {
                        'peerC': { timestamp: 4000, signature: 'sigC' }
                    }
                }
            });

            // no local publickey registry should be there
            const allPeers = Object.values(state)
                .flatMap(variants => Object.values(variants))
                .flatMap(v => Object.keys(v.peers));
            expect(allPeers).not.toContain('local-pk');
        });
    });

    describe('diff', () => {
        it('should return an empty object when remote file list is empty', () => {
            const result = manager.diff({ topic: 't', fileList: {} });
            expect(result).toEqual({});
        });

        it('should return all remote entries when local state is empty (mode=add)', () => {
            const remoteFileList = {
                '/file1.txt': {
                    'hash1': { peers: { 'peerA': { timestamp: 100, signature: 'sigA' } } }
                },
                '/file2.txt': {
                    'hash2': { peers: { 'peerB': { timestamp: 200, signature: 'sigB' } } }
                }
            };

            const result = manager.diff({ topic: 't', fileList: remoteFileList, mode: 'add' });
            expect(result).toEqual(remoteFileList);
        });

        it('should return zero remote entries when local state is empty (mode=remove)', () => {
            const remoteFileList = {
                '/file1.txt': {
                    'hash1': { peers: { 'peerA': { timestamp: 100, signature: 'sigA' } } }
                },
                '/file2.txt': {
                    'hash2': { peers: { 'peerB': { timestamp: 200, signature: 'sigB' } } }
                }
            };

            const result = manager.diff({ topic: 't', fileList: remoteFileList, mode: 'remove' });
            expect(result).toEqual({});
        });

        it('should exclude entries that already exist locally (mode=add)', () => {
            manager.add({
                topic: 't',
                path: '/doc.txt',
                rootHash: 'abc',
                publicKey: 'peerA',
                timestamp: 1000,
                signature: 'sigA'
            });

            const remoteFileList = {
                '/doc.txt': {
                    'abc': {
                        peers: {
                            'peerA': { timestamp: 1000, signature: 'sigA' },  // exists
                            'peerB': { timestamp: 2000, signature: 'sigB' }   // new
                        }
                    }
                }
            };

            const result = manager.diff({ topic: 't', fileList: remoteFileList });

            expect(result).toEqual({
                '/doc.txt': {
                    'abc': {
                        peers: {
                            'peerB': { timestamp: 2000, signature: 'sigB' }
                        }
                    }
                }
            });
        });

        it('should exclude entries that does not exist locally (mode=remove)', () => {
            manager.add({
                topic: 't',
                path: '/doc.txt',
                rootHash: 'abc',
                publicKey: 'peerA',
                timestamp: 1000,
                signature: 'sigA'
            });

            const remoteFileList = {
                '/doc.txt': {
                    'abc': {
                        peers: {
                            'peerA': { timestamp: 1050, signature: 'sigA' },  // exists
                            'peerB': { timestamp: 2000, signature: 'sigB' }   // new
                        }
                    }
                }
            };

            const result = manager.diff({ topic: 't', fileList: remoteFileList, mode: 'remove' });

            expect(result).toEqual({
                '/doc.txt': {
                    'abc': {
                        peers: {
                            'peerA': { timestamp: 1050, signature: 'sigA' }
                        }
                    }
                }
            });
        });
    });

    describe('convertListToStack', () => {
        it('should convert file list into valid stack', () => {
            const stack = manager.convertListToStack(exampleFileList);
            expect(stack).toEqual(exampleFileStack);
        });
    });

    describe('convertStackToList', () => {
        it('should convert file stack into valid file list', () => {
            const fileList = manager.convertStackToList(exampleFileStack);
            expect(fileList).toEqual(exampleFileList);
        });
    });
});