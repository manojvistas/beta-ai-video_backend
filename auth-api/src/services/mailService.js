const nodemailer = require('nodemailer')
const { env } = require('../config/env')

const placeholderValues = new Set(['smtp.example.com', 'your_user', 'your_pass'])
const hasSmtpConfig =
  Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) &&
  !placeholderValues.has(env.SMTP_HOST) &&
  !placeholderValues.has(env.SMTP_USER) &&
  !placeholderValues.has(env.SMTP_PASS)
const transporter = hasSmtpConfig
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    })
  : null

async function verifyTransporter() {
  if (!hasSmtpConfig || !transporter) {
    console.warn('SMTP not configured. Skipping transporter verification.')
    return false
  }
  try {
    await transporter.verify()
    console.log('SMTP connection verified.')
    return true
  } catch (error) {
    console.warn('SMTP failed:', error?.message || error)
    return false
  }
}

async function sendVerificationEmail(email, token) {
  if (!hasSmtpConfig) {
    console.warn('SMTP not configured. Skipping verification email.')
    return
  }
  const url = `${env.APP_URL}/verify-email?token=${token}`
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; background: #f9fafb; padding: 24px;">
      <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 24px; border: 1px solid #e5e7eb;">
        <div style="font-size: 20px; font-weight: 700; margin-bottom: 8px;">Welcome to Open Notebook!</div>
        <div style="font-size: 14px; color: #6b7280; margin-bottom: 16px;">We're excited to have you on board. To ensure the security of your account and get you started, we just need to verify your email address.</div>
        <a href="${url}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 8px; font-weight: 600; margin-bottom: 24px;">Verify Email Address</a>
        <div style="font-size: 12px; color: #6b7280; margin-top: 16px;">Link not working? Paste this URL into your browser:</div>
        <div style="font-size: 12px; color: #2563eb; word-break: break-all; margin-top: 4px;">${url}</div>
        <div style="margin-top: 24px; font-size: 12px; color: #9ca3af;">This link will expire in 24 hours for your security.</div>
      </div>
    </div>
  `.trim()
  try {
    await transporter.sendMail({
      from: env.SMTP_FROM,
      to: email,
      subject: 'Welcome to Open Notebook! Please Verify Your Email',
      text: `Welcome to Open Notebook! To ensure the security of your account, please verify your email address: ${url}`,
      html,
    })
    console.log('Verification email sent:', email)
  } catch (error) {
    console.warn('SMTP failed:', error?.message || error)
  }
}

async function sendResetEmail(email, token) {
  if (!hasSmtpConfig) {
    console.warn('SMTP not configured. Skipping reset email.')
    return
  }
  const url = `${env.APP_URL}/reset-password?token=${token}`
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; background: #f9fafb; padding: 24px;">
      <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 24px; border: 1px solid #e5e7eb;">
        <div style="font-size: 20px; font-weight: 700; margin-bottom: 8px;">Reset Your Password</div>
        <div style="font-size: 14px; color: #6b7280; margin-bottom: 16px;">We received a request to reset the password for your Open Notebook account. If you made this request, please click the button below to choose a new password.</div>
        <a href="${url}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 8px; font-weight: 600; margin-bottom: 24px;">Reset Password</a>
        <div style="font-size: 12px; color: #6b7280; margin-top: 16px;">Link not working? Paste this URL into your browser:</div>
        <div style="font-size: 12px; color: #2563eb; word-break: break-all; margin-top: 4px;">${url}</div>
        <div style="margin-top: 24px; font-size: 12px; color: #9ca3af;">If you didn't ask to reset your password, you can safely ignore this email. Your account remains secure.<br>This link is valid for 1 hour.</div>
      </div>
    </div>
  `.trim()
  try {
    await transporter.sendMail({
      from: env.SMTP_FROM,
      to: email,
      subject: 'Reset Your Open Notebook Password',
      text: `We received a request to reset the password for your Open Notebook account. If you made this request, please choose a new password here: ${url}`,
      html,
    })
    console.log('Reset email sent:', email)
  } catch (error) {
    console.warn('SMTP failed:', error?.message || error)
  }
}

module.exports = { sendVerificationEmail, sendResetEmail, verifyTransporter }
