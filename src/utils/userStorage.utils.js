import Hyperbee from 'hyperbee'
import Corestore from 'corestore'

export async function createUserBee(storePath, key = null) {
  const store = new Corestore(storePath)
  const feed = key ? store.get({ key }) : store.get()
  await feed.ready()
  const bee = new Hyperbee(feed, {
    keyEncoding: 'utf-8',
    valueEncoding: 'json'
  })
  await bee.ready()
  return bee
}


/**
 * @param {Hyperbee} bee
 * @param {string} username
 * @param {object} userRecord - { ts, meta, pow, sig, pubkey }
 */
export async function putUserRecord(bee, username, userRecord) {
  return bee.put(username.toLowerCase(), userRecord)
}

/**
 * @param {Hyperbee} bee
 * @param {string} username
 * @param {object} userRecord - { ts, meta, pow, sig, pubkey }
 */
export async function putUserRecord(bee, username, userRecord) {
  return bee.put(username.toLowerCase(), userRecord)
}

export async function getUserRecord(bee, username) {
  const entry = await bee.get(username.toLowerCase())
  return entry?.value || null
}

export async function deleteUserRecord(bee, username) {
  return bee.del(username.toLowerCase())
}

export async function listUsers(bee) {
  const result = []
  for await (const { key, value } of bee.createReadStream()) {
    result.push({ username: key, record: value })
  }
  return result
}

export async function searchUsersByMeta(bee, filterFn) {
  const results = []
  for await (const { key, value } of bee.createReadStream()) {
    if (filterFn(value.meta)) results.push({ username: key, record: value })
  }
  return results
}

