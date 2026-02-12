const { DataTypes } = require('sequelize');//sirve para definir los tipos de datos de las columnas
const { sequelize } = require('../config/database');//sirve para conectar con la base de datos

const Client = sequelize.define('client_token', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4, //la UUIDV4 es para generar un identificador único universal como un DNI pero para la base de datos por ejemplo 12345678901234567890123456789012 que usa 32 caracteres
        primaryKey: true
    },
    document: {
        type: DataTypes.STRING(20), //el 20 es para que acepte hasta 20 caracteres
        allowNull: false,
        unique: true
    },
    typeof: {
        type: DataTypes.CHAR(3),
        allowNull: false,
        validate: {
            isIn: [['RUC', 'DNI', 'CDE']]//el CDE es para carnet de extranjeria
        }
    },
    digit_very: {
        type: DataTypes.CHAR(1),
        allowNull: false
    },
    names: {
        type: DataTypes.STRING(255)
    },
    lastname_paternal: {
        type: DataTypes.STRING(255)
    },
    lastname_maternal: {
        type: DataTypes.STRING(255)
    },
    cellphone: {
        type: DataTypes.STRING(15),
        allowNull: true
    },
    operator: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    dept: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    prov: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    distr: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    allow: {
        type: DataTypes.SMALLINT,
        defaultValue: 2 // 1: Validado (SI), 2: En proceso, 0: Bloqueado (NO)
    },
    accept: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    tableName: 'client_token',
    underscored: true
});

module.exports = Client;
