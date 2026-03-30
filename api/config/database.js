require('dotenv').config();
const { Sequelize } = require('sequelize');

//CONFIGURACION DE LA BASE DE DATOS
const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: false,
    timezone: '-05:00',
    dialectOptions: {
        useUTC: false,
        dateStrings: true,
        typeCast: true
    },
    define: {
        timestamps: true,
        underscored: true,
        freezeTableName: true
    },
    pool: {
        max: 20, // Aumentado para mejor concurrencia
        min: 5,
        acquire: 60000,
        idle: 10000
    },
    hooks: {
        beforeConnect: async (config) => {
            // Eliminar posibles lags en búsqueda de hosts
        }
    }
});

// Forzar zona horaria en cada conexión
sequelize.addHook('afterConnect', async (connection) => {
    await connection.query("SET TIME ZONE 'America/Lima';");
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
