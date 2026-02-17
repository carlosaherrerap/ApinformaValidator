const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Client = sequelize.define('cliente', {
    id: {
        type: DataTypes.UUID,//paquete de npm
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    tipo_doc: {
        type: DataTypes.CHAR(3),
        allowNull: false,
        validate: { isIn: [['DNI', 'RUC', 'CDE']] }
    },
    documento: {
        type: DataTypes.STRING(11),
        allowNull: false,
        unique: true
    },
    dv: {
        type: DataTypes.CHAR(1),
        allowNull: false
    },
    nombres: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    ap_paterno: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    ap_materno: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    celular: {
        type: DataTypes.CHAR(9)
    },
    operador: {
        type: DataTypes.STRING(10)
    },
    email: {
        type: DataTypes.STRING(255)
    },
    departamento: {
        type: DataTypes.STRING(100)
    },
    provincia: {
        type: DataTypes.STRING(100)
    },
    distrito: {
        type: DataTypes.STRING(100)
    },
    acepto_terminos: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    estado: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, { tableName: 'cliente' });

module.exports = Client;
