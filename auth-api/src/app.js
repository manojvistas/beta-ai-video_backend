const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const passport = require('passport')
const { env } = require('./config/env')
const { initSurreal, ensureConnection } = require('./db/surreal')
const { registerPassport } = require('./config/passport')
const routes = require('./routes')

const app = express()

app.use(helmet())
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }))
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())

// Ensure SurrealDB connection is alive before each request
app.use(async (req, res, next) => {
  try {
    await ensureConnection()
    next()
  } catch (err) {
    console.error('SurrealDB not available:', err?.message || err)
    res.status(503).json({ error: 'Database temporarily unavailable' })
  }
})

registerPassport(passport)
app.use(passport.initialize())

app.get('/health', async (req, res) => {
  res.json({ ok: true })
})

app.use('/api', routes)

app.use((err, req, res, next) => {
  console.error('Auth API error:', err)
  const status = err.status || 500
  res.status(status).json({ error: err.message || 'Server error' })
})

initSurreal()

module.exports = { app }
