const bcrypt = require('bcrypt')
const crypto = require('crypto')
const { env } = require('../config/env')
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt')
const { findUserByEmail, findUserById } = require('../models/userModel')
const { createSession, findSessionByJti, revokeSession } = require('../models/sessionModel')
const { hashToken } = require('../utils/crypto')

function parseTtlToMs(ttl) {
  if (!ttl || typeof ttl !== 'string') {
    return null
  }
  const match = ttl.trim().match(/^(\d+)([smhd])$/)
  if (!match) {
    return null
  }
  const value = Number(match[1])
  const unit = match[2]
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 }
  return value * multipliers[unit]
}

function createCookieOptions(isRefresh) {
  const appUrl = env.APP_URL || ''
  const isHttps = appUrl.startsWith('https://')
  const isProd = env.NODE_ENV === 'production'
  const secure = isProd && isHttps
  const sameSite = secure ? 'none' : 'lax'
  const maxAge = parseTtlToMs(isRefresh ? env.JWT_REFRESH_TTL : env.JWT_ACCESS_TTL)

  const options = {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
  }

  if (maxAge) {
    options.maxAge = maxAge
  }

  return options
}

async function loginWithPassword(email, password, meta) {
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
  const normalizedPassword = typeof password === 'string' ? password : ''

  const user = await findUserByEmail(normalizedEmail)
  if (!user || !user.password_hash) {
    const err = new Error('Invalid credentials')
    err.status = 401
    throw err
  }

  const valid = await bcrypt.compare(normalizedPassword, user.password_hash)
  if (!valid) {
    const err = new Error('Invalid credentials')
    err.status = 401
    throw err
  }

  const jwt_id = crypto.randomBytes(16).toString('hex')
  const access = signAccessToken({ sub: user.id, email: user.email })
  const refresh = signRefreshToken({ sub: user.id, jti: jwt_id })

  await createSession({
    user_id: user.id,
    jwt_id,
    ip: meta?.ip || null,
    user_agent: meta?.user_agent || 'unknown',
    refresh_hash: hashToken(refresh),
  })

  return { user, access, refresh }
}

async function refreshSession(refreshToken) {
  if (!refreshToken) {
    const err = new Error('Refresh token missing')
    err.status = 401
    throw err
  }

  const payload = verifyRefreshToken(refreshToken)
  const session = await findSessionByJti(payload.jti)
  if (!session || session.revoked_at) {
    const err = new Error('Refresh token invalid')
    err.status = 401
    throw err
  }

  if (session.refresh_hash && session.refresh_hash !== hashToken(refreshToken)) {
    const err = new Error('Refresh token invalid')
    err.status = 401
    throw err
  }

  const user = await findUserById(payload.sub)
  if (!user) {
    const err = new Error('User not found')
    err.status = 401
    throw err
  }

  await revokeSession(session.id)

  const newJwtId = crypto.randomBytes(16).toString('hex')
  const access = signAccessToken({ sub: user.id, email: user.email })
  const refresh = signRefreshToken({ sub: user.id, jti: newJwtId })

  await createSession({
    user_id: user.id,
    jwt_id: newJwtId,
    ip: session.ip || null,
    user_agent: session.user_agent || 'unknown',
    refresh_hash: hashToken(refresh),
  })

  return { user, access, refresh }
}

module.exports = { loginWithPassword, refreshSession, createCookieOptions }

