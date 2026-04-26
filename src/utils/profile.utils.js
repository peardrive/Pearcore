import { and, eq, gte, lte, like, asc, desc } from 'drizzle-orm';
import { userProfiles } from "../database/schemas/profile.schema.js";
import { verifySignedJSON, hexToUint8, signJSON } from "../utils/crypto.utils.js";
import { isTimestampNewer, isValidURL, now, stripIds, validateHexString, validateTimestamp } from "../utils/general.utils.js";

/**
 * Build the canonical payload object that should be signed/verified.
 *
 * Ensures the same field names/structure used for signing.
 *
 * @param {Object} input
 * @param {string} input.username
 * @param {string} input.tag
 * @param {string} [input.profileURL]
 * @param {string} input.publicKey
 * @returns {Object} payload to sign/verify
 */
export function buildProfilePayload(input) {
  return {
    username: input.username,
    tag: input.tag,
    profileURL: input.profileURL,
    publicKey: input.publicKey,
    timestamp: input.timestamp
  };
}

/**
 * 
 * @param {String} publicKey - 64 character hex string for publicKey
 * @returns {Object} - Returns Object with pre-loaded profile parameters
 */
export function createPreloadedProfile(publicKey) {
  return buildProfilePayload({
    username: "unkown",
    tag: "no_tag",
    profileURL: null,
    publicKey: publicKey,
    timestamp: now()
  })
}

/**
 * Validates the structure of profile object to ensure it meets all required criteria.
 * @param {Object} profile - the profile object for validation
 * @returns {{isValid: boolean, reason: string}} An object indicating whether validation passed and the reason for failure if it did not.
 *         If `isValid` is true, then `reason` will be `'profile is valid'`.
 *         Otherwise, `reason` describes which field failed validation.
 */
export function validateProfileContext(profile) {
  const notNull = (obj) => obj !== null;
  const notUndefined = (obj) => obj !== undefined;
  const shouldBeDefined = (obj) => notNull(obj) && notUndefined(obj);

  const validationRules = [
    ['username is required', () => shouldBeDefined(profile.username)],
    ['tag is required', () => shouldBeDefined(profile.tag)],
    ['profileURL is required', () => notUndefined(profile.profileURL)],
    ['publicKey is required', () => shouldBeDefined(profile.publicKey)],
    ['signature is required', () => shouldBeDefined(profile.signature)],
    ['timestamp is required', () => shouldBeDefined(profile.timestamp)],

    ['username should be string', () => typeof profile.username === 'string'],
    ['username should not a larger that 64 characters', () => profile.username.length <= 64],

    ['tag should be string', () => typeof profile.tag === 'string'],
    ['tag should not a larger that 64 characters', () => profile.tag.length <= 64],

    ['profileURL should be a string or null', () => typeof profile.profileURL === 'string' || !notNull(profile.profileURL)],
    ['profileURL should be a valid URL if not null', () => notNull(profile.profileURL) ? isValidURL(profile.profileURL) : true],
    ['profileURL is too long (as string)', () => notNull(profile.profileURL) ? profile.profileURL.length <= 2048 : true],

    ['signature should be a string', () => typeof profile.signature === 'string'],
    ['signature should be 128 characters long', () => profile.signature.length === 128],
    ['signature should be a valid hex string', () => validateHexString(profile.signature)],

    ['timestamp should be a valid date', () => validateTimestamp(profile.timestamp)],
  ];

  for (const [reason, condition] of validationRules) {
    if (!condition()) {
      return {
        isValid: false,
        reason: reason
      };
    }
  }

  return {
    isValid: true,
    reason: 'profile is valid'
  };
}

/**
 * Verify a profile payload with a hex signature and hex publicKey.
 *
 * @param {Object} payload - object produced by buildProfilePayload
 * @param {string} signature - signature as hex string
 * @returns {Promise<boolean>} true if signature valid
 */
export async function verifyProfileSignature(profile) {
  if (!profile.publicKey) return false;
  if (!profile.signature) return false;
  if (!validateHexString(profile.publicKey)) return false;
  if (!validateHexString(profile.signature)) return false;

  const signatureHex = profile.signature;
  const publicKeyBytes = hexToUint8(profile.publicKey);

  const payload = buildProfilePayload(profile);
  const signatureIsOK = await verifySignedJSON(payload, signatureHex, publicKeyBytes);

  return signatureIsOK;
}

/**
 * Create database filter conditions for user profile queries.
 * Handles all user profile field filters including timestamp ranges and text field searches.
 *
 * @param {Object} filters - query filters (all optional)
 * @param {string} filters.username - exact username match
 * @param {string} filters.tag - exact tag match
 * @param {string} filters.profileURL - exact profile URL match
 * @param {string} filters.publicKey - exact public key match
 * @param {string} filters.signature - exact signature match
 * @param {Object} filters.timestampRange - timestamp range filter
 * @param {number} filters.timestampRange.start - start timestamp (inclusive)
 * @param {number} filters.timestampRange.end - end timestamp (inclusive)
 * @returns {Array} array of SQL conditions for use with drizzle-orm's and() function
 */
