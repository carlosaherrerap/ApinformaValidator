const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const SessionBlacklist = require('../models/SessionBlacklist');
const { Op } = require('sequelize');

const JWT_SECRET = process.env.JWT_SECRET;

// Verificando que el request tiene un JWT válido y NO está en la blacklist.
const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token de acceso requerido' });
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        // Verificar si el token fue invalidado (logout)
        const blacklisted = await SessionBlacklist.findOne({ where: { token } });
        if (blacklisted) {
            return res.status(401).json({ error: 'Sesión cerrada. Inicie sesión nuevamente.' });
        }

        const user = await User.findByPk(decoded.id, { include: [Role] });
        if (!user || !user.status) {
            return res.status(401).json({ error: 'Usuario inactivo o no encontrado' });
        }

        req.user = {
            id: user.id,
            username: user.username,
            role: user.rol ? user.rol.nombre : 'VIEWER',
            can_view_stats: user.can_view_stats,
            can_view_tokens: user.can_view_tokens,
            can_view_data: user.can_view_data
        };
        req.token = token; // Guardamos el token para uso en logout
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token inválido o expirado' });
    }
};

// Requiere rol ADMIN.
const isAdmin = (req, res, next) => {
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Acceso denegado: se requiere rol ADMIN' });
    }
    next();
};

// Requiere permiso can_view_stats (números/dashboard).
const canViewStats = (req, res, next) => {
    if (!req.user.can_view_stats && req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'No tiene permiso para ver estadísticas' });
    }
    next();
};

// Requiere permiso can_view_data (lista de clientes con datos personales).
const canViewData = (req, res, next) => {
    if (!req.user.can_view_data && req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'No tiene permiso para ver datos de clientes' });
    }
    next();
};

// Requiere permiso can_view_tokens (ver tokens planos).
const canViewTokens = (req, res, next) => {
    if (!req.user.can_view_tokens && req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'No tiene permiso para ver tokens' });
    }
    next();
};

// Requiere ser el usuario 'admin' específicamente (para WhatsApp QR).
const isMainAdmin = (req, res, next) => {
    if (req.user.username !== 'admin') {
        return res.status(403).json({ error: 'Solo el administrador principal puede gestionar WhatsApp' });
    }
    next();
};

// Limpieza periódica de tokens expirados de la blacklist
const cleanExpiredBlacklist = async () => {
    try {
        const deleted = await SessionBlacklist.destroy({
            where: { expires_at: { [Op.lt]: new Date() } }
        });
        if (deleted > 0) console.log(`[BLACKLIST] Limpiados ${deleted} tokens expirados`);
    } catch (err) {
        console.error('[BLACKLIST] Error limpiando tokens:', err.message);
    }
};

// Ejecutar limpieza cada hora
setInterval(cleanExpiredBlacklist, 60 * 60 * 1000);

module.exports = { verifyToken, isAdmin, isMainAdmin, canViewStats, canViewData, canViewTokens };
