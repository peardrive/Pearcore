import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import chokidar from 'chokidar';
import { createReadStream } from 'fs';
import { and, eq } from 'drizzle-orm';
import { now } from './general.utils.js';
import { fileIndex, fileRegistry } from '../database/schemas/file.schema.js';
import { hex } from './crypto.utils.js';
import { getFileSize } from './system.utils.js';
import { generateMerkleTree } from './merkleTree.utils.js';
import { getSpace } from './space.utils.js';

export const DEFAULT_CHUNK_SIZE = 256 * 1024; // 256KB

/**
 * Recursively list all files under a root directory
 * @param {string} root - Root directory to list files from.
 */
export async function listFiles(root) {
    const entries = await fs.readdir(root, {
        recursive: true,
        withFileTypes: true
    });

    return entries
        .filter(item => item.isFile())
        .map(item => {
            const absolutePath = path.join(item.parentPath ?? root, item.name);
            const relativePath = path.relative(root, absolutePath);
            return relativePath.split(path.sep).join('/');
        });
}

//mapping chokidar library events
export const WatchTypes = {
    ADD: 'add',
    CHANGE: 'change',
    DELETE: 'unlink'
};

/**
 * Wathes multiple files for change using chokidar.
 * @param {string[]} paths - Array of file paths
 */
export function createWatcher(paths) {
    // convert all paths to absolute
    paths.map(p => path.resolve(p));

    const watcher = chokidar.watch(paths, {
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: true
    });

    return watcher;
}

/**
 * Create space directory from the file source path.
 * @param {string} source - file source path.
 * @returns {string} returns the generated space path.
 */
export const getSpacePathFromSource = source => {
    const baseDirectory = path.resolve(os.homedir());
    const localFilePath = path.resolve(source);

    const relativePath = path.relative(baseDirectory, localFilePath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        return '.';
    }

    return path.dirname(relativePath.replace(/\\/g, '/'));
};

/**
 * Extracts the filename from file source path and return as space filename
 * @param {string} source - file source path.
 * @returns {string} returns the filename.
 */
export const getSpaceFilenameFromSource = source => {
    return path.basename(source);
};


export function buildfileRegistryPayload(params) {
    return {
        fileSourcePath: params.fileSourcePath,
        timestamp: params.timestamp || now(),
        spaceId: params.spaceId,
        spacePath: params.spacePath || getSpacePathFromSource(params.fileSourcePath),
        spaceFilename: params.spaceFilename || getSpaceFilenameFromSource(params.fileSourcePath),
        rootHash: params.rootHash,
        leafCount: params.leafCount,
        height: params.height
    };
}

/**
 * Creates a new file registery record in the database.
 * @param {Object} db - Database instance.
 * @param {Object} params - Input paylod.
 * @param {string} params.fileSourcePath - File source path.
 * @param {number} params.timestamp - Timestamp of the file registry.
 * @param {number} params.spaceId - Space ID that the file is assigned to.
 * @param {string} params.spacePath - Space virtual path.
 * @param {string} params.spaceFilename - Space virtual filename.
 * @param {rootHash} params.rootHash - Root hash string of the merkle tree.
 * @param {number} params.leafCount - Number of all leaf node hashes within the merkle tree.
 * @param {number} params.height - Depth value of the merkle tree.
 * @returns {Promise<Object>} Resolves when the record has been inserted into the database
 */
export async function createfileRegistryRecord(db, params) {
    const payload = buildfileRegistryPayload(params);
    const result = await db.insert(fileRegistry).values(payload).returning({ registryId: fileRegistry.id });
    return result[0];
}

/**
 * Get a single file regitry record by ID.
 * @param {Object} db - Database instance.
 * @param {number} registeryId - ID of the file registry.
 * @returns 
 */
export async function getfileRegistryRecord(db, registeryId) {
    return await db.select()
        .from(fileRegistry)
        .where(eq(fileRegistry.id, registeryId))
        .get();
}

