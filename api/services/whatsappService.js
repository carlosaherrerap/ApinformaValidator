/**
 * Servicio de WhatsApp via Baileys
 * Permite conectar una cuenta de WhatsApp escaneando QR y enviar mensajes.
 */
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');

const AUTH_DIR = path.join(__dirname, '..', '..', 'whatsapp_auth');
let sock = null;
let qrCode = null;
let connectionStatus = 'disconnected'; // disconnected | connecting | connected

// Event emitter básico para notificar QR updates al frontend
const listeners = [];

function onQRUpdate(callback) {
    listeners.push(callback);
}

async function emitQR(qr) {
    try {
        qrCode = await qrcode.toDataURL(qr);
        listeners.forEach(cb => { try { cb(qrCode); } catch (e) { } });
    } catch (err) {
        console.error('[WA] Error al generar DataURL:', err);
    }
}

/**
 * Inicializar conexión WhatsApp.
 */
async function initWhatsApp() {
    if (connectionStatus === 'connecting') {
        console.log('[WA] Ya se está conectando...');
        return;
    }

    connectionStatus = 'connecting';
    qrCode = null;

    if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }),
        browser: ['Tokenizer Huancayo', 'Chrome', '120.0.0'],
        generateHighQualityLinkPreview: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('[WA] Nuevo QR generado');
            emitQR(qr);
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log(`[WA] Conexión cerrada. Razón: ${reason}`);

            if (reason !== DisconnectReason.loggedOut) {
                connectionStatus = 'disconnected';
                // Auto-reconectar después de 5 segundos
                setTimeout(() => initWhatsApp(), 5000);
            } else {
                connectionStatus = 'disconnected';
                // Limpiar sesión
                if (fs.existsSync(AUTH_DIR)) {
                    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
                }
                console.log('[WA] Sesión cerrada. Debe escanear QR nuevamente.');
            }
        }

        if (connection === 'open') {
            connectionStatus = 'connected';
            qrCode = null;
            console.log('[WA] ¡Conectado exitosamente!');
        }
    });
}

/**
 * Enviar mensaje de WhatsApp.
 * @param {string} number - Número de teléfono (9 dígitos, se agrega 51 automáticamente)
 * @param {string} message - Texto del mensaje
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendWhatsApp(number, message) {
    if (connectionStatus !== 'connected' || !sock) {
        return { success: false, error: 'WhatsApp no está conectado. Escanee el QR primero.' };
    }

    try {
        // Formatear número a formato WhatsApp (51XXXXXXXXX@s.whatsapp.net)
        const cleanNumber = number.replace(/\D/g, '');
        const jid = cleanNumber.length === 9 ? `51${cleanNumber}@s.whatsapp.net` : `${cleanNumber}@s.whatsapp.net`;

        const result = await sock.sendMessage(jid, { text: message });
        console.log(`[WA] Mensaje enviado a ${jid} | ID: ${result?.key?.id}`);
        return { success: true, id: result?.key?.id };

    } catch (err) {
        console.error('[WA] Error al enviar:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Obtener estado actual de la conexión.
 */
function getStatus() {
    return {
        status: connectionStatus,
        hasQR: !!qrCode,
        qr: qrCode
    };
}

/**
 * Desconectar WhatsApp (cerrar sesión).
 */
async function logout() {
    if (sock) {
        try {
            await sock.logout();
        } catch (e) { }
        sock = null;
    }
    connectionStatus = 'disconnected';
    qrCode = null;
    if (fs.existsSync(AUTH_DIR)) {
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    }
    console.log('[WA] Sesión eliminada');
}

module.exports = { initWhatsApp, sendWhatsApp, getStatus, logout, onQRUpdate };
