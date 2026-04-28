require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { validateRuntimeConfig } = require('./config/runtimeConfig');
const safeLogger = require('./utils/safeLogger');
const { bootstrapIntegrationClients } = require('./services/integrationClientBootstrapService');

validateRuntimeConfig();

const app = express();

app.use(helmet());

// CORS configuration
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
const ADMIN_FRONTEND_ORIGIN = process.env.ADMIN_FRONTEND_ORIGIN || FRONTEND_ORIGIN;
const publicOrigins = new Set([FRONTEND_ORIGIN, ADMIN_FRONTEND_ORIGIN].filter(Boolean));

function corsOptionsDelegate(req, callback) {
  const requestOrigin = req.header('Origin');
  const isAdminPath = (req.path || '').startsWith('/api/v1/admin');
  const allowedOrigins = isAdminPath
    ? new Set([ADMIN_FRONTEND_ORIGIN].filter(Boolean))
    : publicOrigins;

  const origin = !requestOrigin
    ? false
    : allowedOrigins.has(requestOrigin)
      ? requestOrigin
      : false;

  callback(null, {
    origin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  });
}

app.use(cors(corsOptionsDelegate));

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
const beneficiariosStagingRoutes = require('./routes/beneficiariosStaging');
const adminAuthRoutes = require('./routes/adminAuth');
const adminDashboardRoutes = require('./routes/adminDashboard');
const adminLookupsRoutes = require('./routes/adminLookups');
const adminUsersRoutes = require('./routes/adminUsers');
const adminBeneficiariosStagingRoutes = require('./routes/adminBeneficiariosStaging');
const adminSessionRoutes = require('./routes/adminSession');

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1', userRoutes);
app.use('/api/v1', catalogRoutes);
app.use('/api/v1', registerRoutes);
app.use('/api/v1/cardholders', cardholderRoutes);
app.use('/api/v1/beneficiarios-staging', beneficiariosStagingRoutes);
app.use('/api/v1/qr', qrRoutes);
app.use('/api/v1/admin/auth', adminAuthRoutes);
app.use('/api/v1/admin', adminSessionRoutes);
app.use('/api/v1/admin', adminDashboardRoutes);
app.use('/api/v1/admin', adminLookupsRoutes);
app.use('/api/v1/admin', adminUsersRoutes);
app.use('/api/v1/admin', adminBeneficiariosStagingRoutes);

const PORT = process.env.PORT || 8080;
if (require.main === module) {
  (async () => {
    try {
      await bootstrapIntegrationClients();
      app.listen(PORT, () => {
        safeLogger.info(`API escuchando en puerto ${PORT}`);
      });
    } catch (error) {
      safeLogger.error('Error al inicializar clientes de integracion', error);
      process.exit(1);
    }
  })();
}

// Exporta la instancia de app para pruebas
module.exports = app;
