const { Surreal } = require('surrealdb')
const WebSocket = require('ws')
const { env } = require('../config/env')

if (!global.WebSocket) {
  global.WebSocket = WebSocket
}

// Single instance — models destructure this at import time,
// so we must NEVER replace it, only reconnect on it.
const surreal = new Surreal()
let connected = false
let connecting = false

async function connectAndSignin() {
  try { await surreal.close() } catch {}
  await surreal.connect(env.SURREAL_URL)
  await surreal.signin({ username: env.SURREAL_USER, password: env.SURREAL_PASS })
  await surreal.use({ namespace: env.SURREAL_NAMESPACE, database: env.SURREAL_DATABASE })
  connected = true
}

async function initSurreal() {
  if (connecting) return
  connecting = true
  try {
    await connectAndSignin()
    console.log('SurrealDB connected successfully')
  } catch (error) {
    connected = false
    console.error('SurrealDB connection failed, retrying in 5s:', error?.message || error)
    setTimeout(initSurreal, 5000)
  } finally {
    connecting = false
  }
}

async function ensureConnection() {
  if (connected) {
    try {
      await surreal.query('SELECT 1')
      return
    } catch {
      console.warn('SurrealDB connection lost, reconnecting...')
      connected = false
    }
  }
  // Reconnect on the same instance
  try {
    await connectAndSignin()
    console.log('SurrealDB reconnected successfully')
  } catch (err) {
    throw new Error('SurrealDB is not connected: ' + (err?.message || err))
  }
}

module.exports = { surreal, initSurreal, ensureConnection }
