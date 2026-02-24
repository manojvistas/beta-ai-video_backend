const bcrypt = require('bcrypt')
const { findUserByEmail, updateUser } = require('../models/userModel')
const { generateTokenPair } = require('../services/tokenService')
const { createResetToken, findResetToken, markResetTokenUsed } = require('../models/tokenModel')
const { hashToken } = require('../utils/crypto')
const { sendResetEmail } = require('../services/mailService')

async function requestReset(req, res, next) {
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

async function updatePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body
    const user = req.user
    if (!user.password_hash) {
      const err = new Error('Password not set')
      err.status = 400
      throw err
    }
    const ok = await bcrypt.compare(currentPassword, user.password_hash)
    if (!ok) {
      const err = new Error('Invalid password')
      err.status = 401
      throw err
    }
    const password_hash = await bcrypt.hash(newPassword, 12)
    await updateUser(user.id, { password_hash })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}

module.exports = { requestReset, resetPassword, updatePassword }
