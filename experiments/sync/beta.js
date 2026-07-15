import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { fileURLToPath } from 'url';
import * as EVENTS from '../../src/constants/events.constants.js';
import { makeTempDir } from "../../tests/general.utils.js";
import { createCore } from "../../src/core.js";

const BOOSTRAPPER = "127.0.0.1:49737";

// Get current directory for sharelink file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    // Get download directory from command line argument
    const downloadDirArg = process.argv[2];
    if (!downloadDirArg) {
        console.error('Usage: node download.js <download-directory>');
        process.exit(1);
    }

    const downloadDir = path.resolve(downloadDirArg);
    try {
        await fs.access(downloadDir);
    } catch (err) {
        // Create directory if it doesn't exist
        await fs.mkdir(downloadDir, { recursive: true });
        console.log(`Created download directory: ${downloadDir}`);
    }
    console.log(`Download directory: ${downloadDir}`);

    // Read sharelink from sharelink.txt
    const shareLinkFilePath = path.join(__dirname, 'sharelink.txt');
    let sharelink;
    try {
        sharelink = await fs.readFile(shareLinkFilePath, 'utf8');
        sharelink = sharelink.trim();
        console.log(`Read sharelink from ${shareLinkFilePath}: ${sharelink}`);
    } catch (error) {
        console.error(`Failed to read sharelink from ${shareLinkFilePath}:`, error.message);
        process.exit(1);
    }

    // Create temporary core root and core instance
    const root = await makeTempDir();
    const core = await createCore({ rootPath: root, bootstrap: BOOSTRAPPER });

    const username = 'benchUser';
    const password = 'benchPass';
    await core.accounts.create(username, password);
    await core.accounts.authenticate(username, password);

    // ------------------------------------------------------------------
    // Handle incoming file announcements – auto‑download / delete / sync
    // All files are stored under the user‑provided downloadDir (single hierarchy).
    // ------------------------------------------------------------------
    core.emitter.on(EVENTS.SpaceFileAction, async (message) => {
        console.log('[SpaceFileAction]', message);
        const { action, context } = message.payload;

        // Resolve space from topic
        const topicMap = await core.managers.storage.generateSpaceTopicHashMap();
        const space = topicMap[message.topic];

        if (!space) {
            console.error(`Unknown space for topic ${message.topic}`);
            return;
        }

        switch (action) {
            case 'add': {
                const { spaceFilePath, rootHash } = context;
                const destination = path.join(downloadDir, spaceFilePath);
                const dir = path.dirname(destination);
                if (!fsSync.existsSync(dir)) {
                    await fs.mkdir(dir, { recursive: true });
                }

                if (fsSync.existsSync(destination)) {
                    console.log(`[Download] File already exists: ${destination}`);
                    break;
                }

                console.log(`[Download] Starting download of ${spaceFilePath} (rootHash: ${rootHash})`);
                try {
                    await core.managers.spaceFiles.downloadFromSpace(space, spaceFilePath, rootHash, destination);
                    console.log(`[Download] Finished: ${destination}`);
                } catch (err) {
                    console.error(`[Download] Failed: ${err.message}`);
                }
                break;
            }

            case 'delete': {
                const { spaceFilePath } = context;
                const localPath = path.join(downloadDir, spaceFilePath);
                if (fsSync.existsSync(localPath)) {
                    await fs.unlink(localPath);
                    console.log(`[Delete] Removed local file: ${localPath}`);
                } else {
                    console.log(`[Delete] File not found locally: ${localPath}`);
                }
                break;
            }

            case 'sync': {
                const hierarchy = context;
                for (const [spaceFilePath, variants] of Object.entries(hierarchy)) {
                    const rootHash = variants[0]?.rootHash;
                    if (!rootHash) continue;

                    const destination = path.join(downloadDir, spaceFilePath);
                    if (fsSync.existsSync(destination)) {
                        console.log(`[Sync] File already exists: ${destination}`);
                        continue;
                    }
                    const dir = path.dirname(destination);
                    if (!fsSync.existsSync(dir)) {
                        await fs.mkdir(dir, { recursive: true });
                    }

                    console.log(`[Sync] Downloading ${spaceFilePath}`);
                    try {
                        await core.managers.spaceFiles.downloadFromSpace(space, spaceFilePath, rootHash, destination);
                        console.log(`[Sync] Downloaded: ${destination}`);
                    } catch (err) {
                        console.error(`[Sync] Failed to download ${spaceFilePath}: ${err.message}`);
                    }
                }
                break;
            }

            default:
                console.warn(`Unknown action: ${action}`);
        }

        console.log('[FileListMap]', core.managers.spaceFileList.fileListMap);
    });

    core.emitter.on(EVENTS.SpaceSync, async (c) => {
        console.log('[SpaceSync]', c);
    });

    // Join the space
    const space = await core.space.join(sharelink);

    await core.space.send(spaceContext, "hello world");

    // core.profile.list()
    // core.profile.get(publicKey)
    // core.profile.creat()

    console.log(`Joined space: ${space.spaceName || 'unknown'}`);

    console.log(`Download‑only client running. Waiting for file announcements. Press Ctrl+C to stop.`);

    // Keep process alive
    process.on('SIGINT', async () => {
        console.log('\nShutting down...');
        await core.managers.spaceFiles.stop();
        process.exit(0);
    });
}

main().catch(error => console.error('Fatal error:', error));