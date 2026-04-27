const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

function usage() {
  console.log(
    [
      'Uso:',
      '  node scripts/build-integration-token.js <private_key_path> <client_code> <kid> <scope_csv> [audience] [expires_in]',
      '',
      'Ejemplo:',
      '  node scripts/build-integration-token.js generated-keys/unidad_informatica_private.pem unidad_informatica unidad_informatica-current cardholders.lookup api_tj 5m'
    ].join('\n')
  );
}

function main() {
  const privateKeyPath = String(process.argv[2] || '').trim();
  const clientCode = String(process.argv[3] || '').trim();
  const kid = String(process.argv[4] || '').trim();
  const scopeCsv = String(process.argv[5] || '').trim();
  const audience = String(process.argv[6] || 'api_tj').trim();
  const expiresIn = String(process.argv[7] || '5m').trim();

  if (!privateKeyPath || !clientCode || !kid || !scopeCsv) {
    usage();
    process.exit(1);
  }

  const resolvedPrivateKeyPath = path.resolve(process.cwd(), privateKeyPath);
  const privateKey = fs.readFileSync(resolvedPrivateKeyPath, 'utf8');
  const scope = scopeCsv
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .join(' ');

  const token = jwt.sign(
    {
      iss: clientCode,
      sub: clientCode,
      aud: audience,
      jti: crypto.randomUUID(),
      scope
    },
    privateKey,
    {
      algorithm: 'RS256',
      expiresIn,
      header: { kid }
    }
  );

  console.log(token);
}

main();
