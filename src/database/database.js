import path from 'node:path';
import fs from 'node:fs/promises';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { accountDotDir } from '../utils/accounts.utils.js';
import { DRIZZLE_MIGRATIONS_PATH } from "../constants/database.constants.js";

/**
 * Ensure the migrations folder exists.
 * @param {string} migrationsDir 
 */
async function ensureMigrationsFolder(migrationsDir) {
  try {
    await fs.access(migrationsDir);
  } catch {
    await fs.mkdir(migrationsDir, { recursive: true });
  }
}

/**
 * Create a new SQLite database and apply migrations.
 * @param {string} dbPath
 * @param {string} migrationsDir
 */
export async function createDatabase(dbPath, migrationsDir) {
  await fs.mkdir(path.dirname(dbPath), { recursive: true });

  const sqlite = new Database(dbPath); // creates file if missing
  const db = drizzle(sqlite);

  await ensureMigrationsFolder(migrationsDir);

  // Apply migrations
  await migrate(db, { migrationsFolder: migrationsDir });

  return { sqlite, db };
}

/**
 * Load an existing SQLite database and apply migrations.
 * @param {string} dbPath
 * @param {string} migrationsDir
 */
export async function loadDatabase(dbPath, migrationsDir) {
  try {
    await fs.access(dbPath);
  } catch {
    throw new Error(`Database file missing: ${dbPath}`);
  }

  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite);

  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('busy_timeout = 5000');

  await ensureMigrationsFolder(migrationsDir);

  // Apply migrations
  await migrate(db, { migrationsFolder: migrationsDir });

  return { sqlite, db };
}

/**
 * Loads the database for a given account username.
 * Creates the DB if it does not exist and applies migrations.
 *
 * @param {string} username - The account username.
 * @param {string} root - The root directory where account data is stored.
 * @param {string} [migrationsDir=DRIZZLE_MIGRATIONS_PATH] - Directory containing Drizzle migrations.
 * @returns {{ sqlite: Database, db: ReturnType<typeof drizzle> }}
 */
export async function loadAccountDatabase(username, root, migrationsDir = DRIZZLE_MIGRATIONS_PATH) {
  const dbPath = path.join(accountDotDir(username, root), "spacebook.sqlite");

  try {
    await fs.access(dbPath);
    return await loadDatabase(dbPath, migrationsDir);
  } catch {
    // Database file does not exist, create a new one
    return await createDatabase(dbPath, migrationsDir);
  }
}
