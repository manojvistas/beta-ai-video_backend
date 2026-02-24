const bcrypt = require('bcrypt')
const { createUser, findUserByEmail, updateUser } = require('../models/userModel')

async function registerLocalUser({ email, password, profile }) {
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
  const existing = await findUserByEmail(normalizedEmail)
  if (existing) {
    const err = new Error('Email already registered')
    err.status = 409
    throw err
  }
  const password_hash = await bcrypt.hash(password, 12)
  return createUser({ email: normalizedEmail, password_hash, provider: 'local', profile })
}

async function findOrCreateGoogleUser(profile) {
  const email = profile.emails?.[0]?.value
  const existing = await findUserByEmail(email)
  if (existing) {
    // Merge Google profile data into existing user (name + avatar)
    const mergedProfile = {
      ...existing.profile,
      name: existing.profile?.name || profile.displayName,
      avatar: profile.photos?.[0]?.value || existing.profile?.avatar,
    }
    const updates = { profile: mergedProfile, provider: existing.provider === 'local' ? 'google' : existing.provider }
    const updated = await updateUser(existing.id, updates)
    return updated || existing
  }

  const user = await createUser({
    email,
    password_hash: null,
    provider: 'google',
    profile: { name: profile.displayName, avatar: profile.photos?.[0]?.value },
  })
  await updateUser(user.id, { email_verified: true, email_verified_at: new Date().toISOString() })
  return user
}

module.exports = { registerLocalUser, findOrCreateGoogleUser }
