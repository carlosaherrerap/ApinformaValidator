/**
 * Servicio de envío de SMS vía InformaPerú API
 * Endpoint: POST /sms/send-unique-message
 * Autenticación: Basic Auth
 */

const SMS_BASE_URL = process.env.SMS_BASE_URL || 'https://api.informaperu.com/api/v1';
const SMS_USERNAME = process.env.SMS_USERNAME || 'user3_informaperuapi';
const SMS_PASSWORD = process.env.SMS_PASSWORD || '&w$9N60("(Sp';

// Generar header de autorización una sola vez
const auth = Buffer.from(`${SMS_USERNAME}:${SMS_PASSWORD}`).toString('base64');
const authHeader = `Basic ${auth}`;

/**
 * Enviar SMS a un número peruano de 9 dígitos.
 * @param {string} number - Celular de 9 dígitos (sin código de país)
 * @param {string} message - Texto del SMS
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendSMS(number, message) {
    try {
        const url = `${SMS_BASE_URL}/sms/send-unique-message`;

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
            },
            body: JSON.stringify({
                number: number,
                message_text: message
            })
        });

        const data = await res.json();

        if (!res.ok) {
            console.error(`[SMS] Send failed (${res.status}):`, JSON.stringify(data));
            return { success: false, error: data.message || `SMS API error: ${res.status}` };
        }

        console.log(`[SMS] Enviado a ${number}: OK`);
        if (data.campaign_id && data.message_id) {
            console.log(`[SMS DETAILS] CampaignID: ${data.campaign_id} | MessageID: ${data.message_id}`);
        }

        return { success: true, data };

    } catch (err) {
        console.error('[SMS] Send error:', err.message);
        return { success: false, error: err.message };
    }
}

module.exports = { sendSMS };
