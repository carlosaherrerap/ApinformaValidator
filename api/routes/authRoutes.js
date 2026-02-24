const express = require('express');
const router = express.Router();
const auth = require('../controllers/authController');
const { verifyToken, isAdmin } = require('../middleware/auth');
const { clientAuth } = require('../middleware/clientAuth');

// Público (Protegido por Client Credentials)
router.post('/login/auth', clientAuth, auth.login);
router.post('/login/mfa', clientAuth, auth.verifyMFA);

// Gestión de usuarios
router.get('/users', auth.listUsers);
router.post('/user', auth.createUser);
router.put('/user/:id', auth.updateUser);
router.delete('/user/:id', auth.deleteUser);

// WhatsApp QR
router.post('/qr/generate', auth.login);   // Placeholder para simplificar según spec
router.post('/qr/invalidate', auth.login); // Placeholder para simplificar según spec

// Sesión
router.post('/logout/auth', auth.logout);

module.exports = router;
