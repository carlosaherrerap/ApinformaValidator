const User = require('../models/User');
const Role = require('../models/Role');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { initWhatsApp, getStatus: getWAStatus, logout: logoutWA } = require('../services/whatsappService');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_token_2026_informa';

//HECHO PARA EL LOGIN DE USUARIOS(ADMIN, USUARIO NORMAL)
const login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username y password requeridos' });
    }

    try {
        const user = await User.findOne({
            where: { username, status: true },
            include: [Role]
        });

        if (!user) {
            console.log(`[AUTH] Login fallido: Usuario '${username}' no encontrado o inactivo`);
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            console.log(`[AUTH] Login fallido: Contraseña incorrecta para '${username}'`);
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.rol.nombre },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        return res.status(200).json({
            message: 'Login exitoso',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.rol.nombre,
                photo: user.photo,
                can_view_stats: user.can_view_stats,
                can_view_tokens: user.can_view_tokens
            }
        });

    } catch (error) {
        console.error('[ERROR] login:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

//CREAR USUARIOS(SOLO ADMITIDO POR EL ROL-->ADMIN)
const createUser = async (req, res) => {
    const { username, password, email, rol_id } = req.body;

    if (!username || !password || !email) {
        return res.status(400).json({ error: 'Username, password y email requeridos' });
    }

    try {
        const existing = await User.findOne({ where: { username } });
        if (existing) {
            return res.status(400).json({ error: 'El username ya existe' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await User.create({
            username,
            password: hashedPassword,
            email,
            rol_id: rol_id || 3 //  'VIEWER' por defecto
        });

        console.log(`[ADMIN] Usuario creado: ${username} por ${req.user.username}`);
        return res.status(201).json({
            message: 'Usuario creado correctamente',
            data: { id: newUser.id, username: newUser.username }
        });

    } catch (error) {
        console.error('[ERROR] createUser:', error);
        return res.status(500).json({ error: 'Error al crear usuario' });
    }
};

//ACTUAOZAR PERMISOS DE LOS USUARIOS NORMALES
const updateUserPermissions = async (req, res) => {
    const { userId } = req.params;
    const { can_view_stats, can_view_tokens, status } = req.body;

    try {
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const updates = {};
        if (typeof can_view_stats === 'boolean') updates.can_view_stats = can_view_stats;
        if (typeof can_view_tokens === 'boolean') updates.can_view_tokens = can_view_tokens;
        if (typeof status === 'boolean') updates.status = status;

        await user.update(updates);

        console.log(`[ADMIN] Permisos actualizados para ${user.username} por ${req.user.username}`);
        return res.status(200).json({
            message: 'Permisos actualizados',
            data: {
                username: user.username,
                can_view_stats: user.can_view_stats,
                can_view_tokens: user.can_view_tokens,
                status: user.status
            }
        });

    } catch (error) {
        console.error('[ERROR] updateUserPermissions:', error);
        return res.status(500).json({ error: 'Error al actualizar permisos' });
    }
};

//MOSTRADNO TODOS LOS USUARIOS(SOLO ADMIN)
const getUsers = async (req, res) => {
    try {
        const users = await User.findAll({
            include: [Role],
            attributes: { exclude: ['password'] },
            order: [['created_at', 'DESC']]
        });

        return res.status(200).json({ data: users });
    } catch (error) {
        console.error('[ERROR] getUsers:', error);
        return res.status(500).json({ error: 'Error al obtener usuarios' });
    }
};

//EDITANDO PERFIL
const updateProfile = async (req, res) => {
    const { email, photo, current_password, new_password } = req.body;

    try {
        const user = await User.findByPk(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const updates = {};
        if (email) updates.email = email;
        if (typeof photo === 'string') updates.photo = photo || null;

        // Cambio de contraseña
        if (new_password) {
            if (!current_password) {
                return res.status(400).json({ error: 'Debe proporcionar la contraseña actual' });
            }
            const valid = await bcrypt.compare(current_password, user.password);
            if (!valid) {
                return res.status(401).json({ error: 'Contraseña actual incorrecta' });
            }
            updates.password = await bcrypt.hash(new_password, 10);
        }

        await user.update(updates);

        return res.status(200).json({
            message: 'Perfil actualizado',
            data: {
                id: user.id,
                username: user.username,
                email: user.email,
                photo: user.photo
            }
        });

    } catch (error) {
        console.error('[ERROR] updateProfile:', error);
        return res.status(500).json({ error: 'Error al actualizar perfil' });
    }
};

//OBTENIEDNO LA VISTA DE PERFIL
const getProfile = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, {
            include: [Role],
            attributes: { exclude: ['password'] }
        });

        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

        return res.status(200).json({
            data: {
                id: user.id,
                username: user.username,
                email: user.email,
                photo: user.photo,
                role: user.rol?.nombre,
                can_view_stats: user.can_view_stats,
                can_view_tokens: user.can_view_tokens,
                created_at: user.created_at
            }
        });
    } catch (error) {
        console.error('[ERROR] getProfile:', error);
        return res.status(500).json({ error: 'Error al obtener perfil' });
    }
};

//iniciando codigo para validar  QR de conexion a whatsapp
const startWhatsApp = async (req, res) => {
    try {
        await initWhatsApp();
        return res.status(200).json({ message: 'Iniciando conexión WhatsApp...' });
    } catch (error) {
        console.error('[ERROR] startWhatsApp:', error);
        return res.status(500).json({ error: 'Error al iniciar WhatsApp' });
    }
};

//GENRANDO QR
const getWhatsAppStatus = async (req, res) => {
    const status = getWAStatus();
    return res.status(200).json(status);
};

///CERRANDO SESION DE WHATSAPP
const whatsAppLogout = async (req, res) => {
    try {
        await logoutWA();
        return res.status(200).json({ message: 'WhatsApp desconectado' });
    } catch (error) {
        return res.status(500).json({ error: 'Error al desconectar WhatsApp' });
    }
};

module.exports = {
    login, createUser, updateUserPermissions, getUsers,
    updateProfile, getProfile,
    startWhatsApp, getWhatsAppStatus, whatsAppLogout
};
