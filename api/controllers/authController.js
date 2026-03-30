const User = require('../models/User');
const Role = require('../models/Role');
const SessionBlacklist = require('../models/SessionBlacklist');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { sendWhatsApp, getStatus: getWAStatus, logout: logoutWA } = require('../services/whatsappService');
const { sendSMS } = require('../services/smsService');

// LISTAR USUARIOS
const listUsers = async (req, res) => {
    try {
        const users = await User.findAll({
            include: [{ model: Role, attributes: ['nombre'] }],
            attributes: { exclude: ['password'] }
        });
        return res.status(200).json({ data: users });
    } catch (error) {
        console.error('[ERROR] listUsers:', error);
        return res.status(500).json({ error: 'Error al listar usuarios' });
    }
};

// CREAR USUARIO (permisos automáticos según rol)
const createUser = async (req, res) => {
    let {
        username, password, email, nombres, ap_paterno, ap_materno,
        documento, telefono, departamento, provincia, distrito, rol_id
    } = req.body;

    // VALIDACIONES
    if (!username || username.trim().length === 0) return res.status(400).json({ error: 'Username es obligatorio' });
    if (!password || password.length < 4) return res.status(400).json({ error: 'Password debe tener al menos 4 caracteres' });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Email inválido' });
    if (!nombres || nombres.trim().length === 0) return res.status(400).json({ error: 'Nombres es obligatorio' });
    if (!documento || !/^\d{8}$/.test(documento)) return res.status(400).json({ error: 'Documento debe tener exactamente 8 dígitos' });
    if (!telefono || !/^\d{9}$/.test(telefono)) return res.status(400).json({ error: 'Teléfono debe tener exactamente 9 dígitos' });
    if (![1, 2, 3, "1", "2", "3"].includes(rol_id)) return res.status(400).json({ error: 'rol_id debe ser 1, 2 o 3' });

    try {
        const hash = await bcrypt.hash(password, 8); // Reducido a 8 rounds para rendimiento

        // Auto-asignar permisos según rol:
        const isAdminRole = parseInt(rol_id) === 1;
        const permissions = {
            can_view_stats: true,
            can_view_data: isAdminRole,
            can_view_tokens: isAdminRole
        };

        const user = await User.create({
            username: username.trim(),
            password: hash,
            email: email.toLowerCase().trim(),
            nombres: nombres.trim(),
            ap_paterno: ap_paterno ? ap_paterno.trim() : '',
            ap_materno: ap_materno ? ap_materno.trim() : '',
            documento,
            telefono,
            departamento,
            provincia,
            distrito,
            rol_id,
            ...permissions
        });

        console.log(`[AUTH] Usuario '${username}' creado con rol ${rol_id}. Permisos: stats=${permissions.can_view_stats}, data=${permissions.can_view_data}, tokens=${permissions.can_view_tokens}`);
        const { password: _, ...userData } = user.toJSON();
        return res.status(201).json({ message: 'Usuario creado', data: userData });
    } catch (error) {
        console.error('[ERROR] createUser:', error);
        return res.status(500).json({ error: 'Error al crear usuario' });
    }
};

// ACTUALIZAR USUARIO (Administración)
const updateUser = async (req, res) => {
    const { id } = req.params;
    const {
        username, password, email, nombres, ap_paterno, ap_materno,
        documento, telefono, departamento, provincia, distrito, rol_id, status,
        can_view_stats, can_view_data, can_view_tokens
    } = req.body;

    try {
        const user = await User.findByPk(id);
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

        const updateData = {};
        if (username) updateData.username = username;
        if (email) updateData.email = email;
        if (nombres) updateData.nombres = nombres;
        if (ap_paterno !== undefined) updateData.ap_paterno = ap_paterno;
        if (ap_materno !== undefined) updateData.ap_materno = ap_materno;
        if (documento) updateData.documento = documento;
        if (telefono) updateData.telefono = telefono;
        if (departamento) updateData.departamento = departamento;
        if (provincia) updateData.provincia = provincia;
        if (distrito) updateData.distrito = distrito;
        if (rol_id) updateData.rol_id = rol_id;
        if (status !== undefined) updateData.status = status;

        // Permisos manuales (solo si se envían)
        if (can_view_stats !== undefined) updateData.can_view_stats = can_view_stats;
        if (can_view_data !== undefined) updateData.can_view_data = can_view_data;
        if (can_view_tokens !== undefined) updateData.can_view_tokens = can_view_tokens;

        if (password) {
            updateData.password = await bcrypt.hash(password, 8);
        }

        await user.update(updateData);
        return res.status(200).json({ message: 'Usuario actualizado' });
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ error: 'Username o Email ya están en uso' });
        }
        return res.status(500).json({ error: 'Error al actualizar usuario' });
    }
};

