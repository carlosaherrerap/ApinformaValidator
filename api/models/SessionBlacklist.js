const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SessionBlacklist = sequelize.define('session_blacklist', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    token: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    username: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    expires_at: {
        type: DataTypes.DATE,
        allowNull: false
    }
}, {
    tableName: 'session_blacklist',
    underscored: true,
    indexes: [
        { fields: ['token'], unique: true },
        { fields: ['expires_at'] }
    ]
});

module.exports = SessionBlacklist;
