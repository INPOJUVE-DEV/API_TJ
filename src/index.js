require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const db = require('./config/db');

const app = express();

app.use(helmet());

// CORS configuration
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
app.use(cors({
  origin: FRONTEND_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ ok: true });
});

// parse multipart/form-data on register route
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const catalogRoutes = require('./routes/catalog');
const registerRoutes = require('./routes/register');
const cardholderRoutes = require('./routes/cardholders');
const qrRoutes = require('./routes/qr');

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1', userRoutes);
app.use('/api/v1', catalogRoutes);
app.use('/api/v1', registerRoutes);
app.use('/api/v1/cardholders', cardholderRoutes);
app.use('/api/v1/qr', qrRoutes);

const PORT = process.env.PORT || 8080;
if (require.main === module) {
  // Inicia el servidor solo si este archivo se ejecuta directamente
  app.listen(PORT, () => {
    console.log(`API escuchando en puerto ${PORT}`);
  });
}

// Exporta la instancia de app para pruebas
module.exports = app;