/**
 * Create query filters for file registry records based on the given criteria.
 * @param {Object} filters - Filter criteria object.
 * @param {number} filters.id - Unique registry ID (primary key).
 * @param {string} filters.fileSourcePath - Original file path on the device.
 * @param {number} filters.timestamp - Unix timestamp when the registry was created.
 * @param {number} filters.spaceId - Foreign key referencing the space.
 * @param {string} filters.spacePath - Artificial directory path within the space.
 * @param {string} filters.spaceFilename - Artificial filename within the space.
 * @param {string} filters.rootHash - Root hash of the Merkle tree (optional).
 * @param {number} filters.leafCount - Total number of leaf nodes in the Merkle tree.
 * @param {number} filters.height - Height of the Merkle tree.
 * @returns {Array} An array of Drizzle equality conditions (`eq`) to be used in a `where()` clause.
 */
function createFileRegistryQueryFilters(filters) {
    const conditions = [];

    if (filters.id !== undefined) {
        conditions.push(eq(fileRegistry.id, filters.id));
    }
    if (filters.fileSourcePath !== undefined) {
        conditions.push(eq(fileRegistry.fileSourcePath, filters.fileSourcePath));
    }
    if (filters.timestamp !== undefined) {
        conditions.push(eq(fileRegistry.timestamp, filters.timestamp));
    }
    if (filters.spaceId !== undefined) {
        conditions.push(eq(fileRegistry.spaceId, filters.spaceId));
    }
    if (filters.spacePath !== undefined) {
        conditions.push(eq(fileRegistry.spacePath, filters.spacePath));
    }
    if (filters.spaceFilename !== undefined) {
        conditions.push(eq(fileRegistry.spaceFilename, filters.spaceFilename));
    }
    if (filters.rootHash !== undefined) {
        conditions.push(eq(fileRegistry.rootHash, filters.rootHash));
    }
    if (filters.leafCount !== undefined) {
        conditions.push(eq(fileRegistry.leafCount, filters.leafCount));
    }
    if (filters.height !== undefined) {
        conditions.push(eq(fileRegistry.height, filters.height));
    }

    return conditions;
}

/**
 * Query file registry records using filters.
 * @param {Objectc} db - Database instance.
 * @param {Object} filters - Filter criteria object.
 * @param {number} filters.id - Unique registry ID (primary key).
 * @param {string} filters.fileSourcePath - Original file path on the device.
 * @param {number} filters.timestamp - Unix timestamp when the registry was created.
 * @param {number} filters.spaceId - Foreign key referencing the space.
 * @param {string} filters.spacePath - Artificial directory path within the space.
 * @param {string} filters.spaceFilename - Artificial filename within the space.
 * @param {string} filters.rootHash - Root hash of the Merkle tree (optional).
 * @param {number} filters.leafCount - Total number of leaf nodes in the Merkle tree.
 * @param {number} filters.height - Height of the Merkle tree.
 * @returns 
 */
export async function queryFileRegistryRecords(db, filters) {
    const conditions = createFileRegistryQueryFilters(filters);
    const query = db.select().from(fileRegistry);
    
    if (conditions.length > 0) {
        return await query.where(and(...conditions));
    }

    return await query;
}

/**
 * Update a single file registry record by ID.
 * @param {object} db - Database instance.
 * @param {number} registeryId - ID of the file registry.
 * @param {Object} params - Input paylod.
 * @param {string} params.fileSourcePath - File source path.
 * @param {number} params.timestamp - Timestamp of the file registry.
 * @param {number} params.spaceId - Space ID that the file is assigned to.
 * @param {string} params.spacePath - Space virtual path.
 * @param {string} params.spaceFilename - Space virtual filename.
 * @param {rootHash} params.rootHash - Root hash string of the merkle tree.
 * @param {number} params.leafCount - Number of all leaf node hashes within the merkle tree.
 * @param {number} params.height - Depth value of the merkle tree.
 * @returns {Promise<void>} - Resolves when the record updated in the database.
 */
