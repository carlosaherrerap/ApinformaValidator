const ADMIN_CLIENT_ID = process.env.CLIENT_ID || 'token_client_2026';
const ADMIN_CLIENT_SECRET = process.env.CLIENT_SECRET || 'secret_client_vault_2026';

/**
 * Middleware para validar Client Credentials vía Basic Auth.
 * Requerido para endpoints de autenticación (Login/MFA).
 */
const clientAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Basic ')) {
        return res.status(401).json({
            error: 'Authorization Basic header required',
            hint: 'Use Client Credentials (Client ID and Secret)'
        });
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [clientId, clientSecret] = credentials.split(':');

    if (clientId !== ADMIN_CLIENT_ID || clientSecret !== ADMIN_CLIENT_SECRET) {
        return res.status(401).json({ error: 'Invalid Client Credentials' });
    }

    next();
};

module.exports = { clientAuth };
