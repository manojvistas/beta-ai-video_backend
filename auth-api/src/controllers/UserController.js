const { findUserById, updateUser } = require('../models/userModel')

async function getUser(req, res, next) {
  try {
    const user = await findUserById(req.params.id)
    if (!user) {
      const err = new Error('User not found')
      err.status = 404
      throw err
    }
    res.json(user)
  } catch (err) {
    next(err)
  }
}

async function updateUserProfile(req, res, next) {
  try {
    const updates = { profile: req.body.profile }
    const user = await updateUser(req.params.id, updates)
    res.json(user)
  } catch (err) {
    next(err)
  }
}

async function deleteUser(req, res, next) {
  try {
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

module.exports = { getUser, updateUserProfile, deleteUser }
