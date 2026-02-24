const Client = require('../models/Client');
const Token = require('../models/Token');
const ResultSend = require('../models/ResultSend');
const { generateToken, hashToken } = require('../utils/tokenUtils');
const { sendSMS } = require('../services/smsService');
const { sendWhatsApp, getStatus: getWAStatus } = require('../services/whatsappService');
const { sendWebhook } = require('../services/webhookService');

// ──── HELPERS ────
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getCleanIp(req) {
    const raw = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || req.ip;
    return raw.includes('::ffff:') ? raw.split(':').pop() : raw;
}

function getCooldownSeconds(intentos) {
    if (intentos === 3) return 90;     // 1.5 min
    if (intentos === 4) return 180;    // 3 min
    if (intentos === 5) return 300;    // 5 min
    if (intentos === 6) return 600;    // 10 min
    if (intentos === 7) return 1800;   // 30 min
    return 3600;                       // 1 hora
}

async function findOrCreateResult(clienteId, via) {
    let record = await ResultSend.findOne({
        where: { id_cliente: clienteId, via }
    });
    if (!record) {
        record = await ResultSend.create({
            id_cliente: clienteId,
            via,
            intentos: 0,
            bloqueado: false
        });
    }
    return record;
}

//REGISTRO DEL CLIENTE, SUS DATOS PERSONALES
const registerClient = async (req, res) => {
    try {
        let { tipo_documento, documento, dv, nombres, ap_paterno, ap_materno } = req.body;

        // Normalización
        tipo_documento = String(tipo_documento || '').trim().toUpperCase();
        documento = String(documento || '').trim();
        dv = String(dv || '').trim();
        nombres = String(nombres || '').trim();
        ap_paterno = String(ap_paterno || '').trim();
        ap_materno = String(ap_materno || '').trim();

        // ── Validaciones Backend ──
        if (!['DNI', 'RUC', 'CDE'].includes(tipo_documento)) {
            return res.status(400).json({ error: 'Tipo de documento inválido (DNI, RUC, CDE)' });
        }
        if (!/^\d+$/.test(documento)) {
            return res.status(400).json({ error: 'El documento debe contener solo números' });
        }
        if (tipo_documento === 'DNI' && documento.length !== 8) {
            return res.status(400).json({ error: 'DNI debe tener exactamente 8 dígitos' });
        }
        if (tipo_documento === 'RUC' && documento.length !== 11) {
            return res.status(400).json({ error: 'RUC debe tener exactamente 11 dígitos' });
        }
        if (tipo_documento === 'CDE' && documento.length !== 9) {
            return res.status(400).json({ error: 'CDE debe tener exactamente 9 dígitos' });
        }
        if (!/^\d$/.test(dv)) {
            return res.status(400).json({ error: 'Dígito verificador debe ser un solo dígito numérico' });
        }
        if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(nombres) || nombres.length < 2) {
            return res.status(400).json({ error: 'Nombres inválidos (solo letras, mínimo 2 caracteres)' });
        }
        if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(ap_paterno) || ap_paterno.length < 2) {
            return res.status(400).json({ error: 'Apellido paterno inválido' });
        }
        if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(ap_materno) || ap_materno.length < 2) {
            return res.status(400).json({ error: 'Apellido materno inválido' });
        }

        // ── Verificar existencia de docuemnto ──
        const existing = await Client.findOne({ where: { documento } });

        if (existing) {
            if (existing.estado === true) {
                return res.status(400).json({
                    error: 'Usted ya se ha registrado y validado anteriormente.',
                    code: 'ALREADY_REGISTERED'
                });
            }
            // Estado FALSE --→ registro en proceso, permitir continuar
            return res.status(200).json({
                message: 'Registro en proceso. Continuando...',
                data: { id: existing.id }
            });
        }

        //  Crear cliente 
        const client = await Client.create({
            tipo_doc: tipo_documento,
            documento,
            dv,
            nombres,
            ap_paterno,
            ap_materno
        });

        console.log(`[API] Cliente registrado: ${documento} (${tipo_documento})`);

        // Webhook: Registro Inicial <---aun pendiente
        sendWebhook('client.registered', {
            id: client.id,
            documento: client.documento,
            nombres: client.nombres,
            fecha: client.created_at
        });

        return res.status(201).json({
            message: 'Cliente registrado correctamente',
            data: { id: client.id }
        });

    } catch (error) {
        console.error('[ERROR] registerClient:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

//SOLICITAR EL TOKEN
const requestToken = async (req, res) => {
    const { id } = req.params;
    let { celular, operador, via } = req.body;

    if (!UUID_REGEX.test(id)) {
        return res.status(400).json({ error: 'ID de cliente inválido' });
    }

    try {
        const client = await Client.findByPk(id);
        if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });

        if (client.estado === true) {
            return res.status(400).json({ error: 'Ya se registró anteriormente.', code: 'ALREADY_REGISTERED' });
        }

        // LIMOPIANDO EL TELEFONO
        celular = String(celular || '').trim();
        operador = String(operador || '').trim().toUpperCase();
        via = String(via || '').trim().toUpperCase();

        if (!/^\d{9}$/.test(celular)) {
            return res.status(400).json({ error: 'Celular debe tener exactamente 9 dígitos numéricos' });
        }
        if (!['MOVISTAR', 'BITEL', 'CLARO', 'ENTEL'].includes(operador)) {
            return res.status(400).json({ error: 'Operador no válido' });
        }
        if (!['S', 'W'].includes(via)) {
            return res.status(400).json({ error: 'Medio no válido (S=SMS, W=WhatsApp)' });
        }

        //  CANTIDAD DE INTENTOS DE POR MEDIO
        const resultado = await findOrCreateResult(id, via);

        if (resultado.intentos >= 3 && resultado.ultimo_intento) {
            const waitSecs = getCooldownSeconds(resultado.intentos);
            const deadline = new Date(new Date(resultado.ultimo_intento).getTime() + waitSecs * 1000);
            const now = new Date();

            if (now < deadline) {
                const remaining = Math.ceil((deadline - now) / 1000);
                return res.status(429).json({
                    error: 'Debe esperar antes de solicitar un nuevo token por este medio.',
                    remaining_seconds: remaining,
                    intentos: resultado.intentos,
                    via_bloqueada: via,
                    code: 'ERR_COOLDOWN'
                });
            }
        }

        // INSERTANDO FASE 2 DE TELEFONO TOKEN Y VERIFICACION, MEDIO
        await client.update({ celular, operador });

        // Generar token
        const codigo = generateToken();
        const codigoHash = await hashToken(codigo);
        const ip = getCleanIp(req);

        const tokenRecord = await Token.create({
            id_cliente: id,
            codigo,
            codigo_hash: codigoHash,
            via,
            status: 'P',
            ip_solicitante: ip
        });

        // ENVIAR TOKEN AL CLIENTE (Omitir si es simulación o está deshabilitado globalmente)
        const simHeader = req.get('x-simulator') || req.headers['x-simulator'];
        const isSimulator = String(simHeader) === 'true';
        const isMessagingEnabled = process.env.ENABLE_MESSAGING !== 'false'; // true por defecto

        let envioResult = { success: false };
        const mensaje = `Estimado ${client.nombres} su token es ${codigo}`;

        if (isSimulator || !isMessagingEnabled) {
            console.log(`[SIMULADOR] ON (Simulator: ${isSimulator}, GlobalEnabled: ${isMessagingEnabled}): Omitiendo envío real.`);
            envioResult = { success: true };
        } else {
            console.log(`[TOKEN] ${via === 'S' ? 'SMS' : 'WhatsApp'} → ${celular}: ${mensaje} [IP: ${ip}]`);
            if (via === 'S') {
                envioResult = await sendSMS(celular, mensaje);
                if (!envioResult.success) {
                    console.warn(`[SMS] Fallo envío a ${celular}:`, envioResult.error);
                }
            } else {
                const waStatus = getWAStatus();
                if (waStatus.status !== 'connected') {
                    // Marcamos como fallido por desconexión
                    await tokenRecord.update({ status: 'N' });
                    return res.status(503).json({
                        error: 'WhatsApp no está conectado. El administrador debe escanear el QR primero.',
                        code: 'ERR_WA_DISCONNECTED'
                    });
                }
                envioResult = await sendWhatsApp(celular, mensaje);
                if (!envioResult.success) {
                    console.warn(`[WA] Fallo envío a ${celular}:`, envioResult.error);
                }
            }
        }

        // Si el envío falló (y no es simulación), marcar token como 'N' (No enviado)
        if (!envioResult.success && !isSimulator) {
            await tokenRecord.update({ status: 'N' });
            return res.status(500).json({
                error: 'No se pudo enviar el token. Intente más tarde.',
                code: 'ERR_SEND_FAILED'
            });
        }

        return res.status(200).json({
            message: `Token enviado vía ${via === 'S' ? 'SMS' : 'WhatsApp'}`,
            data: {
                token_id: tokenRecord.id,
                expires_in_seconds: 150,
                via,
                intentos: resultado.intentos,
                token_length: parseInt(process.env.TOKEN_LENGTH) || 4
            }
        });

    } catch (error) {
        console.error('[ERROR] requestToken:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

//VERIFICAR EL TOKEN
const verifyToken = async (req, res) => {
    const { id, token } = req.params;

    if (!UUID_REGEX.test(id)) {
        return res.status(400).json({ error: 'ID de cliente inválido' });
    }

    try {
        const client = await Client.findByPk(id);
        if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });

        if (client.estado === true) {
            return res.status(400).json({ error: 'Ya validado anteriormente.', code: 'ALREADY_REGISTERED' });
        }

        // TOKEN PENDIENTE MAS RECIENTE
        const tokenRecord = await Token.findOne({
            where: { id_cliente: id, status: 'P' },
            order: [['created_at', 'DESC']]
        });

        if (!tokenRecord) {
            return res.status(404).json({ error: 'No hay token pendiente. Solicite uno nuevo.', code: 'ERR_NO_TOKEN' });
        }

        // Obtener resultado por medio
        const resultado = await findOrCreateResult(id, tokenRecord.via);

        // COOLDOWN CHECK
        if (resultado.intentos >= 3 && resultado.ultimo_intento) {
            const waitSecs = getCooldownSeconds(resultado.intentos);
            const deadline = new Date(new Date(resultado.ultimo_intento).getTime() + waitSecs * 1000);
            if (new Date() < deadline) {
                const remaining = Math.ceil((deadline - new Date()) / 1000);
                return res.status(429).json({
                    error: 'Debe esperar el cooldown.',
                    remaining_seconds: remaining,
                    intentos: resultado.intentos,
                    via_bloqueada: tokenRecord.via,
                    code: 'ERR_COOLDOWN'
                });
            }
        }

        // IP PINNING
        const currentIp = getCleanIp(req);
        if (tokenRecord.ip_solicitante && tokenRecord.ip_solicitante !== currentIp) {
            return res.status(403).json({
                error: 'IP no coincide con la solicitud original.',
                code: 'ERR_IP_MISMATCH'
            });
        }

        //  Comparar token 
        if (tokenRecord.codigo !== token) {
            const newIntentos = (resultado.intentos || 0) + 1;
            await resultado.update({
                intentos: newIntentos,
                ultimo_intento: new Date(),
                bloqueado: newIntentos >= 3
            });

            console.warn(`[SECURITY] Token incorrecto #${newIntentos} para ${client.documento} vía ${tokenRecord.via}`);

            return res.status(400).json({
                error: 'Token incorrecto.',
                code: 'ERR_TOKEN_INCORRECTO',
                intentos: newIntentos,
                bloqueado: newIntentos >= 3,
                via_bloqueada: tokenRecord.via
            });
        }

        //  TOKEN CORRECTO 
        await tokenRecord.update({ status: 'V' });
        await resultado.update({ bloqueado: false });

        console.log(`[API] Token verificado exitosamente para ${client.documento}`);

        // Webhook: Celular Validado <---aun pendiente
        sendWebhook('client.validated', {
            id: client.id,
            celular: client.celular,
            via: tokenRecord.via,
            fecha_validacion: new Date()
        });

        return res.status(200).json({
            message: 'Token verificado exitosamente.',
            data: { status: 'VALIDADO' }
        });

    } catch (error) {
        console.error('[ERROR] verifyToken:', error);
        return res.status(500).json({ error: 'Error interno al verificar token' });
    }
};

//FINALIZAR EL REGISTRO DEL CLIENTE
const finalizeRegistration = async (req, res) => {
    const { id } = req.params;
    const { correo, departamento, provincia, distrito, acepto_terminos } = req.body;

    if (!UUID_REGEX.test(id)) {
        return res.status(400).json({ error: 'ID de cliente inválido' });
    }

    try {
        const client = await Client.findByPk(id);
        if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });

        if (client.estado === true) {
            return res.status(400).json({ error: 'Este registro ya ha sido finalizado.', code: 'ALREADY_REGISTERED' });
        }

        // Debe haber un token validado
        const tokenValidado = await Token.findOne({
            where: { id_cliente: id, status: 'V' }
        });
        if (!tokenValidado) {
            return res.status(400).json({ error: 'Debe verificar su celular primero' });
        }

        if (!acepto_terminos) {
            return res.status(400).json({ error: 'Debe aceptar los términos y condiciones' });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
            return res.status(400).json({ error: 'Correo electrónico inválido' });
        }
        if (!departamento || !provincia || !distrito) {
            return res.status(400).json({ error: 'Debe completar su ubicación' });
        }

        await client.update({
            email: correo,
            departamento,
            provincia,
            distrito,
            acepto_terminos: true,
            estado: true  // ← ESTADO = TRUE = Registro completo
        });

        console.log(`[API] Registro finalizado para ${client.documento}`);

        // Webhook: Registro Completado
        sendWebhook('client.completed', {
            id: client.id,
            correo: client.email,
            ubicacion: `${client.departamento}, ${client.provincia}, ${client.distrito}`,
            estado_final: 'COMPLETADO'
        });

        return res.status(200).json({
            message: 'Registro completado exitosamente',
            data: { status: 'COMPLETADO' }
        });

    } catch (error) {
        console.error('[ERROR] finalizeRegistration:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

//CANCELAR EL TOKEN
const cancelToken = async (req, res) => {
    const { id } = req.params;
    if (!UUID_REGEX.test(id)) return res.status(400).json({ error: 'ID inválido' });

    try {
        const client = await Client.findByPk(id);
        if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });

        if (client.estado === true) {
            return res.status(400).json({ error: 'No se puede cancelar un token de un registro finalizado.' });
        }

        const tokenRecord = await Token.findOne({
            where: { id_cliente: id, status: 'P' },
            order: [['created_at', 'DESC']]
        });

        if (!tokenRecord) {
            return res.status(404).json({ error: 'No hay token pendiente' });
        }

        await tokenRecord.update({ status: 'X' });

        const resultado = await findOrCreateResult(id, tokenRecord.via);
        const newIntentos = (resultado.intentos || 0) + 1;
        await resultado.update({
            intentos: newIntentos,
            ultimo_intento: new Date(),
            bloqueado: newIntentos >= 3
        });

        console.log(`[API] Token cancelado. Intento #${newIntentos} vía ${tokenRecord.via}`);
        return res.status(200).json({
            message: 'Token cancelado',
            intentos: newIntentos,
            via_bloqueada: tokenRecord.via
        });
    } catch (error) {
        console.error('[ERROR] cancelToken:', error);
        return res.status(500).json({ error: 'Error interno' });
    }
};

