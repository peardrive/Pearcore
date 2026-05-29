import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";
import { spaces } from "./space.schema.js";

/**
 * fileRegistry table definition.
 * 
 * Stores all registery informations about files 
 * that the device wants to share inside spaces.
 * 
 * Columns:
 * - id: Primary key. Unique integer indentifier for the file registery.
 * - fileSourcePath: The actual file source path to register and create indexes.
 * - timestamp: Unix timestamp indicating when the file registery was created.
 * - spaceId: Foreign key referencing `space.id`.
 * - spacePath: Artificial directory as replacement of real destination within space.
 * - spaceFilename: Artificial filename as replacement of real filename within space.
 * - rootHash: The root hash value generated from Merkele Tree indexing.
 * - leafCount: Total number of leaf nodes for complete Merkle Tree.
 * - height: The height of Merkle Tree indexing.
 */
export const fileRegistry = sqliteTable('file_registry', {
    id: integer("id").primaryKey(),

    fileSourcePath: text("file_path").notNull(),
    timestamp: integer("timestamp").notNull(),

    spaceId: integer("space_id").notNull()
        .references(() => spaces.id),

    spacePath: text("space_path").notNull(),
    spaceFilename: text("space_filename").notNull(),

    rootHash: text("root_hash"),
    leafCount: integer("leaf_count").notNull(),
    height: integer("height").notNull(),
});


/**
 * FileIndex table definition.
 * 
 * Represents merkle tree node information including the node hash, 
 * branch level and the related tree root.
 * 
 * Columns: 
 * - registryId: Primary Key. Unique Integer identifier for file index.
 * - rootHash: The root hash value generated from Merkele Tree indexing.
 * - level: The height level that node is currenctly placed. Level 0 is the root.
 * - hash: The node's hash value.
 * - parentHash: The higher branch hash value.
 */
export const fileIndex = sqliteTable("file_index", {
    registryId: integer("file_registry_id").notNull()
        .references(() => fileRegistry.id),

    rootHash: text("root_hash").notNull(),
    level: integer("level").notNull(),
    hash: text("hash").notNull(),
    parentHash: text("parent_hash"),
    leftChildHash: text("left_child_hash"),
    rightChildHash: text("right_child_hash"),
    leafIndex: integer("leaf_index"),
}, (table) => [
    // Create a composite publicKey from rootHash and node's hash
    primaryKey({ columns: [table.registryId, table.rootHash, table.hash] }),
    index('hash_index').on(table.hash),
    index('root_hash_index').on(table.rootHash),
]);