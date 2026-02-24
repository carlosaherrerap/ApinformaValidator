const express = require('express');
const router = express.Router();
const auth = require('../controllers/authController');
const { verifyToken, isAdmin, isMainAdmin } = require('../middleware/auth');
const { clientAuth } = require('../middleware/clientAuth');

// Público (Protegido por Client Credentials)
router.post('/login/auth', clientAuth, auth.login);
router.post('/login/mfa', clientAuth, auth.verifyMFA);

// Gestión de usuarios (Solo ADMIN)
router.get('/users', verifyToken, isAdmin, auth.listUsers);
router.post('/user', verifyToken, isAdmin, auth.createUser);
router.put('/user/:id', verifyToken, isAdmin, auth.updateUser);
router.delete('/user/:id', verifyToken, isAdmin, auth.deleteUser);

// WhatsApp QR (Solo username 'admin')
router.post('/qr/generate', verifyToken, isMainAdmin, auth.login);   // Placeholder
router.post('/qr/invalidate', verifyToken, isMainAdmin, auth.login); // Placeholder

// Perfil y Sesión
router.get('/profile', verifyToken, auth.getProfile);
router.put('/profile', verifyToken, auth.updateProfile);
router.post('/logout/auth', verifyToken, auth.logout);

module.exports = router;
