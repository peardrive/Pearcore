import path from 'path';
import fs from 'fs/promises';
import chokidar from 'chokidar';
import { fileURLToPath } from 'url';
import * as EVENTS from '../../src/constants/events.constants.js';
import { generateRandomFile, makeTempDir } from "../../tests/general.utils.js";
import { createCore } from "../../src/core.js";

const BOOSTRAPPER = "127.0.0.1:49737";

// Get current directory for sharelink file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    // Get directory to watch from command line argument
    const watchDir = process.argv[2];
    if (!watchDir) {
        console.error('Usage: node script.js <directory-to-watch>');
        process.exit(1);
    }

    // Resolve and validate directory
    const absoluteWatchDir = path.resolve(watchDir);
    try {
        await fs.access(absoluteWatchDir);
    } catch (err) {
        console.error(`Directory does not exist: ${absoluteWatchDir}`);
        process.exit(1);
    }
    console.log(`Watching directory: ${absoluteWatchDir}`);

    // Create temporary core root and core instance
    const root = await makeTempDir();
    const core = await createCore({ rootPath: root, bootstrap: BOOSTRAPPER });

    const username = 'benchUser';
    const password = 'benchPass';
    await core.accounts.create(username, password);
    await core.accounts.authenticate(username, password);

    // Create space
    const space = await core.space.create({ 
        spaceName: 'PearDrop', 
        permissionRead: 1, 
        permissionBroadcast: 1 
    });

    // Write sharelink to file
    const shareLinkFilePath = path.join(__dirname, 'sharelink.txt');
    await fs.writeFile(shareLinkFilePath, space.sharelink, 'utf8');
    console.log(`Sharelink written to ${shareLinkFilePath}`);

    // Set up watcher
    const watcher = chokidar.watch(absoluteWatchDir, {
        persistent: true,
        ignoreInitial: true,   // don't fire for existing files
        awaitWriteFinish: true // wait for file to be fully written
    });

    // Helper: compute spacePath relative to watched directory (POSIX, starts with '/')
    function getSpacePath(filePath) {
        const relativePath = path.relative(absoluteWatchDir, path.dirname(filePath));
        // Convert Windows backslashes to POSIX slashes
        const posixRelative = relativePath.split(path.sep).join('/');
        // If file is in the root of watched directory, spacePath = '/'
        if (posixRelative === '' || posixRelative === '.') {
            return '/';
        }
        return '/' + posixRelative;
    }

    // Handle file added
    watcher.on('add', async (filePath) => {
        console.log(`[ADD] ${filePath}`);
        try {
            const spacePath = getSpacePath(filePath);
            const spaceFilename = path.basename(filePath);
            const result = await core.managers.spaceFiles.addLocalFile(space, {
                filePath,
                spacePath,
                spaceFilename
            });
            console.log(`[ADD] Shared: ${spacePath}/${spaceFilename} -> ${result}`);
        } catch (err) {
            console.error(`[ADD] Failed to share ${filePath}:`, err.message);
        }
    });

    // Handle file deleted
    watcher.on('unlink', async (filePath) => {
        console.log(`[DELETE] ${filePath}`);
        try {
            const results = await core.managers.spaceFiles.deleteLocalFile(space, { filePath });
            console.log(`[DELETE] Unshared ${filePath} -> ${results.length} record(s) removed`);
        } catch (err) {
            console.error(`[DELETE] Failed to unshare ${filePath}:`, err.message);
        }
    });

    // Optional: handle errors
    watcher.on('error', (err) => {
        console.error('Watcher error:', err);
    });

    console.log(`Watching for file additions/deletions in ${absoluteWatchDir}. Press Ctrl+C to stop.`);

    // Keep process alive
    process.on('SIGINT', async () => {
        console.log('\nStopping watcher and cleaning up...');
        await watcher.close();
        await core.managers.spaceFiles.stop(); // stop internal watcher if any
        process.exit(0);
    });
}

main().catch(error => console.error('Fatal error:', error));