const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const Client = require('./Client');

const ResultSend = sequelize.define('resultado_envio', {
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
    via: {
        type: DataTypes.CHAR(1),
        allowNull: false,
        validate: { isIn: [['S', 'W']] }
    },
    intentos: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    ultimo_intento: {
        type: DataTypes.DATE,
        allowNull: true
    },
    bloqueado: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    tableName: 'resultado_envio',
    indexes: [
        { unique: true, fields: ['id_cliente', 'via'] }
    ]
});

Client.hasMany(ResultSend, { foreignKey: 'id_cliente' });
ResultSend.belongsTo(Client, { foreignKey: 'id_cliente' });

module.exports = ResultSend;
