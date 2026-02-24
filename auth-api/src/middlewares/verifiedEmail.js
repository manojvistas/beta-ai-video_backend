function verifiedEmail(req, res, next) {
  if (!req.user?.email_verified) {
    return res.status(403).json({ error: 'Email not verified' })
  }
  next()
}

module.exports = { verifiedEmail }
