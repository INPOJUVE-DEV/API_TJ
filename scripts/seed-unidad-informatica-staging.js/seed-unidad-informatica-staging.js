#!/usr/bin/env node

const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

/**
 * Seed de pruebas para simular la inyección de expedientes enviados por
 * la Unidad de Informática hacia API_TJ.
 *
 * Inserta expedientes usando el endpoint real de staging para que API_TJ:
 * - valide estructura;
 * - calcule curp_hash/curp_masked;
 * - cifre payload;
 * - guarde status = pending.
 *
 * Uso CMD/PowerShell:
 *   set API_BASE_URL=http://localhost:3000 && node scripts/seed-unidad-informatica-staging.js
 *
 * PowerShell:
 *   $env:API_BASE_URL="http://localhost:3000"
 *   node scripts/seed-unidad-informatica-staging.js
 *
 * Si el endpoint requiere token:
 *   $env:UI_INTEGRATION_TOKEN="TU_TOKEN"
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const UI_INTEGRATION_TOKEN = process.env.UI_INTEGRATION_TOKEN || '';
const API_PATH = process.env.API_PATH || '/api/v1/beneficiarios-staging';
const UI_PRIVATE_KEY_PATH = process.env.UI_PRIVATE_KEY_PATH || '';
const UI_CLIENT_CODE = process.env.UI_CLIENT_CODE || 'unidad_informatica';
const UI_KID = process.env.UI_KID || 'unidad_informatica-current';
const UI_AUDIENCE = process.env.UI_AUDIENCE || 'api_tj';
const UI_SCOPE = process.env.UI_SCOPE || 'beneficiarios.staging.create';
const UI_EXPIRES_IN = process.env.UI_EXPIRES_IN || '5m';

const endpoint = `${API_BASE_URL.replace(/\/$/, '')}${API_PATH}`;

const baseHeaders = {
  'Content-Type': 'application/json',
  Accept: 'application/json'
};

function buildIntegrationToken() {
  if (UI_INTEGRATION_TOKEN) {
    return UI_INTEGRATION_TOKEN;
  }

  if (!UI_PRIVATE_KEY_PATH) {
    return '';
  }

  const privateKey = fs.readFileSync(UI_PRIVATE_KEY_PATH, 'utf8');
  return jwt.sign(
    {
      iss: UI_CLIENT_CODE,
      sub: UI_CLIENT_CODE,
      aud: UI_AUDIENCE,
      jti: crypto.randomUUID(),
      scope: UI_SCOPE
    },
    privateKey,
    {
      algorithm: 'RS256',
      expiresIn: UI_EXPIRES_IN,
      header: { kid: UI_KID }
    }
  );
}

function buildHeaders() {
  const headers = { ...baseHeaders };
  const token = buildIntegrationToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

const records = [
  {
    external_request_id: 'UI-RETRY-2026-0001',
    beneficiario: {
      curp: 'AERL010101MSPRVN01',
      nombre: 'ALMA ELENA',
      apellido_paterno: 'RIOS',
      apellido_materno: 'LUNA',
      fecha_nacimiento: '2001-01-01',
      folio_tarjeta: 'TJ-RETRY-0001',
      sexo: 'M',
      discapacidad: false,
      id_ine: 'INE-RETRY-0001',
      telefono: '4441112233',
      domicilio: {
        calle: 'AVENIDA UNIVERSIDAD',
        numero_ext: '100',
        numero_int: null,
        colonia: 'CENTRO',
        municipio_id: 1,
        codigo_postal: '78000',
        seccional: '0001'
      }
    }
  },
  {
    external_request_id: 'UI-RETRY-2026-0002',
    beneficiario: {
      curp: 'BECM020202MSPLSN02',
      nombre: 'BERENICE',
      apellido_paterno: 'CASTILLO',
      apellido_materno: 'MENDOZA',
      fecha_nacimiento: '2002-02-02',
      folio_tarjeta: 'TJ-RETRY-0002',
      sexo: 'M',
      discapacidad: false,
      id_ine: 'INE-RETRY-0002',
      telefono: '4442223344',
      domicilio: {
        calle: 'CALLE HIDALGO',
        numero_ext: '25',
        numero_int: 'A',
        colonia: 'BARRIO DE SANTIAGO',
        municipio_id: 1,
        codigo_postal: '78049',
        seccional: '0002'
      }
    }
  },
  {
    external_request_id: 'UI-RETRY-2026-0003',
    beneficiario: {
      curp: 'CAGJ030303HSPTRS03',
      nombre: 'CARLOS JAVIER',
      apellido_paterno: 'AGUILAR',
      apellido_materno: 'GIL',
      fecha_nacimiento: '2003-03-03',
      folio_tarjeta: 'TJ-RETRY-0003',
      sexo: 'F',
      discapacidad: true,
      id_ine: 'INE-RETRY-0003',
      telefono: '4443334455',
      domicilio: {
        calle: 'CALLE REFORMA',
        numero_ext: '300',
        numero_int: null,
        colonia: 'JARDINES',
        municipio_id: 1,
        codigo_postal: '78100',
        seccional: '0003'
      }
    }
  },
  {
    external_request_id: 'UI-RETRY-2026-0004',
    beneficiario: {
      curp: 'DEHF040404MSPRRV04',
      nombre: 'DIANA FERNANDA',
      apellido_paterno: 'HERRERA',
      apellido_materno: 'FLORES',
      fecha_nacimiento: '2004-04-04',
      folio_tarjeta: 'TJ-RETRY-0004',
      sexo: 'M',
      discapacidad: false,
      id_ine: 'INE-RETRY-0004',
      telefono: '4444445566',
      domicilio: {
        calle: 'PRIVADA DEL BOSQUE',
        numero_ext: '12',
        numero_int: '2B',
        colonia: 'LOMAS',
        municipio_id: 1,
        codigo_postal: '78210',
        seccional: '0004'
      }
    }
  },
  {
    external_request_id: 'UI-RETRY-2026-0005',
    beneficiario: {
      curp: 'FOPM050505HSPNRN05',
      nombre: 'FERNANDO',
      apellido_paterno: 'ORTEGA',
      apellido_materno: 'PALACIOS',
      fecha_nacimiento: '2005-05-05',
      folio_tarjeta: 'TJ-RETRY-0005',
      sexo: 'F',
      discapacidad: false,
      id_ine: 'INE-RETRY-0005',
      telefono: '4445556677',
      domicilio: {
        calle: 'CALLE MORELOS',
        numero_ext: '88',
        numero_int: null,
        colonia: 'SAN MIGUELITO',
        municipio_id: 1,
        codigo_postal: '78339',
        seccional: '0005'
      }
    }
  }
];

async function postRecord(record) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(record)
  });

  let body;
  const text = await response.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return {
    external_request_id: record.external_request_id,
    status: response.status,
    ok: response.ok,
    body
  };
}

async function main() {
  console.log(`API_TJ endpoint: ${endpoint}`);
  console.log(`Registros a insertar: ${records.length}`);

  const results = [];

  for (const record of records) {
    const result = await postRecord(record);
    results.push(result);

    const marker = result.ok ? 'OK' : 'FAIL';
    console.log(`[${marker}] ${result.external_request_id} -> HTTP ${result.status}`);
    console.log(JSON.stringify(result.body, null, 2));
  }

  const inserted = results.filter((r) => r.ok).length;
  const failed = results.length - inserted;

  console.log('\nResumen');
  console.log(`Insertados/aceptados: ${inserted}`);
  console.log(`Fallidos: ${failed}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Error ejecutando seed de Unidad de Informática:', error);
  process.exit(1);
});