// ELIMINAR USUARIO (Por tipo/valor)
const deleteUser = async (req, res) => {
    const { type, value } = req.params;

    try {
        let where = {};
        if (type === 'id') where = { id: value };
        else if (type === 'username') where = { username: value };
        else if (type === 'documento') where = { documento: value };
        else if (type === 'telefono') where = { telefono: value };
        else return res.status(400).json({ error: 'Tipo de eliminación inválido (id, username, documento, telefono)' });

        const user = await User.findOne({ where });
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

        if (user.username === 'admin') {
            return res.status(403).json({ error: 'No se puede eliminar al administrador principal' });
        }

        await user.destroy();
        return res.status(200).json({ message: `Usuario con ${type} '${value}' eliminado` });
    } catch (error) {
        console.error('[ERROR] deleteUser:', error);
        return res.status(500).json({ error: 'Error al eliminar usuario' });
    }
};

// LOGIN
const login = async (req, res) => {
    const { username, password, usuario, clave } = req.body;
    const finalUsername = usuario || username;
    const finalPassword = clave || password;

    try {
        const user = await User.findOne({
            where: { username: finalUsername },
            include: [Role]
        });

        if (!user || !(await bcrypt.compare(finalPassword, user.password))) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        // --- FLUJO MFA ---
        if (user.mfa_enabled) {
            const mfaCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6 dígitos
            const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutos

            await user.update({ mfa_secret: mfaCode, mfa_expires: expires });

            // Enviar por WhatsApp si tiene teléfono
            if (user.telefono) {
                const msg = `[TOKENIZER] Su código de acceso es: ${mfaCode}. Válido por 5 minutos.`;
                await sendWhatsApp(user.telefono, msg);
                console.log(`[MFA] Código enviado a ${user.telefono}`);
            }

            // Token temporal para el paso 2
            const tempToken = jwt.sign(
                { id: user.id, mfa_pending: true },
                process.env.JWT_SECRET,
                { expiresIn: '5m' }
            );

            return res.status(200).json({
                mfa_required: true,
                temp_token: tempToken,
                message: 'Código de verificación enviado vía WhatsApp/SMS'
            });
        }

        // LOGIN DIRECTO (SIN MFA)
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.rol.nombre },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        return res.status(200).json({
            access_token: token,
            token_type: 'Bearer',
            expires_in: 28800, // 8 horas
            user: {
                id: user.id,
                username: user.username,
                role: user.rol.nombre
            }
        });
    } catch (error) {
        console.error('[ERROR] login:', error);
        return res.status(500).json({ error: 'Error en login' });
    }
};

// LOGOUT
// VERIFICAR MFA
const verifyMFA = async (req, res) => {
    const { temp_token, mfa_code } = req.body;

    try {
        const decoded = jwt.verify(temp_token, process.env.JWT_SECRET);
        if (!decoded.mfa_pending) return res.status(400).json({ error: 'Token inválido' });

        const user = await User.findByPk(decoded.id, { include: [Role] });
        if (!user || user.mfa_secret !== mfa_code) {
            return res.status(401).json({ error: 'Código MFA incorrecto' });
        }

        if (new Date() > user.mfa_expires) {
            return res.status(401).json({ error: 'Código MFA expirado' });
        }

        // Limpiar MFA tras éxito
        await user.update({ mfa_secret: null, mfa_expires: null });

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.rol.nombre },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        return res.status(200).json({
            access_token: token,
            token_type: 'Bearer',
            expires_in: 28800,
            user: {
                id: user.id,
                username: user.username,
                role: user.rol.nombre
            }
        });
    } catch (error) {
        return res.status(401).json({ error: 'Sesión de verificación expirada o inválida' });
    }
};

// OBTENER PERFIL
const getProfile = async (req, res) => {
    console.log(`[AUTH] Solicitando perfil para ID: ${req.user.id}`);
    try {
        const user = await User.findByPk(req.user.id, {
            include: [Role],
            attributes: { exclude: ['password', 'mfa_secret'] }
        });
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

        return res.status(200).json({
            data: {
                id: user.id,
                username: user.username,
                role: user.rol.nombre,
                email: user.email,
                photo: user.photo,
                nombres: user.nombres,
                can_view_stats: user.can_view_stats,
                can_view_data: user.can_view_data,
                can_view_tokens: user.can_view_tokens
            }
        });
    } catch (error) {
        return res.status(500).json({ error: 'Error al obtener perfil' });
    }
};

