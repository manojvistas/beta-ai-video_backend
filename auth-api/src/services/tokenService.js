const { randomToken, hashToken } = require('../utils/crypto')

function generateTokenPair() {
  const raw = randomToken()
  const hashed = hashToken(raw)
  return { raw, hashed }
}

module.exports = { generateTokenPair }
