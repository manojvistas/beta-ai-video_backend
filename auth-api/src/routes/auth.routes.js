const express = require('express')
const AuthController = require('../controllers/AuthController')
const OAuthController = require('../controllers/OAuthController')
const PasswordController = require('../controllers/PasswordController')
const { auth } = require('../middlewares/auth')
const { verifiedEmail } = require('../middlewares/verifiedEmail')
const { rateLimit } = require('../middlewares/rateLimit')

const router = express.Router()

router.get('/health', (req, res) => res.json({ status: 'healthy' }))

router.post('/register', rateLimit('register', 5, 60000), AuthController.register)
router.post('/login', rateLimit('login', 10, 60000), AuthController.login)
router.post('/logout', auth, AuthController.logout)
router.post('/refresh', AuthController.refreshToken)
router.get('/me', auth, AuthController.getProfile)

router.get('/google', OAuthController.google)
router.get('/google/callback', OAuthController.googleCallback)

router.post('/verify-email', AuthController.verifyEmail)
router.post('/resend-verification', AuthController.resendVerification)

router.post('/forgot-password', rateLimit('forgot', 5, 60000), AuthController.forgotPassword)
router.post('/reset-password', AuthController.resetPassword)
router.patch('/password', auth, verifiedEmail, PasswordController.updatePassword)

module.exports = router
