const dotenv = require('dotenv')

dotenv.config()

const env = {
  PORT: process.env.PORT || 4000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
  APP_URL: process.env.APP_URL || 'http://localhost:3000',
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_ACCESS_TTL: process.env.JWT_ACCESS_TTL || '15m',
  JWT_REFRESH_TTL: process.env.JWT_REFRESH_TTL || '30d',
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: Number(process.env.SMTP_PORT || 587),
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM: process.env.SMTP_FROM,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL,
  SURREAL_URL: process.env.SURREAL_URL,
  SURREAL_USER: process.env.SURREAL_USER,
  SURREAL_PASS: process.env.SURREAL_PASS,
  SURREAL_NAMESPACE: process.env.SURREAL_NAMESPACE,
  SURREAL_DATABASE: process.env.SURREAL_DATABASE,
}

module.exports = { env }