//EXPIRAR EL TOKEN
const expireToken = async (req, res) => {
    const { id } = req.params;
    if (!UUID_REGEX.test(id)) return res.status(400).json({ error: 'ID inválido' });

    try {
        const client = await Client.findByPk(id);
        if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });

        if (client.estado === true) {
            return res.status(400).json({ error: 'Registro finalizado.' });
        }

        const tokenRecord = await Token.findOne({
            where: { id_cliente: id, status: 'P' },
            order: [['created_at', 'DESC']]
        });

        if (tokenRecord) {
            await tokenRecord.update({ status: 'E' });

            const resultado = await findOrCreateResult(id, tokenRecord.via);
            const newIntentos = (resultado.intentos || 0) + 1;
            await resultado.update({
                intentos: newIntentos,
                ultimo_intento: new Date(),
                bloqueado: newIntentos >= 3
            });
        }

        return res.status(200).json({ message: 'Token expirado registrado' });
    } catch (error) {
        console.error('[ERROR] expireToken:', error);
        return res.status(500).json({ error: 'Error interno' });
    }
};

//ESTADO DE LOS INTENTOS-COOLDOWN
const getCooldownStatus = async (req, res) => {
    const { id } = req.params;
    if (!UUID_REGEX.test(id)) return res.status(400).json({ error: 'ID inválido' });

    try {
        const client = await Client.findByPk(id);
        if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });

        if (client.estado === true) {
            return res.status(400).json({ error: 'Registro finalizado.' });
        }

        const data = {};

        for (const medio of ['S', 'W']) {
            const r = await ResultSend.findOne({ where: { id_cliente: id, via: medio } });

            if (r && r.intentos >= 3 && r.ultimo_intento) {
                const wait = getCooldownSeconds(r.intentos);
                const deadline = new Date(new Date(r.ultimo_intento).getTime() + wait * 1000);
                const remaining = Math.max(0, Math.ceil((deadline - new Date()) / 1000));

                data[medio] = {
                    intentos: r.intentos,
                    bloqueado: remaining > 0,
                    remaining_seconds: remaining
                };
            } else {
                data[medio] = {
                    intentos: r ? r.intentos : 0,
                    bloqueado: false,
                    remaining_seconds: 0
                };
            }
        }

        return res.status(200).json({ data });
    } catch (error) {
        console.error('[ERROR] getCooldownStatus:', error);
        return res.status(500).json({ error: 'Error interno' });
    }
};

// BUSCAR CLIENTE POR DOCUMENTO или CELULAR
const searchClient = async (req, res) => {
    const { type, value } = req.params;

    try {
        let where = {};
        if (type === 'documento') {
            where = { documento: value };
        } else if (type === 'telefono') {
            where = { celular: value };
        } else {
            return res.status(400).json({ error: 'Tipo de búsqueda inválido (documento, telefono)' });
        }

        const client = await Client.findOne({
            where,
            include: [
                {
                    model: Token,
                    attributes: ['codigo', 'via', 'status', 'created_at', 'updated_at']
                }
            ]
        });

        if (!client) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        return res.status(200).json({ data: client });
    } catch (error) {
        console.error('[ERROR] searchClient:', error);
        return res.status(500).json({ error: 'Error interno en búsqueda' });
    }
};

module.exports = {
    registerClient,
    requestToken,
    verifyToken,
    finalizeRegistration,
    cancelToken,
    expireToken,
    getCooldownStatus,
    searchClient
};
