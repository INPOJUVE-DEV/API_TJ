require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const port = Number(process.env.MOCK_EXTERNAL_PORT || 9091);
const host = process.env.MOCK_EXTERNAL_HOST || '127.0.0.1';
const issuerBase = process.env.MOCK_AUTH0_ISSUER || `http://${host}:${port}/auth0`;
const auth0Issuer = `${issuerBase.replace(/\/$/, '')}/`;
const auth0Kid = process.env.MOCK_AUTH0_KID || 'mock-auth0-kid';
const keysPath =
  process.env.POSTMAN_LOCAL_KEYS_FILE ||
  path.join(__dirname, 'fixtures', 'postman-local-keys.json');

const issuedIdempotencyKeys = new Set();
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicJwk = publicKey.export({ format: 'jwk' });
publicJwk.kid = auth0Kid;
publicJwk.use = 'sig';
publicJwk.alg = 'RS256';

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    auth0_issuer: auth0Issuer,
    sys_ipj_push_url: `http://${host}:${port}/sys-ipj/beneficiarios`
  });
});

app.get('/auth0/.well-known/jwks.json', (req, res) => {
  res.json({ keys: [publicJwk] });
});

app.post('/integration/issue-token', (req, res) => {
  let keysData;
  try {
    keysData = JSON.parse(fs.readFileSync(keysPath, 'utf8'));
  } catch (error) {
    return res.status(500).json({ message: 'No se encontraron llaves locales de Postman.' });
  }

  const clientCode = String(req.body?.client_code || '').trim();
  const requestedScopes = Array.isArray(req.body?.scopes)
    ? req.body.scopes.map((scope) => String(scope).trim()).filter(Boolean)
    : [];
  const expiresIn = req.body?.expiresIn || '5m';
  const clientData = keysData?.[clientCode];

  if (!clientData) {
    return res.status(404).json({ message: 'Cliente de integracion desconocido.' });
  }

  const allowedScopes = new Set((clientData.scopes || []).map(String));
  const scopes =
    requestedScopes.length > 0 ? requestedScopes.filter((scope) => allowedScopes.has(scope)) : clientData.scopes;
  if (scopes.length === 0) {
    return res.status(422).json({ message: 'No hay scopes validos para emitir el token.' });
  }

  const token = jwt.sign(
    {
      iss: clientData.client_code,
      sub: clientData.client_code,
      aud: keysData.audience || 'api_tj',
      jti: crypto.randomUUID(),
      scope: scopes.join(' ')
    },
    clientData.private_key,
    {
      algorithm: 'RS256',
      expiresIn,
      header: { kid: clientData.kid }
    }
  );

  return res.json({
    token,
    client_code: clientData.client_code,
    scopes
  });
});

app.post('/auth0/issue-id-token', (req, res) => {
  const sub = String(req.body?.sub || 'auth0|postman-local-user').trim();
  const email = String(req.body?.email || 'postman.local@example.com')
    .trim()
    .toLowerCase();
  const audience = String(req.body?.aud || process.env.AUTH0_CLIENT_ID || 'postman-local-client');
  const expiresIn = req.body?.expiresIn || '15m';
  const tokenIssuerBase = String(req.body?.issuer_base || issuerBase).trim();
  const tokenIssuer = `${tokenIssuerBase.replace(/\/$/, '')}/`;

  const token = jwt.sign(
    {
      iss: tokenIssuer,
      sub,
      aud: audience,
      email
    },
    privateKey.export({ format: 'pem', type: 'pkcs8' }),
    {
      algorithm: 'RS256',
      expiresIn,
      header: { kid: auth0Kid }
    }
  );

  res.json({
    token,
    issuer: tokenIssuer,
    audience,
    kid: auth0Kid
  });
});

app.post('/sys-ipj/beneficiarios', (req, res) => {
  const externalRequestId = String(req.body?.external_request_id || '').trim();
  const idempotencyKey = String(req.headers['idempotency-key'] || '').trim();
  const beneficiario = req.body?.beneficiario;

  if (!externalRequestId || !beneficiario || typeof beneficiario !== 'object') {
    return res.status(422).json({ accepted: false, message: 'Payload invalido.' });
  }

  if (idempotencyKey) {
    if (issuedIdempotencyKeys.has(idempotencyKey)) {
      return res.status(200).json({
        accepted: true,
        duplicate: true,
        external_request_id: externalRequestId
      });
    }
    issuedIdempotencyKeys.add(idempotencyKey);
  }

  return res.status(200).json({
    accepted: true,
    duplicate: false,
    external_request_id: externalRequestId
  });
});

app.listen(port, host, () => {
  console.log(`Mocks externos escuchando en http://${host}:${port}`);
  console.log(`AUTH0_DOMAIN=${issuerBase}`);
  console.log(`SYS_IPJ_PUSH_URL=http://${host}:${port}/sys-ipj/beneficiarios`);
});
