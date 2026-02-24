const bcrypt = require('bcrypt')
const { registerLocalUser } = require('../services/userService')
const { loginWithPassword, refreshSession, createCookieOptions } = require('../services/authService')
const { generateTokenPair } = require('../services/tokenService')
const {
  createEmailToken,
  findEmailToken,
  markEmailTokenUsed,
  invalidateEmailTokensForUser,
  createResetToken,
  findResetToken,
  markResetTokenUsed,
} = require('../models/tokenModel')
const { hashToken } = require('../utils/crypto')
const { sendVerificationEmail, sendResetEmail } = require('../services/mailService')
const { markEmailVerified, findUserByEmail, findUserById, updateUser } = require('../models/userModel')

async function register(req, res, next) {
  try {
    const { email, password, name } = req.body || {}
    const validationErrors = {}

    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    const normalizedName = typeof name === 'string' ? name.trim() : ''
    const normalizedPassword = typeof password === 'string' ? password : ''

    if (!normalizedName) {
      validationErrors.name = 'Name is required'
    }

    if (!normalizedEmail) {
      validationErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      validationErrors.email = 'Email format is invalid'
    }

    if (!normalizedPassword) {
      validationErrors.password = 'Password is required'
    } else if (normalizedPassword.length < 8) {
      validationErrors.password = 'Password must be at least 8 characters'
    }

    if (Object.keys(validationErrors).length > 0) {
      console.warn('Register validation failed:', {
        email: normalizedEmail || null,
        nameLength: normalizedName.length,
        errors: validationErrors,
      })
      return res.status(400).json({ error: 'Validation error', details: validationErrors })
    }

    const user = await registerLocalUser({
      email: normalizedEmail,
      password: normalizedPassword,
      profile: { name: normalizedName },
    })

    const { raw, hashed } = generateTokenPair()
    await createEmailToken({
      user_id: user.id,
      token_hash: hashed,
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    })
    await sendVerificationEmail(user.email, raw)

    res.status(201).json({ id: user.id, email: user.email })
  } catch (err) {
    console.error('Register failed:', {
      message: err?.message,
      status: err?.status,
      stack: err?.stack,
    })
    next(err)
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body
    const { user, access, refresh } = await loginWithPassword(email, password, {
      ip: req.ip,
      user_agent: req.get('user-agent') || 'unknown',
    })

    res.cookie('access_token', access, createCookieOptions(false))
    res.cookie('refresh_token', refresh, createCookieOptions(true))
    console.info('[Auth] Set auth cookies (login)', { userId: user.id, email: user.email })
    
    // Return full user profile
    res.json({ 
      id: user.id, 
      email: user.email,
      name: user.profile?.name,
      picture: user.profile?.avatar
    })
  } catch (err) {
    next(err)
  }
}

async function logout(req, res, next) {
  try {
    res.clearCookie('access_token')
    res.clearCookie('refresh_token')
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

async function refreshToken(req, res, next) {
  try {
    const refresh = req.cookies.refresh_token
    if (!refresh) {
      const err = new Error('Refresh token missing')
      err.status = 401
      throw err
    }
    const { user, access, refresh: newRefresh } = await refreshSession(refresh)
    res.cookie('access_token', access, createCookieOptions(false))
    res.cookie('refresh_token', newRefresh, createCookieOptions(true))
    console.info('[Auth] Set auth cookies (refresh)', { userId: user.id, email: user.email })
    
    // Return full user profile including Google avatar
    res.json({ 
      id: user.id, 
      email: user.email,
      name: user.profile?.name,
      picture: user.profile?.avatar
    })
  } catch (err) {
    next(err)
  }
}

async function getProfile(req, res, next) {
  try {
    console.info('[Auth] /me called', { userId: req.user.id, email: req.user.email })
    // Return full user profile including Google avatar
    res.json({ 
      id: req.user.id, 
      email: req.user.email,
      name: req.user.profile?.name,
      picture: req.user.profile?.avatar
    })
  } catch (err) {
    next(err)
  }
}

async function verifyEmail(req, res, next) {
  try {
    const { token } = req.body
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token is required' })
    }
    const tokenHash = hashToken(token)
    const record = await findEmailToken(tokenHash)
    if (!record || record.used_at || new Date(record.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired token' })
    }
    const user = await findUserById(record.user_id)
    if (user?.email_verified) {
      return res.status(400).json({ error: 'Email already verified' })
    }
    await markEmailVerified(record.user_id)
    await markEmailTokenUsed(record.id)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}

async function resendVerification(req, res, next) {
  try {
    const { email } = req.body
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    if (!normalizedEmail) {
      return res.status(400).json({ error: 'Email is required' })
    }
    const user = await findUserByEmail(normalizedEmail)
    if (!user) {
      return res.json({ ok: true })
    }
    if (user.email_verified) {
      return res.status(400).json({ error: 'Email already verified' })
    }
    await invalidateEmailTokensForUser(user.id)
    const { raw, hashed } = generateTokenPair()
    await createEmailToken({
      user_id: user.id,
      token_hash: hashed,
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    })
    await sendVerificationEmail(normalizedEmail, raw)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    if (!normalizedEmail) {
      return res.json({ ok: true })
    }
    const user = await findUserByEmail(normalizedEmail)
    if (!user) {
      return res.json({ ok: true })
    }
    const { raw, hashed } = generateTokenPair()
    await createResetToken({
      user_id: user.id,
      token_hash: hashed,
      expires_at: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
    })
    await sendResetEmail(normalizedEmail, raw)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}

async function resetPassword(req, res, next) {
  try {
    const { token, newPassword } = req.body
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token is required' })
    }
    if (!newPassword || typeof newPassword !== 'string') {
      return res.status(400).json({ error: 'Password is required' })
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' })
    }
    const tokenHash = hashToken(token)
    const record = await findResetToken(tokenHash)
    if (!record || record.used_at || new Date(record.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired token' })
    }
    const password_hash = await bcrypt.hash(newPassword, 12)
    await updateUser(record.user_id, { password_hash })
    await markResetTokenUsed(record.id)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  register,
  login,
  logout,
  refreshToken,
  getProfile,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
}