// ACTUALIZAR MI PERFIL
const updateProfile = async (req, res) => {
    const {
        email, photo, telefono, nombres, ap_paterno, ap_materno,
        documento, departamento, provincia, distrito,
        current_password, new_password
    } = req.body;

    try {
        const user = await User.findByPk(req.user.id, { include: [Role] });
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

        const updateData = {};

        // Campos editables del perfil
        if (email) updateData.email = email;
        if (photo !== undefined) updateData.photo = photo;
        if (telefono) updateData.telefono = telefono;
        if (nombres) updateData.nombres = nombres;
        if (ap_paterno) updateData.ap_paterno = ap_paterno;
        if (ap_materno) updateData.ap_materno = ap_materno;
        if (documento) updateData.documento = documento;
        if (departamento) updateData.departamento = departamento;
        if (provincia) updateData.provincia = provincia;
        if (distrito) updateData.distrito = distrito;

        // Cambio de contraseña: requiere la contraseña actual
        if (new_password) {
            if (!current_password) {
                return res.status(400).json({ error: 'Debe proporcionar la contraseña actual para cambiarla' });
            }
            const isValid = await bcrypt.compare(current_password, user.password);
            if (!isValid) {
                return res.status(401).json({ error: 'Contraseña actual incorrecta' });
            }
            updateData.password = await bcrypt.hash(new_password, 10);
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'No se enviaron campos para actualizar' });
        }

        await user.update(updateData);
        console.log(`[AUTH] Perfil actualizado para: ${req.user.username}`);

        // Recargar datos actualizados
        await user.reload();

        return res.status(200).json({
            message: 'Perfil actualizado exitosamente',
            data: {
                id: user.id,
                username: user.username,
                email: user.email,
                photo: user.photo,
                nombres: user.nombres,
                ap_paterno: user.ap_paterno,
                ap_materno: user.ap_materno,
                documento: user.documento,
                telefono: user.telefono,
                departamento: user.departamento,
                provincia: user.provincia,
                distrito: user.distrito
            }
        });
    } catch (error) {
        console.error('[ERROR] updateProfile:', error);
        return res.status(500).json({ error: 'Error al actualizar perfil' });
    }
};

const logout = async (req, res) => {
    try {
        const token = req.token;
        const decoded = jwt.decode(token);
        const expires_at = new Date(decoded.exp * 1000); // Convertir Unix timestamp

        await SessionBlacklist.create({
            token,
            user_id: req.user.id,
            username: req.user.username,
            expires_at
        });

        console.log(`[AUTH] Sesión cerrada para: ${req.user.username}. Token invalidado hasta ${expires_at.toISOString()}`);
        return res.status(200).json({
            message: `Sesión de '${req.user.username}' cerrada exitosamente`,
            invalidated_at: new Date().toISOString()
        });
    } catch (error) {
        console.error('[ERROR] logout:', error);
        return res.status(500).json({ error: 'Error al cerrar sesión' });
    }
};

// --- GESTIÓN WHATSAPP QR ---

// Obtener estado y QR
const getQRStatus = async (req, res) => {
    try {
        const wa = getWAStatus();
        return res.status(200).json({
            status: wa.status,
            has_qr: wa.hasQR,
            qr: wa.qr, // DataURL del QR
            message: wa.status === 'connected' ? 'WhatsApp ya está conectado' : 'Escanee el QR para conectar'
        });
    } catch (error) {
        return res.status(500).json({ error: 'Error al obtener estado de WhatsApp' });
    }
};

// Servir QR como imagen (Direct view)
const getQRImage = async (req, res) => {
    try {
        const wa = getWAStatus();
        if (!wa.qr) {
            return res.status(404).send('QR no disponible o WhatsApp ya está conectado.');
        }

        // Decodificar base64 a Buffer
        const base64Data = wa.qr.replace(/^data:image\/png;base64,/, "");
        const img = Buffer.from(base64Data, 'base64');

        res.writeHead(200, {
            'Content-Type': 'image/png',
            'Content-Length': img.length
        });
        return res.end(img);
    } catch (error) {
        return res.status(500).send('Error al procesar imagen QR');
    }
};

// Cerrar sesión y limpiar QR
const invalidateQR = async (req, res) => {
    try {
        await logoutWA();
        return res.status(200).json({ message: 'Sesión de WhatsApp cerrada y QR invalidado' });
    } catch (error) {
        return res.status(500).json({ error: 'Error al invalidar sesión de WhatsApp' });
    }
};

module.exports = {
    listUsers,
    createUser,
    updateUser,
    deleteUser,
    login,
    verifyMFA,
    getProfile,
    updateProfile,
    logout,
    getQRStatus,
    getQRImage,
    invalidateQR
};
