import { hash } from "./crypto.utils.js";

/**
 * 
 * @param {string} filePath 
 * @param {EventEmitter} emitter 
 * @returns 
 */
export async function generateMerkleTree({ stream, size, chunkSize, emitter = null, taskName = 'merkle tree indexing' }) {
    // calculate the height and leaf count from file size
    const leafCount = size === 0 ? 1 : Math.ceil(
        size / chunkSize
    );

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
            emitter.emit(taskName, {
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