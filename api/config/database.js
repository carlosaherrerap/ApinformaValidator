require('dotenv').config();
const { Sequelize } = require('sequelize');

//CONFIGURACION DE LA BASE DE DATOS
const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: false,
    timezone: '-05:00',
    define: {
        timestamps: true,
        underscored: true,
        freezeTableName: true
    },
    pool: {
        max: 10,
        min: 2,
        acquire: 30000,
        idle: 10000
    }
});

//TEST DE CONEXION A LA BASE DE DATOS

const testConnection = async (retries = 5) => {
    for (let i = 0; i < retries; i++) {
        try {
            await sequelize.authenticate();
            console.log('[DB] Conexión establecida correctamente');
            return true;
        } catch (err) {
            console.error(`[DB] Intento ${i + 1}/${retries} fallido:`, err.message);
            if (i < retries - 1) await new Promise(r => setTimeout(r, 3000));
        }
    }
    throw new Error('No se pudo conectar a la base de datos');
};

module.exports = { sequelize, testConnection };