export function createProfileFilter(filters = {}) {
  const conditions = [];

  if (filters.username) {
    conditions.push(eq(userProfiles.username, filters.username));
  }

  if (filters.tag) {
    conditions.push(eq(userProfiles.tag, filters.tag));
  }

  if (filters.profileURL) {
    conditions.push(eq(userProfiles.profileURL, filters.profileURL));
  }

  if (filters.publicKey) {
    conditions.push(eq(userProfiles.publicKey, filters.publicKey));
  }

  if (filters.timestampRange) {
    const { start, end } = filters.timestampRange;
    if (start !== undefined) {
      conditions.push(gte(userProfiles.timestamp, start));
    }
    if (end !== undefined) {
      conditions.push(lte(userProfiles.timestamp, end));
    }
  }

  return conditions;
}

/**
 * Get order expression for user profile queries.
 *
 * @param {Object} filters - query filters
 * @param {string} filters.orderBy - field to order by: 'id', 'username', 'tag', 'timestamp'
 * @param {string} filters.orderDirection - 'asc' for ascending, 'desc' for descending
 * @returns {Object} drizzle-orm order expression
 * @throws {Error} if orderBy value is invalid
 */
function getProfileOrderExpression(filters = {}) {
  // Whitelist and map allowed orderBy keys to actual column objects
  const orderByMap = {
    id: userProfiles.id,
    username: userProfiles.username,
    tag: userProfiles.tag,
    timestamp: userProfiles.timestamp,
  };

  const orderByKey = typeof filters.orderBy === 'string' ? filters.orderBy : 'timestamp';
  const orderByField = orderByMap[orderByKey];

  if (!orderByField) {
    throw new Error(`Invalid orderBy value: ${String(filters.orderBy)}. Allowed: ${Object.keys(orderByMap).join(', ')}`);
  }

  // Canonicalize orderDirection
  const orderDir = (typeof filters.orderDirection === 'string' && filters.orderDirection.toLowerCase() === 'asc')
    ? 'asc'
    : 'desc';

  return orderDir === 'asc' ? asc(orderByField) : desc(orderByField);
}

/**
 * Get pagination limits for user profile queries.
 *
 * @param {Object} filters - query filters
 * @param {number} filters.limit - maximum records to return
 * @param {number} filters.offset - records to skip
 * @returns {Object} object with limit and offset properties
 */
function getPaginationLimits(filters = {}) {
  const limit = Math.min(
    typeof filters.limit === 'number' && filters.limit > 0 ? filters.limit : 50,
    500 // Maximum limit to prevent excessive queries
  );
  const offset = typeof filters.offset === 'number' && filters.offset >= 0 ? filters.offset : 0;

  return { limit, offset };
}

/**
 * Query user profile records with filtering, ordering, and pagination.
 *
 * @param {Object} db - Drizzle database instance
 * @param {Object} filters - query filters (see createProfileFilter for details)
 * @returns {Promise<Array>} array of user profile records
 */
export async function queryProfileRecord(db, filters = {}) {

  // build filters and ordering
  const conditions = createProfileFilter(filters);
  const orderExpr = getProfileOrderExpression(filters);
  const { limit, offset } = getPaginationLimits(filters);

  // setup dribble query
  let query = db.select().from(userProfiles);
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  // finally query profiles
  const results = await query
    .orderBy(orderExpr)
    .limit(limit)
    .offset(offset)
    .all();

  return results
}

/**
 * Get a single user profile by public key.
 * Convenience wrapper around queryProfileRecord.
 *
 * @param {Object} db - Drizzle database instance
 * @param {string} publicKey - public key to search for
 * @returns {Promise<Object|null>} user profile or null if not found
 */
export async function getProfileByPublicKey(db, publicKey) {
  const results = await queryProfileRecord(db, {
    publicKey,
    limit: 1
  });

  return results[0] || null;
}

/**
 * Create a new user profile.
 * Note: profile should not already exist.
 * @param {Object} db - Drizzle DB instance
 * @param {Object} input - profile input
 * @param {string} input.publicKey
 * @param {string} input.username
 * @param {string} [input.tag]
 * @param {string|null} [input.profileURL]
 * @param {Uint8Array} secretKey - Ed25519 secret key
 * @param {number} [timestamp] - unix epoch seconds (defaults to now)
 *
 * @returns {Promise<Object>} created profile row
 *
 * @throws {Error} if profile already exists
 * @throws {Error} if required fields are missing
 */
export async function createProfile(db, input) {
  const inserted = await db.insert(userProfiles)
    .values({
      username: input.username,
      tag: input.tag,
      profileURL: input.profileURL,
      publicKey: input.publicKey,
      timestamp: input.timestamp,
      signature: input.signature
    })
    .returning({
      id: userProfiles.id,
      username: userProfiles.username,
      tag: userProfiles.tag,
      profileURL: userProfiles.profileURL,
      publicKey: userProfiles.publicKey,
      signature: userProfiles.signature,
      timestamp: userProfiles.timestamp,
    })

  return inserted[0];
}

