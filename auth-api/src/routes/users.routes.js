const express = require('express')
const UserController = require('../controllers/UserController')
const { auth } = require('../middlewares/auth')
const { verifiedEmail } = require('../middlewares/verifiedEmail')

const router = express.Router()

router.get('/:id', auth, verifiedEmail, UserController.getUser)
router.patch('/:id', auth, verifiedEmail, UserController.updateUserProfile)
router.delete('/:id', auth, verifiedEmail, UserController.deleteUser)

module.exports = router
