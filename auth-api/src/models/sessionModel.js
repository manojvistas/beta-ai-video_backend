const { surreal } = require('../db/surreal')
const { unwrapQueryRecord } = require('../db/queryUtils')

async function createSession({ user_id, jwt_id, ip, user_agent, refresh_hash }) {
  const data = {
    user_id,
    jwt_id,
    ip,
    user_agent,
    refresh_hash,
    revoked_at: null,
    created_at: new Date().toISOString(),
  }
  const result = await surreal.query('CREATE sessions CONTENT $data RETURN AFTER', { data })
  return unwrapQueryRecord(result)
}

async function findSessionByJti(jwt_id) {
  const result = await surreal.query('SELECT * FROM sessions WHERE jwt_id = $jwt_id LIMIT 1', { jwt_id })
  return unwrapQueryRecord(result)
}

async function revokeSession(id) {
  const updates = { revoked_at: new Date().toISOString() }
  const result = await surreal.query('UPDATE $id MERGE $updates RETURN AFTER', { id, updates })
  return unwrapQueryRecord(result)
}

module.exports = { createSession, findSessionByJti, revokeSession }
