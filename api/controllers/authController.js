const User = require('../models/User');
const Role = require('../models/Role');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

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
    const { username, password } = req.body;
    try {
        const user = await User.findOne({
            where: { username },
            include: [Role]
        });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.rol.nombre },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        return res.status(200).json({
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.rol.nombre,
                nombres: user.nombres
            }
        });
    } catch (error) {
        console.error('[ERROR] login:', error);
        return res.status(500).json({ error: 'Error en login' });
    }
};

// LOGOUT
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
    logout
};
