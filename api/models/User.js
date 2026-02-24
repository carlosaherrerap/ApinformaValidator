const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const Role = require('./Role');

const User = sequelize.define('usuario', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    username: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
    },
    password: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true
    },
    rol_id: {
        type: DataTypes.INTEGER,
        references: { model: Role, key: 'id' }
    },
    can_view_stats: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    can_view_tokens: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    can_view_data: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    photo: {
        type: DataTypes.STRING(500),
        allowNull: true,
        defaultValue: null
    },
    nombres: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    ap_paterno: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    ap_materno: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    documento: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    telefono: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    departamento: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    provincia: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    distrito: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    status: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    mfa_enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    mfa_secret: {
        type: DataTypes.STRING(10),
        allowNull: true
    },
    mfa_expires: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, { tableName: 'usuario' });

Role.hasMany(User, { foreignKey: 'rol_id' });
User.belongsTo(Role, { foreignKey: 'rol_id' });

module.exports = User;
