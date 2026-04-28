const db = require('../config/db');
const { decryptJson } = require('../services/fieldEncryptionService');
const safeLogger = require('../utils/safeLogger');
const stagingController = require('./beneficiariosStagingController');

function maskValue(value, visibleSuffix = 4) {
  if (value === null || value === undefined) {
    return null;
  }
  const stringValue = String(value);
  if (stringValue.length <= visibleSuffix) {
    return '*'.repeat(stringValue.length);
  }
  return `${'*'.repeat(Math.max(stringValue.length - visibleSuffix, 3))}${stringValue.slice(-visibleSuffix)}`;
}

function maskPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const domicilio = payload.domicilio && typeof payload.domicilio === 'object' ? payload.domicilio : {};
  return {
    ...payload,
    curp: maskValue(payload.curp, 2),
    id_ine: maskValue(payload.id_ine, 4),
    telefono: maskValue(payload.telefono, 4),
    domicilio: {
      ...domicilio,
      codigo_postal: maskValue(domicilio.codigo_postal, 2)
    }
  };
}

exports.list = async (req, res) => {
  try {
    const page = Math.max(Number(req.query?.page || 1), 1);
    const pageSize = Math.min(Math.max(Number(req.query?.pageSize || 20), 1), 100);
    const offset = (page - 1) * pageSize;
    const status = String(req.query?.status || '').trim().toLowerCase();
    const q = String(req.query?.q || '').trim();

    let where = 'WHERE 1=1';
    const params = [];
    if (status) {
      where += ' AND status = ?';
      params.push(status);
    }
    if (q) {
      where += ' AND external_request_id LIKE ?';
      params.push(`%${q}%`);
    }

    const [countRows] = await db.execute(
      `SELECT COUNT(*) AS total
       FROM beneficiario_staging
       ${where}`,
      params
    );
    const [rows] = await db.execute(
      `SELECT id, external_request_id, curp_masked, status, submitted_by_system, submitted_at,
              sent_at, resolved_at, error_message, locked_at, locked_by, sys_ipj_response_code
       FROM beneficiario_staging
       ${where}
       ORDER BY submitted_at DESC
       LIMIT ${Number(pageSize)} OFFSET ${Number(offset)}`,
      params
    );

    const total = Number(countRows[0]?.total || 0);
    return res.json({
      items: rows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    });
  } catch (error) {
    safeLogger.error('Error al listar staging admin', error);
    return res.status(500).json({ message: 'Error al listar staging.' });
  }
};

exports.getById = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(422).json({ message: 'id invalido.' });
  }

  try {
    const [rows] = await db.execute(
      `SELECT id, external_request_id, curp_masked, status, submitted_by_system, submitted_at,
              sent_at, resolved_at, error_message, payload_ciphertext, payload_iv, payload_tag,
              sys_ipj_response_code, locked_at, locked_by
       FROM beneficiario_staging
       WHERE id = ?
       LIMIT 1`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Staging no encontrado.' });
    }

    const row = rows[0];
    let payload = null;
    if (String(req.user?.role || '').toLowerCase() === 'admin') {
      try {
        payload = maskPayload(decryptJson(row));
      } catch (error) {
        safeLogger.error('Error al descifrar detalle admin de staging', error);
        payload = null;
      }
    }

    return res.json({
      id: row.id,
      external_request_id: row.external_request_id,
      curp_masked: row.curp_masked,
      status: row.status,
      submitted_by_system: row.submitted_by_system,
      submitted_at: row.submitted_at,
      sent_at: row.sent_at,
      resolved_at: row.resolved_at,
      error_message: row.error_message,
      sys_ipj_response_code: row.sys_ipj_response_code,
      locked_at: row.locked_at,
      locked_by: row.locked_by,
      payload
    });
  } catch (error) {
    safeLogger.error('Error al consultar staging admin', error);
    return res.status(500).json({ message: 'Error al consultar staging.' });
  }
};

exports.getAttempts = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(422).json({ message: 'id invalido.' });
  }

  try {
    const [rows] = await db.execute(
      `SELECT id, staging_id, external_request_id, actor, response_status, status, error_message,
              attempted_at, created_at
       FROM staging_push_attempts
       WHERE staging_id = ?
       ORDER BY attempted_at DESC`,
      [id]
    );
    return res.json({ items: rows });
  } catch (error) {
    safeLogger.error('Error al consultar intentos de staging admin', error);
    return res.status(500).json({ message: 'Error al consultar intentos.' });
  }
};

exports.push = stagingController.push;