/**
 * Get a single profile by ID.
 * @param {Object} db - Database instance
 * @param {number} profileID - The ID of the profile
 * @returns {Object|null} Resolves when profile has been getched from database.
 */
export async function getProfile(db, profileId) {
  const profile = await db.select()
    .from(userProfiles)
    .where(eq(userProfiles.id, profileId))
    .get();

    if (!profile) return null;
    return profile;
}

/**
 * Update an existing profile.
 * @param {Object} db - Drizzle DB instance
 * @param {number} profileId - ID of the profile to update
 * @param {Object} input 
 * @param {Object} input.username 
 * @param {Object} input.tag
 * @param {Object} input.publicKey
 * @param {Object} input.timestamp
 * @param {Object} input.signature
 */
export async function updateProfile(db, profileId, input) {
  await db.update(userProfiles)
    .set({
      username: input.username,
      tag: input.tag,
      publicKey: input.publicKey,
      timestamp: input.timestamp,
      signature: input.signature
    })
    .where(eq(userProfiles.id, profileId));

  return { profileId };
}

/**
 * Upsert (verify then insert/update) a user profile identified by publicKey.
 *
 * All DB modifications are performed inside a transaction to avoid races.
 *
 * @param {Object} db - Drizzle DB instance (supports db.transaction)
 * @param {Object} input - profile input
 * @returns {Promise<Object>} final profile row (inserted/updated/existing)
 */
export async function upsertVerifiedUserProfile(db, input) {
  const payload = buildProfilePayload(input);
  const signature = input.signature;

  if (!hasValidRequiredProfileFields(payload)) {
    throw new Error("Profile payload is missing required fields");
  }

  const isValid = await verifyProfileSignature(payload, signature);
  if (!isValid) {
    throw new Error("Invalid signature for user profile payload");
  }

  const existing = await getProfileByPublicKey(db, payload.publicKey)
  return db.transaction((tx) => {
    if (!existing) {
      return tx
        .insert(userProfiles)
        .values({
          username: payload.username,
          tag: payload.tag,
          profileURL: payload.profileURL ?? null,
          publicKey: payload.publicKey,
          signature: input.signature,
          timestamp: payload.timestamp,
        })
        .returning({
          id: userProfiles.id,
          username: userProfiles.username,
          tag: userProfiles.tag,
          profileURL: userProfiles.profileURL,
          publicKey: userProfiles.publicKey,
          signature: userProfiles.signature,
          timestamp: userProfiles.timestamp,
        })
        .get();
    }

    // EXISTING but timestamp not newer → no-op
    if (!isTimestampNewer(payload.timestamp, existing.timestamp)) {
      return existing;
    }

    // UPDATE if newer
    return tx
      .update(userProfiles)
      .set({
        username: payload.username,
        tag: payload.tag,
        profileURL: payload.profileURL ?? null,
        timestamp: payload.timestamp,
        signature,
      })
      .where(eq(userProfiles.publicKey, payload.publicKey))
      .returning({
        id: userProfiles.id,
        username: userProfiles.username,
        tag: userProfiles.tag,
        profileURL: userProfiles.profileURL,
        publicKey: userProfiles.publicKey,
        signature: userProfiles.signature,
        timestamp: userProfiles.timestamp,
      })
      .get();
  });
}

/**
 * Create a profile given keypair credentials.
 * 
 * @param {Object} db - Drizzle DB instance
 * @param {Object} input - profile input (username, tag, profileURL, publicKey)
 * @param {Uint8Array} secretKey - Ed25519 secret key
 * @param {number} [timestamp] - unix epoch seconds (defaults to now)
 * @returns {Promise<Object>} final profile row
 */
export async function createProfileForPublicKey(db, input, secretKey) {
  const profilePayload = buildProfilePayload({
    ...input,
    timestamp: now()
  });

  const signature = await signJSON(profilePayload, secretKey);
  return createProfile(db, { ...profilePayload, signature });
}


/**
 * Update a profile given keypair credentials.
 * 
 * @param {Object} db - Drizzle DB instance
 * @param {Object} input - profile input (username, tag, profileURL, publicKey)
 * @param {Uint8Array} secretKey - Ed25519 secret key
 * @param {number} [timestamp] - unix epoch seconds (defaults to now)
 * @returns {Promise<Object>} final profile row
 */
export async function updateProfileForPublicKey(db, profileId, input, secretKey) {
  const profile = await getProfile(db, profileId);
  if (!profile) throw new Error('Profile not found');

  const profilePayload = buildProfilePayload({
    ...profile,
    ...input,
    timestamp: now()
  });

  const signature = await signJSON(profilePayload, secretKey);
  return updateProfile(db, profileId, { ...profilePayload, signature });
}