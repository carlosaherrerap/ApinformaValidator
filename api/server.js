require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { sequelize, testConnection } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Probar conexión a la base de datos
testConnection();

// Seguridades
app.use(helmet());
app.use(cors());
app.use(require('morgan')('dev'));
app.use(express.json());

// Limitador de peticiones para evitar abusos
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // límite de 100 peticiones por ventana 
});
//Esto es para evitar ataques de fuerza bruta como cuando intentan adivinar la contraseña o el token, pero no es infalible. 
//Para mayor seguridad se debe implementar un sistema de autenticación de dos factores.
app.use('/v1/api/', limiter);

// Rutas base
app.use('/v1/api/client', require('./routes/clientRoutes')); //el require se usa para importar rutas
app.use('/v1/api/auth', require('./routes/authRoutes'));

// Endpoint de Estado/Salud para monitoreo
app.get('/v1/api/status', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    uptime: process.uptime()
  });
});

app.get('/', (req, res) => {
  res.json({ message: 'API de Registro y Validación de Clientes activa', version: '1.0.0' });
});

// Levantar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
