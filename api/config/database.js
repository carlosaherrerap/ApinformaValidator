const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: false, // Desactiva logs de SQL en consola para mayor limpieza
    define: {
        timestamps: true, // Habilita created_at y updated_at automáticamente
        underscored: true, // Usa snake_case para los nombres de columnas (created_at)
        freezeTableName: true // Evita que Sequelize pluralice los nombres de las tablas
    },
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
});

const testConnection = async (retries = 5) => {
    while (retries) {
        try {
            await sequelize.authenticate();
            console.log('✅ Conexión a la base de datos establecida correctamente.');
            return;
        } catch (error) {
            retries -= 1;
            console.log(`⚠️ Esperando a la base de datos... (Intentos restantes: ${retries})`);
            if (retries === 0) {
                console.error('❌ No se pudo conectar a la base de datos tras varios intentos:', error);
                process.exit(1); // Detener el proceso si no hay conexión
            }
            // Esperar 5 segundos antes de reintentar
            await new Promise(res => setTimeout(res, 5000));
        }
    }
};

module.exports = { sequelize, testConnection };
