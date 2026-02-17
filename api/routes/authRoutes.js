const express = require('express');
const router = express.Router();
const auth = require('../controllers/authController');
const { verifyToken, isAdmin } = require('../middleware/auth');

// Público
router.post('/login', auth.login);

// Perfil propio (cualquier usuario autenticado)
router.get('/profile', verifyToken, auth.getProfile);
router.put('/profile', verifyToken, auth.updateProfile);

// Gestión de usuarios (Solo Admin)
router.post('/users', verifyToken, isAdmin, auth.createUser);
router.put('/users/:userId/permissions', verifyToken, isAdmin, auth.updateUserPermissions);
router.get('/users', verifyToken, isAdmin, auth.getUsers);

// WhatsApp (Solo Admin)
router.post('/whatsapp/start', verifyToken, isAdmin, auth.startWhatsApp);
router.get('/whatsapp/status', verifyToken, isAdmin, auth.getWhatsAppStatus);
router.post('/whatsapp/logout', verifyToken, isAdmin, auth.whatsAppLogout);

module.exports = router;
