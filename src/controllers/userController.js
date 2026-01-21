const db = require('../config/db');
const {
  formatBarcodeValue,
  getOrCreateActiveToken
} = require('../services/qrTokens');

const EXPOSE_PII = String(process.env.EXPOSE_PII || '').toLowerCase() === 'true';

function maskPhone(phone) {
  if (!phone) {
    return null;
  }
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) {
    return null;
  }
  const suffix = digits.slice(-4);
  return `***${suffix}`;
}

function getYearMonthFromDateValue(dateValue) {
  if (!dateValue) {
    return null;
  }
  if (dateValue instanceof Date) {
    const year = dateValue.getFullYear();
    const month = String(dateValue.getMonth() + 1).padStart(2, '0');
    return `${year}${month}`;
  }
  if (typeof dateValue === 'string') {
    return `${dateValue.slice(0, 4)}${dateValue.slice(5, 7)}`;
  }
  return null;
}

function extractBirthDateFromCurp(curp) {
  if (typeof curp !== 'string' || curp.length < 10) {
    return null;
  }
  const year = Number(curp.slice(4, 6));
  const month = Number(curp.slice(6, 8));
  const day = Number(curp.slice(8, 10));
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  const now = new Date();
  const currentTwoDigits = now.getFullYear() % 100;
  const century = year <= currentTwoDigits ? 2000 : 1900;
  const fullYear = century + year;
  const date = new Date(fullYear, month - 1, day);
  if (date.getFullYear() !== fullYear || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

function calculateAge(birthDate) {
  if (!(birthDate instanceof Date)) {
    return null;
  }
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const hasNotHadBirthdayYet =
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate());
  if (hasNotHadBirthdayYet) {
    age -= 1;
  }
  return age;
}

exports.getProfile = async (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ message: 'Token requerido' });
  }

  try {
    const [rows] = await db.execute(
      `SELECT u.id, u.nombre, u.apellidos, u.curp, u.email, u.telefono, u.creditos,
              u.foto_url AS fotoUrl, u.portada_url AS portadaUrl, m.nombre AS municipio
       FROM usuarios u
       LEFT JOIN municipios m ON u.municipio_id = m.id
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const user = rows[0];
    const birthDate = extractBirthDateFromCurp(user.curp);
    const age = calculateAge(birthDate);
    const tokenRow = await getOrCreateActiveToken(user.id);
    const yearMonth = tokenRow ? getYearMonthFromDateValue(tokenRow.valid_from) : null;
    const barcodeValue =
      tokenRow && yearMonth ? formatBarcodeValue(tokenRow.token_value, yearMonth) : null;

    const response = {
      id: user.id,
      nombre: user.nombre,
      apellidos: user.apellidos,
      edad: age,
      creditos: Number(user.creditos || 0),
      barcodeValue,
      email: user.email,
      municipio: user.municipio,
      telefono: EXPOSE_PII ? user.telefono : maskPhone(user.telefono),
      fotoUrl: user.fotoUrl || null,
      portadaUrl: user.portadaUrl || null
    };

    return res.json(response);
  } catch (error) {
    console.error('Error al cargar perfil', error);
    return res.status(500).json({ message: 'Error al cargar el perfil.' });
  }
};
