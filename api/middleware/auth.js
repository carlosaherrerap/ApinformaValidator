const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');

const JWT_SECRET = process.env.JWT_SECRET
//const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_token_2026_informa';


//Verifica que el request tiene un JWT válido.

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token de acceso requerido' });
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        const user = await User.findByPk(decoded.id, { include: [Role] });
        if (!user || !user.status) {
            return res.status(401).json({ error: 'Usuario inactivo o no encontrado' });
        }

        req.user = {
            id: user.id,
            username: user.username,
            role: user.rol ? user.rol.nombre : 'VIEWER',
            can_view_stats: user.can_view_stats,
            can_view_tokens: user.can_view_tokens
        };
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

//Requiere permiso can_view_stats.

const canViewStats = (req, res, next) => {
    if (!req.user.can_view_stats && req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'No tiene permiso para ver estadísticas' });
    }
    next();
};

//Requiere permiso can_view_tokens.
const canViewTokens = (req, res, next) => {
    if (!req.user.can_view_tokens && req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'No tiene permiso para ver tokens' });
    }
    next();
};

module.exports = { verifyToken, isAdmin, canViewStats, canViewTokens };
