const express = require('express');
const router = express.Router();
const c = require('../controllers/clientController');
const { verifyToken, isAdmin } = require('../middleware/auth');

router.post('/', c.registerClient);                    // Paso 1: Registro
router.post('/:id/token', c.requestToken);             // Paso 2: Solicitar token
router.get('/:id/verify/:token', c.verifyToken);       // Paso 3: Verificar token
router.post('/:id/finalize', c.finalizeRegistration);  // Paso 4: Finalizar
router.post('/:id/cancel', c.cancelToken);             // Cancelar token
router.post('/:id/expire', c.expireToken);             // Token expirado
router.get('/:id/cooldown', c.getCooldownStatus);      // Estado cooldown
router.get('/:type/:value', verifyToken, isAdmin, c.searchClient); // Búsqueda (SÓLO ADMIN)

module.exports = router;
