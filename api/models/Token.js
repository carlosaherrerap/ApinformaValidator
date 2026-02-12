const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const Client = require('./Client');

const Token = sequelize.define('token', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    id_client: {
        type: DataTypes.UUID,
        references: {
            model: Client,
            key: 'id'
        }
    },
    request: {
        type: DataTypes.CHAR(4), //el 4 es para que acepte hasta 4 caracteres
        allowNull: false
    },
    via: {
        type: DataTypes.CHAR(1),
        allowNull: false,
        validate: {
            isIn: [['S', 'W', 'I', 'C']] // SMS, WHATSAPP, IVR, CORREO
        }
    },
    date_request: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    expiration_time: {
        type: DataTypes.DATE,
        allowNull: false
    },
    time_lapsed: {
        type: DataTypes.INTEGER
    },
    attempts_failed: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    status: {
        type: DataTypes.CHAR(1),
        defaultValue: 'P',
        validate: {
            isIn: [['P', 'V', 'E', 'X']] // PENDIENTE, VALIDADO, EXPIRADO, CANCELADO
        }
    }
}, {
    tableName: 'token',
    underscored: true
});

// Relaciones
Client.hasMany(Token, { foreignKey: 'id_client' });
Token.belongsTo(Client, { foreignKey: 'id_client' });

module.exports = Token;
