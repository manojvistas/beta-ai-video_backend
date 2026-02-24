const passport = require('passport')
const { signAccessToken, signRefreshToken } = require('../utils/jwt')
const { createSession } = require('../models/sessionModel')
const { hashToken } = require('../utils/crypto')
const { createCookieOptions } = require('../services/authService')
const { env } = require('../config/env')

function google(req, res, next) {
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next)
}

function googleCallback(req, res, next) {
  passport.authenticate('google', { session: false }, async (err, user) => {
    if (err) {
      console.error('[Auth] Google OAuth error:', err?.code || err?.message || err)
      // invalid_grant means the code was already used or expired — redirect to retry
      if (err.code === 'invalid_grant') {
        return res.redirect(`${env.APP_URL}/login?error=expired`)
      }
      return next(err)
    }
    if (!user) {
      console.warn('[Auth] Google OAuth: no user returned')
      return res.redirect(`${env.APP_URL}/login?error=auth_failed`)
    }
    try {
      const jwt_id = require('crypto').randomBytes(16).toString('hex')
      const access = signAccessToken({ sub: user.id, email: user.email })
      const refresh = signRefreshToken({ sub: user.id, jti: jwt_id })

      await createSession({
        user_id: user.id,
        jwt_id,
        ip: req.ip,
        user_agent: req.get('user-agent') || 'unknown',
        refresh_hash: hashToken(refresh),
      })

      res.cookie('access_token', access, createCookieOptions(false))
      res.cookie('refresh_token', refresh, createCookieOptions(true))
      console.info('[Auth] Set auth cookies (google)', { userId: user.id, email: user.email })
      res.redirect(`${env.APP_URL}/notebooks`)
    } catch (sessionErr) {
      console.error('[Auth] Session creation failed:', sessionErr?.message || sessionErr)
      return res.redirect(`${env.APP_URL}/login?error=session_failed`)
    }
  })(req, res, next)
}

module.exports = { google, googleCallback }
