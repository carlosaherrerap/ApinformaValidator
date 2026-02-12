const Client = require('../models/Client');
const Token = require('../models/Token');
const ResultSend = require('../models/ResultSend');
const { generateToken } = require('../utils/tokenUtils');

/**
 * Registra un nuevo cliente en la base de datos.
 * Corresponde al primer paso del formulario (Datos personales).
 */
const registerClient = async (req, res) => {
    try {
        let {
            tipo_documento,
            documento,
            digito_verificador,
            nombres,
            apellido_paterno,
            apellido_materno
        } = req.body;

        // Limpiar espacios y normalizar
        tipo_documento = String(tipo_documento || '').trim().toUpperCase();
        documento = String(documento || '').trim();
        digito_verificador = String(digito_verificador || '').trim();
        nombres = String(nombres || '').trim();
        apellido_paterno = String(apellido_paterno || '').trim();
        apellido_materno = String(apellido_materno || '').trim();

        // Validaciones del API
        if (!['DNI', 'RUC', 'CDE'].includes(tipo_documento)) {
            return res.status(400).json({ error: 'Tipo de documento inválido (DNI, RUC, CDE)' });
        }

        // Dígito verificador solo números
        if (!/^\d+$/.test(digito_verificador)) {
            return res.status(400).json({ error: 'El dígito verificador debe ser un número, no una letra' });
        }

        // Validar longitudes estrictas ante strings limpios
        if (tipo_documento === 'DNI' && documento.length !== 8) {
            return res.status(400).json({ error: 'DNI debe tener exactamente 8 dígitos' });
        }
        if (tipo_documento === 'RUC' && documento.length !== 11) {
            return res.status(400).json({ error: 'RUC debe tener exactamente 11 dígitos' });
        }
        if (tipo_documento === 'CDE' && documento.length !== 9) {
            return res.status(400).json({ error: 'Carnet de Extranjería debe tener exactamente 9 dígitos' });
        }

        if (!/^\d+$/.test(documento)) {
            return res.status(400).json({ error: 'El documento debe contener solo números' });
        }

        const existingClient = await Client.findOne({ where: { document: documento } });

        if (existingClient) {
            if (existingClient.allow === 1) {
                return res.status(400).json({
                    error: 'Usted ya ha registrado y validado anteriormente!',
                    code: 'ALREADY_VALIDATED'
                });
            }
            return res.status(200).json({
                message: 'Usted ya tiene un registro en proceso. Continuando...',
                data: { id: existingClient.id }
            });
        }

        const client = await Client.create({
            document: documento,
            typeof: tipo_documento,
            digit_very: digito_verificador,
            names: nombres,
            lastname_paternal: apellido_paterno,
            lastname_maternal: apellido_materno,
            allow: 2
        });

        console.log(`[API] Cliente registrado: ${documento} (${tipo_documento})`);

        return res.status(201).json({
            message: 'Cliente registrado correctamente, proceda a validar su número de celular',
            data: { id: client.id }
        });

    } catch (error) {
        console.error('Error en registerClient:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

/**
 * Genera un token, lo guarda y registra el intento de verificación.
 */
const requestToken = async (req, res) => {
    const { id } = req.params;
    let { telefono, operador, via } = req.body;

    try {
        const client = await Client.findByPk(id);
        if (!client) {
            return res.status(404).json({ error: 'Usuario no encontrado al momento de solicitar token' });
        }

        // BLOQUEO SEGURIDAD: Si ya está VALIDADO en auditoría, no permitir más tokens
        const alreadyValidated = await ResultSend.findOne({
            where: { id_client: id, provider_status: 'VALIDADO' }
        });

        if (alreadyValidated || client.allow === 1) {
            return res.status(400).json({
                error: 'Usted ya ha registrado y validado anteriormente!',
                code: 'ALREADY_VALIDATED'
            });
        }

        // Normalización y Validaciones estrictas Paso 2
        telefono = String(telefono || '').trim();
        operador = String(operador || '').trim().toUpperCase();
        via = String(via || '').trim().toUpperCase(); // Normalizar vía a mayúscula

        // Hardening: Solo 9 números exactos, prohibido letras
        if (!/^\d{9}$/.test(telefono)) {
            return res.status(400).json({ error: 'El teléfono debe tener exactamente 9 dígitos numéricos sin letras ni prefijos' });
        }

        if (!['MOVISTAR', 'BITEL', 'CLARO', 'ENTEL'].includes(operador)) {
            return res.status(400).json({ error: 'Operador no válido (MOVISTAR, BITEL, CLARO, ENTEL)' });
        }

        if (via.length !== 1 || !['S', 'W'].includes(via)) {
            return res.status(400).json({ error: 'Vía de envío no válida (solo S o W)' });
        }

        // Lógica de Cooldown Exponencial
        const { Op } = require('sequelize');
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const tokenCount = await Token.count({
            where: {
                id_client: id,
                via: via,
                created_at: { [Op.gte]: yesterday }
            }
        });

        if (tokenCount > 0) {
            const lastToken = await Token.findOne({
                where: { id_client: id, via: via },
                order: [['created_at', 'DESC']]
            });

            const diffMs = Date.now() - new Date(lastToken.createdAt);
            const diffMin = diffMs / (1000 * 60);

            let waitMin = 0;
            switch (tokenCount + 1) {
                case 2: waitMin = 2; break;
                case 3: waitMin = 4; break;
                case 4: waitMin = 30; break;
                case 5: waitMin = 60; break;
                case 6: waitMin = 240; break;
                case 7: waitMin = 300; break;
                case 8: waitMin = 480; break;
                case 9: waitMin = 720; break;
                default: waitMin = 1440;
            }

            if (diffMin < waitMin) {
                const remainingMs = (waitMin * 60 * 1000) - diffMs;
                const remMin = Math.floor(remainingMs / (1000 * 60));
                const remSec = Math.ceil((remainingMs % (1000 * 60)) / 1000);

                const timeText = remMin > 0 ? `${remMin} minuto(s) y ${remSec} segundos` : `${remSec} segundos`;

                console.warn(`[SECURITY] Bloqueo de Cooldown: Cliente ${client.document} intentó pedir token via ${via}. Faltan ${timeText}.`);

                return res.status(429).json({
                    error: 'Tiempo de espera obligatorio',
                    message: `Límite de intentos alcanzado. Debe esperar ${timeText}.`,
                    remaining_seconds: Math.ceil(remainingMs / 1000),
                    code: 'ERR_COOLDOWN_ACTIVE'
                });
            }
        }

        await client.update({ cellphone: telefono, operator: operador });

        const code = generateToken();
        const expiresIn = 2.5 * 60 * 1000;
        const expirationTime = new Date(Date.now() + expiresIn);

        const tokenRecord = await Token.create({
            id_client: client.id,
            request: code,
            via: via,
            expiration_time: expirationTime,
            status: 'P'
        });

        const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || req.ip;
        const cleanIp = clientIp.includes('::ffff:') ? clientIp.split(':').pop() : clientIp;

        await ResultSend.create({
            id_client: client.id,
            id_token: tokenRecord.id,
            ip: cleanIp,
            via: via,
            provider_status: 'PROCESO',
            raw_log: { message: `Simulación de envío vía ${via}` }
        });

        console.log(`[SIMULACIÓN] Token para ${telefono}: ${code} vía ${via} [IP: ${cleanIp}]`);

        return res.status(200).json({
            message: `Token generado y enviado vía ${via}`,
            data: {
                token_id: tokenRecord.id,
                expires_in_seconds: 150
            }
        });

    } catch (error) {
        console.error('Error en requestToken:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

/**
 * Verifica el token ingresado por el usuario.
 */
const verifyToken = async (req, res) => {
    const { id, token } = req.params;

    try {
        const client = await Client.findByPk(id);
        if (!client) {
            return res.status(404).json({ error: 'Usuario no encontrado al momento de validar token' });
        }

        if (client.allow === 1) {
            return res.status(400).json({ error: 'Usted ya ha registrado y validado anteriormente!', code: 'ALREADY_VALIDATED' });
        }

        // Buscar el token más reciente
        let tokenRecord = await Token.findOne({
            where: { id_client: client.id },
            order: [['created_at', 'DESC']]
        });

        if (!tokenRecord || (tokenRecord.status !== 'P' && tokenRecord.status !== 'X')) {
            return res.status(404).json({ error: 'No se encontró un token pendiente. Solicite uno nuevo.', code: 'ERR_NO_PENDING_TOKEN' });
        }

        // VALIDACIÓN DE IP (PINNING)
        const auditLog = await ResultSend.findOne({
            where: { id_token: tokenRecord.id }
        });

        const currentIp = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || req.ip;
        const cleanCurrentIp = currentIp.includes('::ffff:') ? currentIp.split(':').pop() : currentIp;

        if (auditLog && auditLog.ip !== cleanCurrentIp) {
            console.error(`[SECURITY] Alerta de IP: Token solicitado desde ${auditLog.ip}, intento de validación desde ${cleanCurrentIp}`);
            return res.status(403).json({
                error: 'Seguridad de Sesión: La IP de validación no coincide con la solicitud original.',
                code: 'ERR_IP_MISMATCH'
            });
        }

        // Si ya está bloqueado (X), seguimos aumentando el contador si siguen intentando
        if (tokenRecord.status === 'X') {
            const newAttempts = tokenRecord.attempts_failed + 1;
            await tokenRecord.update({ attempts_failed: newAttempts });
            console.warn(`[SECURITY] Re-intento sobre token bloqueado para ${client.document}. Total fallos: ${newAttempts}`);
            return res.status(400).json({
                error: 'Máximo de intentos alcanzado. Este código ha sido invalidado.',
                code: 'ERR_MAX_ATTEMPTS'
            });
        }

        // Verificar si el token coincide
        if (tokenRecord.request !== token) {
            const newAttempts = tokenRecord.attempts_failed + 1;

            if (newAttempts >= 5) {
                await tokenRecord.update({ status: 'X', attempts_failed: newAttempts });
                console.error(`[SECURITY] Máximo de intentos (5) alcanzado para cliente ${client.document}. Token invalidado.`);
                return res.status(400).json({
                    error: 'Máximo de intentos alcanzado. Este código ha sido invalidado.',
                    code: 'ERR_MAX_ATTEMPTS'
                });
            } else {
                await tokenRecord.update({ attempts_failed: newAttempts });
                console.warn(`[SECURITY] Intento fallido ${newAttempts}/5 para cliente ${client.document}`);
                return res.status(400).json({
                    error: `Token incorrecto. Intento ${newAttempts} de 5.`,
                    code: 'ERR_INVALID_TOKEN',
                    remaining_attempts: 5 - newAttempts
                });
            }
        }

        // Verificar expiración
        if (new Date() > new Date(tokenRecord.expiration_time)) {
            await tokenRecord.update({ status: 'E' }); // EXPIRADO
            console.warn(`[SECURITY] Token expirado para cliente ${client.document}`);
            return res.status(400).json({ error: 'El token ha expirado. Solicite uno nuevo.', code: 'ERR_TOKEN_EXPIRED' });
        }

        // Calcular tiempo transcurrido
        const timeLapsed = Math.floor((Date.now() - new Date(tokenRecord.createdAt)) / 1000) || 0;

        // Validar token
        await tokenRecord.update({
            status: 'V',
            time_lapsed: timeLapsed
        });

        // Validar cliente
        await client.update({ allow: 1 });

        // Actualizar auditoría
        await ResultSend.update(
            {
                provider_status: 'VALIDADO',
                attempts_correct: 1,
                attempts_failed: tokenRecord.attempts_failed
            },
            { where: { id_token: tokenRecord.id } }
        );

        console.log(`[API] Token verificado con éxito para ${client.document}`);

        return res.status(200).json({
            message: 'Token verificado exitosamente. Registro completado.',
            data: { status: 'VALIDADO' }
        });

    } catch (error) {
        console.error(`[ERROR API] verifyToken (${id}):`, error);
        return res.status(500).json({ error: 'Error interno al verificar token' });
    }
};

/**
 * Finaliza el registro del cliente (Paso 4).
 * Actualiza correo, ubicación y acepta términos.
 */
const finalizeRegistration = async (req, res) => {
    const { id } = req.params;
    const { correo, departamento, provincia, distrito, accept } = req.body;

    try {
        const client = await Client.findByPk(id);
        if (!client) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        if (client.allow !== 1) {
            return res.status(400).json({ error: 'Debe validar su celular primero' });
        }

        if (!accept) {
            return res.status(400).json({ error: 'Debe aceptar los términos y condiciones' });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
            return res.status(400).json({ error: 'Correo electrónico inválido' });
        }

        await client.update({
            email: correo,
            dept: departamento,
            prov: provincia,
            distr: distrito,
            accept: true
        });

        console.log(`[API] Registro finalizado para cliente ${id}`);

        return res.status(200).json({
            message: 'Registro completado exitosamente',
            data: { status: 'COMPLETADO' }
        });

    } catch (error) {
        console.error('Error en finalizeRegistration:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

/**
 * Cancela el token actual por voluntad del usuario.
 * Cuenta como un intento fallido para el cooldown de 24h.
 */
const cancelToken = async (req, res) => {
    const { id } = req.params;
    try {
        const client = await Client.findByPk(id);
        if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });

        const tokenRecord = await Token.findOne({
            where: { id_client: id, status: 'P' },
            order: [['created_at', 'DESC']]
        });

        if (tokenRecord) {
            const newAttempts = (tokenRecord.attempts_failed || 0) + 1;
            await tokenRecord.update({ status: 'X', attempts_failed: newAttempts }); // CANCELADO

            await ResultSend.update(
                { provider_status: 'CANCELADO_USUARIO', attempts_failed: newAttempts },
                { where: { id_token: tokenRecord.id } }
            );

            console.log(`[API] Token cancelado manualmente por ${client.document}. Intento ${newAttempts} registrado.`);
            return res.status(200).json({ message: 'Token cancelado correctamente (intento fallido contado)' });
        }

        return res.status(404).json({ error: 'No hay token pendiente para cancelar' });
    } catch (error) {
        console.error(`[ERROR API] cancelToken (${id}):`, error);
        return res.status(500).json({ error: 'Error interno al cancelar token' });
    }
};

/**
 * Registra que un token expiró sin respuesta del usuario.
 */
const expireToken = async (req, res) => {
    const { id } = req.params;
    try {
        const tokenRecord = await Token.findOne({
            where: { id_client: id, status: 'P' },
            order: [['created_at', 'DESC']]
        });

        if (tokenRecord) {
            await tokenRecord.update({ status: 'E' }); // EXPIRADO
            await ResultSend.update(
                { provider_status: 'SIN_RESPUESTA', attempts_no_response: 1 },
                { where: { id_token: tokenRecord.id } }
            );
            console.log(`[API] Token expirado por sistema (sin respuesta)`);
        }

        return res.status(200).json({ message: 'Token marcado como sin respuesta' });
    } catch (error) {
        console.error('Error en expireToken:', error);
        return res.status(500).json({ error: 'Error interno' });
    }
};

/**
 * Consulta el estado de cooldown de un cliente para un medio específico.
 */
const getCooldownStatus = async (req, res) => {
    const { id, via } = req.params;
    try {
        const { Op } = require('sequelize');
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const tokenCount = await Token.count({
            where: {
                id_client: id,
                via: via,
                created_at: { [Op.gte]: yesterday }
            }
        });

        let waitMin = 0;
        let lastTokenCreatedAt = null;
        let diffMs = 0;

        if (tokenCount > 0) {
            const lastToken = await Token.findOne({
                where: { id_client: id, via: via },
                order: [['created_at', 'DESC']]
            });
            lastTokenCreatedAt = lastToken.createdAt;
            diffMs = Date.now() - new Date(lastTokenCreatedAt);

            switch (tokenCount + 1) {
                case 2: waitMin = 2; break;
                case 3: waitMin = 4; break;
                case 4: waitMin = 30; break;
                case 5: waitMin = 60; break;
                case 6: waitMin = 240; break;
                case 7: waitMin = 300; break;
                case 8: waitMin = 480; break;
                case 9: waitMin = 720; break;
                default: waitMin = 1440;
            }
        }

        const waitMs = waitMin * 60 * 1000;
        const remainingMs = Math.max(0, waitMs - diffMs);
        const remainingSec = Math.ceil(remainingMs / 1000);

        return res.status(200).json({
            data: {
                via,
                intentos_realizados_24h: tokenCount,
                siguiente_intento_numero: tokenCount + 1,
                tiempo_espera_total_min: waitMin,
                segundos_restantes: remainingSec,
                puede_solicitar: remainingSec === 0
            }
        });
    } catch (error) {
        console.error('Error en getCooldownStatus:', error);
        return res.status(500).json({ error: 'Error al consultar estado de cooldown' });
    }
};

module.exports = {
    registerClient,
    requestToken,
    verifyToken,
    finalizeRegistration,
    cancelToken,
    expireToken,
    getCooldownStatus
};
