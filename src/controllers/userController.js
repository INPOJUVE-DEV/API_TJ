const db = require('../config/db');
const { decryptString } = require('../services/fieldEncryptionService');
const {
  formatBarcodeValue,
  getOrCreateActiveToken
} = require('../services/qrTokens');
const safeLogger = require('../utils/safeLogger');

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

function safeDecryptString(payload) {
  try {
    return decryptString(payload);
  } catch (error) {
    safeLogger.error('No se pudo descifrar campo de perfil', error);
    return null;
  }
}

exports.getProfile = async (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ message: 'Token requerido' });
  }

  try {
    const [rows] = await db.execute(
      `SELECT u.id, u.nombre, u.apellidos, u.email, u.telefono, u.creditos, u.role, u.status,
              u.foto_url AS fotoUrl, u.portada_url AS portadaUrl,
              u.cardholder_sync_id AS cardholderSyncId,
              m.nombre AS municipio, cs.tarjeta_numero AS tarjetaNumero,
              cs.nombres_ciphertext, cs.nombres_iv, cs.nombres_tag,
              cs.apellido_ciphertext, cs.apellido_iv, cs.apellido_tag
       FROM usuarios u
       LEFT JOIN municipios m ON u.municipio_id = m.id
       LEFT JOIN cardholders_sync cs ON cs.id = u.cardholder_sync_id
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const user = rows[0];
    const syncedNombre = safeDecryptString({
      payload_ciphertext: user.nombres_ciphertext,
      payload_iv: user.nombres_iv,
      payload_tag: user.nombres_tag
    });
    const syncedApellidos = safeDecryptString({
      payload_ciphertext: user.apellido_ciphertext,
      payload_iv: user.apellido_iv,
      payload_tag: user.apellido_tag
    });
    const nombre = user.nombre || syncedNombre || null;
    const apellidos = user.apellidos || syncedApellidos || null;
    const nombreCompleto = [nombre, apellidos].filter(Boolean).join(' ').trim() || null;
    const primerApellido = apellidos ? String(apellidos).trim().split(/\s+/)[0] : null;
    const tokenRow = await getOrCreateActiveToken(user.id);
    const yearMonth = tokenRow ? getYearMonthFromDateValue(tokenRow.valid_from) : null;
    const barcodeValue =
      tokenRow && yearMonth ? formatBarcodeValue(tokenRow.token_value, yearMonth) : null;

    const response = {
      id: user.id,
      nombre,
      apellidos,
      nombreCompleto,
      titular: {
        nombre,
        primerApellido
      },
      titularNombre: nombre,
      titularPrimerApellido: primerApellido,
      nombreTitular: nombre,
      primerApellidoTitular: primerApellido,
      role: user.role,
      status: user.status,
      edad: null,
      creditos: Number(user.creditos || 0),
      barcodeValue,
      email: user.email,
      municipio: user.municipio,
      telefono: EXPOSE_PII ? user.telefono : maskPhone(user.telefono),
      fotoUrl: user.fotoUrl || null,
      portadaUrl: user.portadaUrl || null,
      cardholderSyncId: user.cardholderSyncId || null,
      tarjetaNumero: user.tarjetaNumero || null
    };

    return res.json(response);
  } catch (error) {
    safeLogger.error('Error al cargar perfil', error);
    return res.status(500).json({ message: 'Error al cargar el perfil.' });
  }
};
