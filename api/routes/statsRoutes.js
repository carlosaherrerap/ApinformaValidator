const express = require('express');
const router = express.Router();
const stats = require('../controllers/statsController');
const { verifyToken, canViewStats, canViewData, canViewTokens } = require('../middleware/auth');

// Dashboard (solo números) - Rol 1 y Rol 2
router.get('/dashboard', verifyToken, canViewStats, stats.getDashboardStats);

// Datos de clientes (datos personales + paginación) - Solo Rol 1
router.get('/clients', verifyToken, canViewData, stats.getClients);
router.get('/clients/:id', verifyToken, canViewData, stats.getClientDetail);

// Tokens planos - Solo Rol 1
router.get('/tokens/:tokenId', verifyToken, canViewTokens, stats.getTokenPlaintext);

module.exports = router;
