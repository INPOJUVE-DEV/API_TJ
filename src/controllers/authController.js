const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const safeLogger = require('../utils/safeLogger');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET es obligatorio');
}
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '15m';

function generateAccessToken(id) {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
}

async function generateRefreshToken(userId) {
  const crypto = require('crypto');
  const refreshToken = crypto.randomBytes(40).toString('hex');
  const expiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.execute(
    'INSERT INTO refresh_tokens (usuario_id, refresh_token, expiry_date) VALUES (?, ?, ?)',
    [userId, refreshToken, expiryDate]
  );
  return refreshToken;
}

exports.login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'username y password son obligatorios' });
  }
  try {
    const conn = await db.getConnection();
    const [rows] = await conn.execute('SELECT id, password_hash FROM usuarios WHERE email = ?', [
      String(username).trim().toLowerCase()
    ]);
    await conn.release();
    if (rows.length === 0 || !rows[0].password_hash) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }
    const accessToken = generateAccessToken(user.id);
    const refreshToken = await generateRefreshToken(user.id);
    return res.json({ accessToken, refreshToken });
  } catch (err) {
    safeLogger.error('Error en login', err);
    return res.status(500).json({ message: 'Error interno' });
  }
};

exports.logout = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: 'Token requerido' });
  }
  const [, token] = authHeader.split(' ');
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;
    const conn = await db.getConnection();
    await conn.execute('DELETE FROM refresh_tokens WHERE usuario_id = ?', [userId]);
    await conn.release();
    return res.status(204).send();
  } catch (err) {
    return res.status(401).json({ message: 'Token inválido' });
  }
};

exports.sendOtp = async (req, res) => {
  return res.status(410).json({
    message: 'El flujo OTP por CURP fue retirado. Usa autenticacion interna o Auth0.'
  });
};

exports.verifyOtp = async (req, res) => {
  return res.status(410).json({
    message: 'El flujo OTP por CURP fue retirado. Usa autenticacion interna o Auth0.'
  });
};
