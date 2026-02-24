const buckets = new Map()

function rateLimit(keyPrefix, limit, windowMs) {
  return (req, res, next) => {
    const key = `${keyPrefix}:${req.ip}`
    const now = Date.now()
    const bucket = buckets.get(key) || { count: 0, resetAt: now + windowMs }

    if (now > bucket.resetAt) {
      bucket.count = 0
      bucket.resetAt = now + windowMs
    }

    bucket.count += 1
    buckets.set(key, bucket)

    if (bucket.count > limit) {
      return res.status(429).json({ error: 'Too many requests' })
    }

    next()
  }
}

module.exports = { rateLimit }
