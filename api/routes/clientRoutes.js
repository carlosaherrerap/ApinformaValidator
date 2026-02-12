const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');

// POST /v1/api/client - Registro inicial de datos personales
router.post('/', clientController.registerClient);

// POST /v1/api/client/:id/token - Solicitud de token (Paso 2)
router.post('/:id/token', clientController.requestToken);

// GET /v1/api/client/:id/verify/:token - Verificación de token (Paso 3)
router.get('/:id/verify/:token', clientController.verifyToken);

// POST /v1/api/client/:id/finalize - Finalización del registro (Paso 4)
router.post('/:id/finalize', clientController.finalizeRegistration);

// POST /v1/api/client/:id/cancel - Cancelar token actual
router.post('/:id/cancel', clientController.cancelToken);

// POST /v1/api/client/:id/expire - Registrar expiración sin respuesta
router.post('/:id/expire', clientController.expireToken);

// GET /v1/api/client/:id/cooldown/:via - Consultar estado de cooldown
router.get('/:id/cooldown/:via', clientController.getCooldownStatus);

module.exports = router;
