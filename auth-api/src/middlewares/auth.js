const { verifyAccessToken } = require('../utils/jwt')
const { findUserById } = require('../models/userModel')

async function auth(req, res, next) {
  try {
    const token = req.cookies.access_token || ''
    if (!token) {
      console.warn('[Auth] Missing access token', { path: req.originalUrl })
      return res.status(401).json({ error: 'Unauthorized' })
    }
    const payload = verifyAccessToken(token)
    const user = await findUserById(payload.sub)
    if (!user) {
      console.warn('[Auth] User not found for access token', { path: req.originalUrl })
      return res.status(401).json({ error: 'Unauthorized' })
    }
    req.user = user
    next()
  } catch (err) {
    console.warn('[Auth] Invalid access token', { path: req.originalUrl, message: err?.message })
    res.status(401).json({ error: 'Unauthorized' })
  }
}

module.exports = { auth }
