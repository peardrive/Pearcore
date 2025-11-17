import Corestore from 'corestore'
import Hyperbee from 'hyperbee'
import path from 'path';
import fs from 'fs';

/**
 * Create or retrieve a Hyperbee instance from a Corestore feed.
 * @param {string} storePath - Path to the Corestore storage directory.
 * @param {string} dbName - Logical name of the database (used if `key` is not provided).
 * @param {Buffer|string|null} [key=null] - Optional feed key for retrieving an existing feed.
 * @returns {Promise<Hyperbee>} - A ready-to-use Hyperbee instance.
 */
export async function getBee(storePath, dbName, key = null) {
  if (!fs.existsSync(feedPath)) fs.mkdirSync(feedPath, { recursive: true });
  // Initialize Corestore at given path
  const store = new Corestore(storePath)

  // Get feed: use key if provided, otherwise create/get feed by name
  const feed = key ? store.get({ key }) : store.get({ name: dbName })
  await feed.ready()

  // Wrap feed in Hyperbee
  const bee = new Hyperbee(feed, {
    keyEncoding: 'utf-8',
    valueEncoding: 'json'
  })
  await bee.ready()

  return bee
}

export async function addFileMetadata(db, filePath, fileHash, chunkHashes) {
  await db.put(filePath, { fileHash, chunkHashes, timestamp: Date.now() });
}

export async function getFileMetadata(db, filePath) {
  return db.get(filePath).then(r => r?.value);
}

export async function listFiles(db) {
  const result = {};
  for await (const node of db.createReadStream({})) {
    result[node.key] = node.value;
  }
  return result;
}
