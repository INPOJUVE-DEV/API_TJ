const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET es obligatorio');
}
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '15m';

// Genera un token de acceso con expiración corta
function generateAccessToken(id) {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
}

// Genera un token de refresco (cadena aleatoria) y almacena en BD
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

// Autentica a un usuario y devuelve tokens
exports.login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'username y password son obligatorios' });
  }
  try {
    const conn = await db.getConnection();
    // Buscar por email o curp
    const [rows] = await conn.execute(
      'SELECT id, password_hash FROM usuarios WHERE email = ? OR curp = ?',
      [username, username]
    );
    await conn.release();
    if (rows.length === 0) {
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
    console.error(err);
    return res.status(500).json({ message: 'Error interno' });
  }
};

// Cierra la sesión eliminando los tokens de refresco del usuario
exports.logout = async (req, res) => {
  // Obtén el token de acceso para identificar al usuario
  const authHeader = req.headers['authorization'];
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

// Genera y almacena un código OTP para un curp
exports.sendOtp = async (req, res) => {
  const { curp } = req.body;
  if (!curp) {
    return res.status(400).json({ message: 'curp es obligatorio' });
  }
  try {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryDate = new Date(Date.now() + 5 * 60 * 1000); // 5 minutos
    const conn = await db.getConnection();
    await conn.execute('INSERT INTO otp_codes (curp, code, expiry_date) VALUES (?, ?, ?)', [curp, code, expiryDate]);
    await conn.release();
    // En un sistema real se enviaría el código por SMS o email. Aquí lo devolvemos para pruebas.
    const response = { message: 'OTP generado' };
    if (String(process.env.OTP_DEBUG || '').toLowerCase() === 'true') {
      response.otp = code;
    }
    return res.json(response);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error al generar OTP' });
  }
};

// Verifica el código OTP y emite tokens
exports.verifyOtp = async (req, res) => {
  const { curp, otp } = req.body;
  if (!curp || !otp) {
    return res.status(400).json({ message: 'curp y otp son obligatorios' });
  }
  try {
    const conn = await db.getConnection();
    const [rows] = await conn.execute(
      'SELECT id, expiry_date FROM otp_codes WHERE curp = ? AND code = ? ORDER BY created_at DESC LIMIT 1',
      [curp, otp]
    );
    if (rows.length === 0 || new Date(rows[0].expiry_date) < new Date()) {
      await conn.release();
      return res.status(400).json({ message: 'Código OTP inválido o expirado' });
    }
    // borrar el registro de OTP
    await conn.execute('DELETE FROM otp_codes WHERE curp = ? AND code = ?', [curp, otp]);
    // Buscar al usuario por curp
    const [users] = await conn.execute('SELECT id FROM usuarios WHERE curp = ?', [curp]);
    await conn.release();
    if (users.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    const userId = users[0].id;
    const accessToken = generateAccessToken(userId);
    const refreshToken = await generateRefreshToken(userId);
    return res.json({ accessToken, refreshToken });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error al verificar OTP' });
  }
};
