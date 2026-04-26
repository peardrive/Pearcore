import { sqliteTable, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

import { spaces } from "./space.schema.js";
import { userProfiles } from "./profile.schema.js";

/**
 * Space Members Join Table
 *
 * Many-to-many relationship between userProfiles and spaces.
 * A user may join multiple spaces, and each space may have many users.
 * 
 * Columns:
 * - id: Primary key for the membership entry.
 * - spaceId: Foreign key referencing the space the user belongs to.
 * - userProfileId: Foreign key referencing the joined user profile.
 * - joinedAt: Timestamp (unix epoch) indicating when the user joined the space.
 */
export const spaceMembers = sqliteTable("space_members", {
  id: integer("id").primaryKey(),

  /** FK → spaces.id (the space being joined) */
  spaceId: integer("space_id")
    .notNull()
    .references(() => spaces.id),

  /** FK → user_profiles.id (the user joining the space) */
  userProfileId: integer("user_profile_id")
    .notNull()
    .references(() => userProfiles.id),

  /** Unix timestamp for when the user joined the space */
  joinedAt: integer("joined_at").notNull(),
});

/**
 * Relations for the spaceMembers join table.
 *
 * Provides:
 * - space: Parent space of this membership entry
 * - userProfile: Profile associated with this membership
 */
export const spaceMembersRelations = relations(spaceMembers, ({ one }) => ({
  space: one(spaces, {
    fields: [spaceMembers.spaceId],
    references: [spaces.id],
  }),
  userProfile: one(userProfiles, {
    fields: [spaceMembers.userProfileId],
    references: [userProfiles.id],
  }),
}));