export async function updateFileRegistryRecord(db, registeryId, params) {
    const payload = buildfileRegistryPayload(params);
    return await db.update(fileRegistry)
        .set(payload)
        .where(eq(fileRegistry.id, registeryId));
}


/**
 * List all file registry records.
 * @param {Object} db - Database instance.
 * @returns {Promise<Array>} Resolves when list of all records has been fetched.
 */
export async function listFileRegisteryRecords(db) {
    return await db.select().from(fileRegistry).all();
}

/**
 * Get referenced space object from registry record.
 * @param {Object} db - Database instace.
 * @param {Object} record - The file registry record.
 * @returns {Promise<Object>} - Resolves with associated space object.
 */
export async function getSpaceFromRegistryRecord(db, record) {
    if (!record && !record.spaceId) {
        throw new Error('file registry record does not include spaceId paramater');
    }

    const space = await getSpace(db, record.spaceId);
    return space;
}


export function buildFileIndexPayload(params) {
    return {
        registryId: params.registryId,
        rootHash: params.rootHash,
        level: params.level,
        hash: params.hash,
        parentHash: params.parentHash || null,
        leftChildHash: params.leftChildHash || null,
        rightChildHash: params.rightChildHash || null,
        leafIndex: params.leafIndex || null
    };
}

/**
 * Create a new file index record in the database.
 * @param {Object} db - Database instace. 
 * @param {Object} params - Input paylod.
 * @param {string} params.rootHash - Root hash string of the merkle tree.
 * @param {number} params.level - Current node's level in the merkle tree.
 * @param {string} params.parentHash - Parent node's hash value relative to the current node.
 * @param {string} params.leftChildHash - The first child node of the current node.
 * @param {string} params.rightChildHash - The second child node of the current node.
 * @param {number|null} params.leafIndex - Leaf node ordered index. If the node is not leaf, then it's null.
 * @returns {Promise<{hash: string, rootHash: string}>} - Resolves when the record inserted into the database.
 */
export async function createFileIndexRecord(db, params) {
    const payload = buildFileIndexPayload(params);
    const result = await db.insert(fileIndex).values(payload).returning({
        registryId: fileIndex.registryId,
        hash: fileIndex.hash,
        rootHash: fileIndex.rootHash
    });

    return result[0];
}

/**
 * Create query filters for file index records based on the given criteria.
 * @param {Object} filters - Filter criteria object.
 * @param {number} filters.registryId - File registry ID foreign key.
 * @param {string} filters.rootHash - Root hash string of the Merkle tree.
 * @param {string} filters.hash - Node's hash value.
 * @param {number} filters.level - Current node's level in the Merkle tree (0 = root).
 * @param {string} filters.parentHash - Parent node's hash value relative to the current node.
 * @param {string} filters.leftChildHash - The first child node of the current node.
 * @param {string} filters.rightChildHash - The second child node of the current node.
 * @param {number} filters.leafIndex - Leaf index (only relevant for leaf nodes).
 * @returns {Array} An arrayn of Drizzle conditions.
 */
function createFileIndexQueryFilters(filters) {
    const conditions = [];

    if (filters.registryId !== undefined) {
        conditions.push(eq(fileIndex.registryId, filters.registryId));
    }

    if (filters.rootHash !== undefined) {
        conditions.push(eq(fileIndex.rootHash, filters.rootHash));
    }

    if (filters.hash !== undefined) {
        conditions.push(eq(fileIndex.hash, filters.hash));
    }

    if (filters.level !== undefined) {
        conditions.push(eq(fileIndex.level, filters.level));
    }

    if (filters.parentHash !== undefined) {
        conditions.push(eq(fileIndex.parentHash, filters.parentHash));
    }

    if (filters.leftChildHash !== undefined) {
        conditions.push(eq(fileIndex.leftChildHash, filters.leftChildHash));
    }

    if (filters.rightChildHash !== undefined) {
        conditions.push(eq(fileIndex.rightChildHash, filters.rightChildHash));
    }

    if (filters.leafIndex !== undefined) {
        conditions.push(eq(fileIndex.leafIndex, filters.leafIndex));
    }

    return conditions;
}

