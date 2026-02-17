const express = require('express');
const router = express.Router();
const stats = require('../controllers/statsController');
const { verifyToken, canViewStats, canViewTokens } = require('../middleware/auth');

router.get('/dashboard', verifyToken, canViewStats, stats.getDashboardStats);
router.get('/clients', verifyToken, canViewStats, stats.getClients);
router.get('/clients/:id', verifyToken, canViewStats, stats.getClientDetail);
router.get('/tokens/:tokenId', verifyToken, canViewTokens, stats.getTokenPlaintext);

module.exports = router;
