require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { sequelize, testConnection } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

//  Middleware 
const staticPath = path.resolve(__dirname, '../frontend');// Ruta de la carpeta frontend
console.log(`[DEBUG] Sirviendo archivos estáticos desde: ${staticPath}`);
app.use(express.static(staticPath));
app.get('/test-admin', (req, res) => {
  res.sendFile(path.join(staticPath, 'admin.html'));
});

app.use(cors());
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(morgan('dev'));
app.use(express.json());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500000,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/v1/api/', limiter);

//  Rutas 
app.use('/api/v1/client', require('./routes/clientRoutes'));
app.use('/api/v1/auth', require('./routes/authRoutes'));
app.use('/api/v1/stats', require('./routes/statsRoutes'));

// Health check
app.get('/api/v1/status', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    token_length: parseInt(process.env.TOKEN_LENGTH) || 4
  });
});

// Iniciar Servidor 
const start = async () => {
  try {
    await testConnection();
    await sequelize.sync({ alter: true });
    console.log('[DB] Tablas sincronizadas');

    // --- ASEGURAR ADMIN ---
    const bcrypt = require('bcrypt');
    const User = require('./models/User');
    const Role = require('./models/Role');

    // Buscar o crear rol ADMIN
    const [adminRole] = await Role.findOrCreate({ where: { nombre: 'ADMIN' } });

    // Hash verificado para 'admin2026'
    const adminPass = bcrypt.hashSync('admin2026', 10);

    const [adminUser, created] = await User.findOrCreate({
      where: { username: 'admin' },
      defaults: {
        password: adminPass,
        email: 'admin@tokenizer.pe',
        telefono: '956469717', // Teléfono para MFA del admin
        rol_id: adminRole.id,
        can_view_stats: true,
        can_view_tokens: true,
        status: true,
        mfa_enabled: true
      }
    });

    if (!created) {
      await adminUser.update({ password: adminPass, status: true });
      console.log('[DB] Password de admin actualizado/verificado');
    } else {
      console.log('[DB] Usuario admin creado por defecto');
    }
    // -----------------------

    app.listen(PORT, () => {
      console.log(`[SERVER] API corriendo en http://localhost:${PORT}`);
      console.log(`[CONFIG] TOKEN_LENGTH=${process.env.TOKEN_LENGTH || 4}`);
    });
  } catch (err) {
    console.error('[FATAL] No se pudo iniciar:', err);
    process.exit(1);
  }
};

start();
