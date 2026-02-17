const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

/**
 * Servicio para enviar notificaciones Webhook a sistemas externos
 */
const sendWebhook = async (event, data) => {
    const webhookUrl = process.env.WEBHOOK_URL;

    // Si no hay URL configurada, solo logueamos para desarrollo
    if (!webhookUrl) {
        console.log(`[WEBHOOK][MOCK] Evento: ${event}`, JSON.stringify(data, null, 2));
        return;
    }

    try {
        const payload = {
            event,
            timestamp: new Date().toISOString(),
            data
        };

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Webhook-Event': event
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            console.log(`[WEBHOOK] Notificación enviada: ${event}`);
        } else {
            console.error(`[WEBHOOK] Error al enviar ${event}: ${response.status}`);
        }
    } catch (error) {
        console.error(`[WEBHOOK] Error de conexión para ${event}:`, error.message);
    }
};

module.exports = { sendWebhook };