/**
 * Query file index records using filters.
 * @param {Object} db - Database instance.
 * @param {Object} filters - Filter criteria object.
 * @param {number} filters.registryId - File registry ID foreign key.
 * @param {string} filters.rootHash - Root hash string of the Merkle tree.
 * @param {string} filters.hash - Node's hash value.
 * @param {number} filters.level - Current node's level in the Merkle tree (0 = root).
 * @param {string} filters.parentHash - Parent node's hash value relative to the current node.
 * @param {string} filters.leftChildHash - The first child node of the current node.
 * @param {string} filters.rightChildHash - The second child node of the current node.
 * @param {number} filters.leafIndex - Leaf index (only relevant for leaf nodes).
 * @returns {Promise<Array<Object>>} Resolves when query has been fetched from database.
 */
export async function queryFileIndexRecord(db, filters) {
    const conditions = createFileIndexQueryFilters(filters);
    const query = db.select().from(fileIndex);

    if (conditions.length > 0) {
        return await query.where(and(...conditions));
    }

    return await query;
}

export function createFileStream(filePath, chunksize = DEFAULT_CHUNK_SIZE) {
    return createReadStream(filePath, { highWaterMark: chunksize });
}

/**
 * Create file registry record and merkle tree indexing
 * @param {Object} params 
 * @param {Object} params.db - Database instace.
 * @param {string} params.fileSourcePath - Local file path.
 * @param {string} params.spacePath - Virtual directory path for space.
 * @param {string} params.spaceFilename - Virtual file name for space.
 * @param {number} params.spaceId - ID of space for reference.
 * @param {EventEmitter} params.emitter - Optional emitter to track indexing progress.
 * @returns {Promise<{fileRegistry: Object, fileIndexRecords: Array}>} Resolves when the file indexing has been complete.
 */
export async function generateFileRecord(params) {
    const {
        db,
        fileSourcePath,
        spacePath,
        spaceFilename,
        spaceId,
        emitter = null,
    } = params;

    const source = path.resolve(fileSourcePath);
    const stream = createFileStream(source);
    const size = await getFileSize(source);
    const tree = await generateMerkleTree({
        stream: stream,
        size: size,
        emitter: emitter,
        chunkSize: DEFAULT_CHUNK_SIZE,
    });
    const rootHash = hex(tree.levels[0][0].hash);

    const { registryId } = await createfileRegistryRecord(db, {
        fileSourcePath: source,
        spacePath: spacePath || getSpacePathFromSource(source),
        spaceFilename: spaceFilename || getSpaceFilenameFromSource(source),
        spaceId: spaceId,
        leafCount: tree.leafCount,
        height: tree.height,
        rootHash: rootHash
    });

    const fileIndexRecords = [];
    for (let index = 1; index < tree.height; index++) {
        const currentLevel = tree.levels[index];

        for (const node of currentLevel) {
            const isNull = obj => obj === null;

            const record = await createFileIndexRecord(db, {
                registryId: registryId,
                rootHash: rootHash,
                level: index,
                parentHash: hex(node.parentHash),
                hash: hex(node.hash),
                leftChildHash: hex(node.leftChild),
                rightChildHash: isNull(node.rightChild) ? null : hex(node.rightChild),
                leafIndex: node.leafIndex
            });

            fileIndexRecords.push(record);
        }
    }

    return { registryId, fileIndexRecords, rootHash };
}

/**
 * Deletes file registry with all related indexing records from database.
 * @param {Object} db - Database instace.
 * @param {number} registryId - ID of the file registry record.
 * @returns {Promise<void>}
 */
export async function deleteFileRecord(db, registryId) {
    // delete file registry record
    await db.delete(fileRegistry).where(eq(fileRegistry.id, registryId));
    // delete all file indexing records
    await db.delete(fileIndex).where(eq(fileIndex.registryId, registryId));
}