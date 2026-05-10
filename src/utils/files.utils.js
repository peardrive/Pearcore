import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import chokidar from 'chokidar';
import { createReadStream } from 'fs';
import { EventEmitter } from 'node:events';
import { eq } from 'drizzle-orm';
import { now } from './general.utils.js';
import { fileIndex, fileRegistry } from '../database/schemas/file.schema.js';
import { hex, hash } from './crypto.utils.js';

const DEFAULT_CHUNK_SIZE = 1 * 1024 * 1024; // 4 MB

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
export async function updatefileRegistryRecord(db, registeryId, params) {
    const payload = buildfileRegistryPayload(params);
    return await db.update(fileRegistry)
        .set(payload)
        .where(eq(fileRegistry.id, registeryId));
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

export function createFileStream(filePath, chunksize = DEFAULT_CHUNK_SIZE) {
    return createReadStream(filePath, { highWaterMark: chunksize });
}

/**
 * 
 * @param {string} filePath 
 * @param {EventEmitter} emitter 
 * @returns 
 */
export async function generateMerkleTree(filePath, emitter = null) {
    const stream = createFileStream(filePath);
    // get the file size
    const stats = await fs.stat(filePath)
    const fileSize = stats.size;
    // calculate the height and leaf count from file size
    const leafCount = fileSize === 0 ? 1 : Math.ceil(
        fileSize / DEFAULT_CHUNK_SIZE
    )
    const height = Math.ceil(Math.log2(leafCount));

    const computeTotalSteps = leafCount => {
        let total = leafCount;
        let count = leafCount;
        while (count > 1) {
            count = Math.ceil(count / 2);
            total += count;
        }
        return total;
    }

    const totalSteps = computeTotalSteps(leafCount);

    // optionally emit progress events when emitter is provided
    let stepCount = 0;
    const emitProgress = () => {
        stepCount++;

        if (emitter) {
            emitter.emit(filePath, {
                currentStep: stepCount,
                totalSteps: totalSteps
            });
        }
    }

    const leafHashes = [];

    for await (const chunk of stream) {
        leafHashes.push(hash(chunk));
        emitProgress();
    }

    if (leafHashes.length === 0) {
        leafHashes.push(hash(Buffer.alloc(0)));
        emitProgress();
    }

    const levels = [];
    levels[height] = leafHashes.map((hash, index) => ({
        hash: hash,
        leafIndex: index
    }));

    for (let currentHeight = height; currentHeight >= 1; currentHeight--) {
        const currentLevel = levels[currentHeight];
        const parentLevel = [];

        for (let index = 0; index < currentLevel.length; index = index + 2) {
            const isLastNode = index + 1 >= currentLevel.length;

            const left = currentLevel[index].hash;
            const right = !isLastNode ? currentLevel[index + 1].hash : null;

            const combined = !isLastNode ? Buffer.concat([left, right]) : Buffer.from(left);
            const parentHash = hash(combined);

            parentLevel.push({
                hash: parentHash,
                leftChild: left,
                rightChild: isLastNode ? null : right,
                leafIndex: null,
            });

            levels[currentHeight][index].parentHash = parentHash;
            if (!isLastNode) {
                levels[currentHeight][index + 1].parentHash = parentHash;
            }

            emitProgress();
        }

        levels[currentHeight - 1] = parentLevel;
    }

    return {
        levels,
        height,
        leafCount
    };
}

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
    const tree = await generateMerkleTree(source, emitter);
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

    return { registryId, fileIndexRecords };
}