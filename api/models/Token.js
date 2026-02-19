const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const Client = require('./Client');

const Token = sequelize.define('token', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    id_cliente: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: Client, key: 'id' }
    },
    codigo: {
        type: DataTypes.STRING(5),
        allowNull: false
    },
    codigo_hash: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    via: {
        type: DataTypes.CHAR(1),
        allowNull: false,
        validate: { isIn: [['S', 'W']] }
    },
    status: {
        type: DataTypes.CHAR(1),
        defaultValue: 'P',
        validate: { isIn: [['P', 'V', 'E', 'X', 'N']] }
    },
    ip_solicitante: {
        type: DataTypes.STRING(45)
    }
}, { tableName: 'token' });

Client.hasMany(Token, { foreignKey: 'id_cliente' });
Token.belongsTo(Client, { foreignKey: 'id_cliente' });

module.exports = Token;
