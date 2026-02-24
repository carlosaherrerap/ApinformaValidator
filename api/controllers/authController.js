const User = require('../models/User');
const Role = require('../models/Role');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { sendWhatsApp } = require('../services/whatsappService');
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

// CREAR USUARIO
const createUser = async (req, res) => {
    const {
        username, password, email, nombres, ap_paterno, ap_materno,
        documento, telefono, departamento, provincia, distrito, rol_id
    } = req.body;

    try {
        const hash = await bcrypt.hash(password, 10);
        const user = await User.create({
            username,
            password: hash,
            email,
            nombres,
            ap_paterno,
            ap_materno,
            documento,
            telefono,
            departamento,
            provincia,
            distrito,
            rol_id
        });

        const { password: _, ...userData } = user.toJSON();
        return res.status(201).json({ message: 'Usuario creado', data: userData });
    } catch (error) {
        console.error('[ERROR] createUser:', error);
        return res.status(500).json({ error: 'Error al crear usuario' });
    }
};

// EDITAR USUARIO
const updateUser = async (req, res) => {
    const { id } = req.params;
    const updateData = { ...req.body };

    try {
        const user = await User.findByPk(id);
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

        if (updateData.password) {
            updateData.password = await bcrypt.hash(updateData.password, 10);
        }

        await user.update(updateData);
        return res.status(200).json({ message: 'Usuario actualizado' });
    } catch (error) {
        console.error('[ERROR] updateUser:', error);
        return res.status(500).json({ error: 'Error al actualizar usuario' });
    }
};

// ELIMINAR USUARIO
const deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        const user = await User.findByPk(id);
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
        await user.destroy();
        return res.status(200).json({ message: 'Usuario eliminado' });
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

const logout = async (req, res) => {
    // En JWT el logout suele manejarse en el cliente invalidando el token,
    // pero podemos retornar éxito para confirmación.
    return res.status(200).json({ message: 'Sesión cerrada' });
};

module.exports = {
    listUsers,
    createUser,
    updateUser,
    deleteUser,
    login,
    verifyMFA,
    logout
};
