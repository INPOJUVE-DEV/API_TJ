const jwt = require('jsonwebtoken');
const db = require('../config/db');

const CACHE_URL = process.env.BENEFICIARIOS_CACHE_URL || '';
const CACHE_SOURCE = process.env.BENEFICIARIOS_CACHE_SOURCE || 'api-externa';
const CACHE_JWT_SECRET =
  process.env.BENEFICIARIOS_CACHE_JWT_SECRET || process.env.JWT_SECRET || '';
const CACHE_JWT_TTL = process.env.BENEFICIARIOS_CACHE_JWT_TTL || '365d';
const REQUEST_TIMEOUT_MS = Number(process.env.BENEFICIARIOS_CACHE_TIMEOUT_MS || 8000);

if (CACHE_URL && !CACHE_JWT_SECRET) {
  throw new Error(
    'BENEFICIARIOS_CACHE_JWT_SECRET o JWT_SECRET es obligatorio cuando BENEFICIARIOS_CACHE_URL esta configurado'
  );
}

function normalizeUpper(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

function normalizeDate(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeString(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['true', '1', 'si', 'on', 'yes'].includes(normalized);
  }
  if (typeof value === 'number') {
    return value === 1;
  }
  return false;
}

function splitApellidos(apellidos) {
  const normalized = normalizeUpper(apellidos);
  if (!normalized) {
    return { apellidoPaterno: null, apellidoMaterno: null };
  }
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { apellidoPaterno: null, apellidoMaterno: null };
  }
  if (parts.length === 1) {
    return { apellidoPaterno: parts[0], apellidoMaterno: null };
  }
  return {
    apellidoPaterno: parts[0],
    apellidoMaterno: parts.slice(1).join(' ')
  };
}

function getSexoFromCurp(curp) {
  if (typeof curp !== 'string' || curp.length < 11) {
    return null;
  }
  const sexo = curp.charAt(10).toUpperCase();
  return sexo === 'H' || sexo === 'M' ? sexo : null;
}

function buildBeneficiario(payload) {
  const { apellidoPaterno, apellidoMaterno } = splitApellidos(payload.apellidos);
  const curp = normalizeUpper(payload.curp);

  return {
    folio_tarjeta: normalizeString(payload.folioTarjeta),
    nombre: normalizeUpper(payload.nombres),
    apellido_paterno: apellidoPaterno,
    apellido_materno: apellidoMaterno,
    curp,
    fecha_nacimiento: normalizeDate(payload.fechaNacimiento),
    sexo: getSexoFromCurp(curp),
    discapacidad: parseBoolean(payload.discapacidad),
    id_ine: normalizeString(payload.idIne),
    telefono: normalizeString(payload.telefono),
    domicilio: {
      calle: normalizeUpper(payload.calle),
      numero_ext: normalizeString(payload.numeroExt),
      numero_int: normalizeString(payload.numeroInt),
      colonia: normalizeUpper(payload.colonia),
      municipio_id: normalizeNumber(payload.municipioId),
      codigo_postal: normalizeString(payload.codigoPostal),
      seccional: normalizeString(payload.seccional)
    }
  };
}

function buildPayload(beneficiario) {
  return {
    source: CACHE_SOURCE,
    beneficiarios: [beneficiario]
  };
}

function buildJwt() {
  if (!CACHE_JWT_TTL || ['none', '0', 'false'].includes(String(CACHE_JWT_TTL).toLowerCase())) {
    return jwt.sign({ source: CACHE_SOURCE }, CACHE_JWT_SECRET);
  }
  return jwt.sign({ source: CACHE_SOURCE }, CACHE_JWT_SECRET, { expiresIn: CACHE_JWT_TTL });
}

function extractCounts(body) {
  if (!body || typeof body !== 'object') {
    return { total: null, inserted: null, rejected: null };
  }
  const total = Number(body.total);
  const inserted = Number(body.inserted);
  const rejected = Number(body.rejected);
  return {
    total: Number.isFinite(total) ? total : null,
    inserted: Number.isFinite(inserted) ? inserted : null,
    rejected: Number.isFinite(rejected) ? rejected : null
  };
}

async function sendPayload(payload) {
  if (!CACHE_URL) {
    return {
      status: 'skipped',
      responseStatus: null,
      counts: { total: null, inserted: null, rejected: null },
      errorMessage: 'BENEFICIARIOS_CACHE_URL no configurado'
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(CACHE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${buildJwt()}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (error) {
      json = null;
    }

    const counts = extractCounts(json);
    if (response.status === 409) {
      return {
        status: 'rejected',
        responseStatus: response.status,
        counts,
        errorMessage: 'Duplicado por CURP'
      };
    }
    if (!response.ok) {
      return {
        status: 'failed',
        responseStatus: response.status,
        counts,
        errorMessage: text || 'Error al enviar beneficiarios'
      };
    }
    if (counts.rejected && counts.rejected > 0) {
      return {
        status: 'rejected',
        responseStatus: response.status,
        counts,
        errorMessage: null
      };
    }
    return {
      status: 'sent',
      responseStatus: response.status,
      counts,
      errorMessage: null
    };
  } catch (error) {
    const message =
      error?.name === 'AbortError' ? 'Timeout al enviar beneficiarios' : error?.message;
    return {
      status: 'failed',
      responseStatus: null,
      counts: { total: null, inserted: null, rejected: null },
      errorMessage: message || 'Error al enviar beneficiarios'
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function saveSyncLog({ solicitudId, curp, payload, result }) {
  const counts = result?.counts || { total: null, inserted: null, rejected: null };
  await db.execute(
    `INSERT INTO beneficiarios_sync_log
      (solicitud_id, curp, payload, status, response_status, total_count, inserted_count, rejected_count, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      solicitudId,
      curp,
      JSON.stringify(payload),
      result?.status || 'failed',
      result?.responseStatus || null,
      counts.total,
      counts.inserted,
      counts.rejected,
      result?.errorMessage || null
    ]
  );
}

async function syncBeneficiario(data) {
  const beneficiario = buildBeneficiario(data);
  const payload = buildPayload(beneficiario);
  const result = await sendPayload(payload);
  return { payload, result };
}

module.exports = {
  syncBeneficiario,
  saveSyncLog
};
