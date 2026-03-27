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
const DB_OP_TIMEOUT_MS = Number(process.env.SURREAL_OP_TIMEOUT_MS || 4000)

function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
    }),
  ])
}

async function connectAndSignin() {
  try { await surreal.close() } catch {}
  await withTimeout(surreal.connect(env.SURREAL_URL), DB_OP_TIMEOUT_MS, 'Surreal connect')
  await withTimeout(
    surreal.signin({ username: env.SURREAL_USER, password: env.SURREAL_PASS }),
    DB_OP_TIMEOUT_MS,
    'Surreal signin'
  )
  await withTimeout(
    surreal.use({ namespace: env.SURREAL_NAMESPACE, database: env.SURREAL_DATABASE }),
    DB_OP_TIMEOUT_MS,
    'Surreal use namespace/database'
  )
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
      await withTimeout(surreal.query('SELECT 1'), DB_OP_TIMEOUT_MS, 'Surreal health query')
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
