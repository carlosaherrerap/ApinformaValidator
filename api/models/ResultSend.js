const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const Client = require('./Client');
const Token = require('./Token');

const ResultSend = sequelize.define('result_send', {
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
    id_token: {
        type: DataTypes.UUID,
        references: {
            model: Token,
            key: 'id'
        }
    },
    ip: {
        type: DataTypes.STRING(45)
    },
    attempts_failed: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    attempts_correct: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    attempts_no_response: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    via: {
        type: DataTypes.CHAR(1)
    },
    provider_status: {
        type: DataTypes.STRING(100)
    },
    raw_log: {
        type: DataTypes.JSONB
    }
}, {
    tableName: 'result_send',
    underscored: true
});

// Relaciones
Client.hasMany(ResultSend, { foreignKey: 'id_client' });
Token.hasMany(ResultSend, { foreignKey: 'id_token' });
ResultSend.belongsTo(Client, { foreignKey: 'id_client' });
ResultSend.belongsTo(Token, { foreignKey: 'id_token' });

module.exports = ResultSend;
