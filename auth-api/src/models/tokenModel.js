const { surreal } = require('../db/surreal')
const { unwrapQueryRecord } = require('../db/queryUtils')

let emailTokensSchemaEnsured = false
let resetTokensSchemaEnsured = false

async function ensureEmailTokensSchema() {
  if (emailTokensSchemaEnsured) {
    return
  }
  try {
    await surreal.query(
      'DEFINE TABLE email_verification_tokens SCHEMALESS; DEFINE INDEX email_tokens_hash_unique ON email_verification_tokens FIELDS token_hash UNIQUE'
    )
    emailTokensSchemaEnsured = true
  } catch (error) {
    console.warn('Unable to ensure email tokens schema:', error?.message || error)
  }
}

async function ensureResetTokensSchema() {
  if (resetTokensSchemaEnsured) {
    return
  }
  try {
    await surreal.query(
      'DEFINE TABLE password_reset_tokens SCHEMALESS; DEFINE INDEX reset_tokens_hash_unique ON password_reset_tokens FIELDS token_hash UNIQUE'
    )
    resetTokensSchemaEnsured = true
  } catch (error) {
    console.warn('Unable to ensure reset tokens schema:', error?.message || error)
  }
}

async function createEmailToken({ user_id, token_hash, expires_at }) {
  await ensureEmailTokensSchema()
  const data = {
    user_id,
    token_hash,
    expires_at,
    used_at: null,
    created_at: new Date().toISOString(),
  }
  const result = await surreal.query('CREATE email_verification_tokens CONTENT $data RETURN AFTER', { data })
  return unwrapQueryRecord(result)
}

async function findEmailToken(token_hash) {
  await ensureEmailTokensSchema()
  const result = await surreal.query(
    'SELECT * FROM email_verification_tokens WHERE token_hash = $token_hash LIMIT 1',
    { token_hash }
  )
  return unwrapQueryRecord(result)
}

async function markEmailTokenUsed(id) {
  const updates = { used_at: new Date().toISOString() }
  const result = await surreal.query('UPDATE $id MERGE $updates RETURN AFTER', { id, updates })
  return unwrapQueryRecord(result)
}

async function invalidateEmailTokensForUser(user_id) {
  await ensureEmailTokensSchema()
  await surreal.query(
    'UPDATE email_verification_tokens SET used_at = $used_at WHERE user_id = $user_id AND used_at = null',
    { user_id, used_at: new Date().toISOString() }
  )
}

async function createResetToken({ user_id, token_hash, expires_at }) {
  await ensureResetTokensSchema()
  const data = {
    user_id,
    token_hash,
    expires_at,
    used_at: null,
    created_at: new Date().toISOString(),
  }
  const result = await surreal.query('CREATE password_reset_tokens CONTENT $data RETURN AFTER', { data })
  return unwrapQueryRecord(result)
}

async function findResetToken(token_hash) {
  await ensureResetTokensSchema()
  const result = await surreal.query(
    'SELECT * FROM password_reset_tokens WHERE token_hash = $token_hash LIMIT 1',
    { token_hash }
  )
  return unwrapQueryRecord(result)
}

async function markResetTokenUsed(id) {
  const updates = { used_at: new Date().toISOString() }
  const result = await surreal.query('UPDATE $id MERGE $updates RETURN AFTER', { id, updates })
  return unwrapQueryRecord(result)
}

module.exports = {
  createEmailToken,
  findEmailToken,
  markEmailTokenUsed,
  invalidateEmailTokensForUser,
  createResetToken,
  findResetToken,
  markResetTokenUsed,
}
