const { surreal } = require('../db/surreal')
const { unwrapQueryRecord } = require('../db/queryUtils')

let usersSchemaEnsured = false

async function ensureUsersSchema() {
  if (usersSchemaEnsured) {
    return
  }

  try {
    await surreal.query(
      'DEFINE TABLE users SCHEMALESS; DEFINE INDEX users_email_unique ON users FIELDS email UNIQUE'
    )
    usersSchemaEnsured = true
  } catch (error) {
    console.warn('Unable to ensure users schema:', error?.message || error)
  }
}

async function createUser({ email, password_hash, provider, profile }) {
  await ensureUsersSchema()
  const data = {
    email,
    password_hash,
    provider,
    email_verified: false,
    email_verified_at: null,
    profile: profile || {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  try {
    const result = await surreal.query('CREATE users CONTENT $data RETURN AFTER', { data })
    const record = unwrapQueryRecord(result)
    if (!record) {
      const error = new Error('Failed to create user')
      error.status = 500
      throw error
    }
    return record
  } catch (error) {
    const message = error?.message || ''
    if (message.toLowerCase().includes('unique') || message.toLowerCase().includes('duplicate')) {
      const err = new Error('Email already registered')
      err.status = 409
      throw err
    }
    throw error
  }
}

async function findUserByEmail(email) {
  const result = await surreal.query('SELECT * FROM users WHERE email = $email LIMIT 1', { email })
  return unwrapQueryRecord(result)
}

async function findUserById(id) {
  const result = await surreal.query('SELECT * FROM type::record($id)', { id })
  return unwrapQueryRecord(result)
}

async function updateUser(id, updates) {
  updates.updated_at = new Date().toISOString()
  const result = await surreal.query('UPDATE $id MERGE $updates RETURN AFTER', { id, updates })
  return unwrapQueryRecord(result)
}

async function markEmailVerified(id) {
  return updateUser(id, {
    email_verified: true,
    email_verified_at: new Date().toISOString(),
  })
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  updateUser,
  markEmailVerified,
}
