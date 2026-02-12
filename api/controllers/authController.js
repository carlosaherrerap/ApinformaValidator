const User = require('../models/User');
const Role = require('../models/Role');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

/**
 * Inicio de sesión de un usuario administrativo.
 ***/
const login = async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({
            where: { username },
            include: [Role]
        });

        if (!user) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        // Verificar contraseña
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        // Generar Token JWT
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.ROL.nombre },
            process.env.JWT_SECRET || 'admin%%2026$$maintenance.ok',
            { expiresIn: '8h' } //EXPIRACION DEL TOKEN
        );

        return res.status(200).json({
            message: 'Inicio de sesión exitoso',
            token,
            user: {
                username: user.username,
                role: user.ROL.nombre
            }
        });

    } catch (error) {
        console.error('Error en login:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

/**
 * Crea un nuevo usuario (Solo Admin).
 */
const createUser = async (req, res) => {
    const { username, password, email, rol_id } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await User.create({
            username,
            password: hashedPassword,
            email,
            rol_id
        });

        return res.status(201).json({
            message: 'Usuario creado correctamente',
            data: { id: newUser.id, username: newUser.username }
        });

    } catch (error) {
        console.error('Error al crear usuario:', error);
        return res.status(500).json({ error: 'Error al crear usuario' });
    }
};

module.exports = {
    login,
    createUser
};
