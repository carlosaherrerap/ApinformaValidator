const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// POST /v1/api/auth/login
router.post('/login', authController.login);

// POST /v1/api/auth/users (Solo accesible por admins - falta añadir middleware de protección)
router.post('/users', authController.createUser);

module.exports = router;
