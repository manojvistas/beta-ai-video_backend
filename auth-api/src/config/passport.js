const GoogleStrategy = require('passport-google-oauth20').Strategy
const { env } = require('./env')
const { findOrCreateGoogleUser } = require('../services/userService')

function registerPassport(passport) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: env.GOOGLE_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const user = await findOrCreateGoogleUser(profile)
          done(null, user)
        } catch (err) {
          done(err)
        }
      }
    )
  )
}

module.exports = { registerPassport }
