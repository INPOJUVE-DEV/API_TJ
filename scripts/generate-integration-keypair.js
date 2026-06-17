const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function usage() {
  console.log(
    [
      'Uso:',
      '  node scripts/generate-integration-keypair.js <client_code> [output_dir] [kid]',
      '',
      'Ejemplo:',
      '  node scripts/generate-integration-keypair.js unidad_informatica generated-keys unidad_informatica-current',
      '  node scripts/generate-integration-keypair.js sys_ipj generated-keys sys_ipj-current',
      '  node scripts/generate-integration-keypair.js api_tj generated-keys api_tj-current'
    ].join('\n')
  );
}

function buildEnvSnippet(clientCode, publicKey, kid) {
  const escapedPublicKey = String(publicKey).trim().replace(/\n/g, '\\n');

  if (clientCode === 'sys_ipj') {
    return [
      `SYS_IPJ_JWT_PUBLIC_KEY=${escapedPublicKey}`,
      `SYS_IPJ_JWT_KID=${kid}`,
      'SYS_IPJ_ALLOWED_SCOPES=["cardholders.sync"]',
      'SYS_IPJ_IP_ALLOWLIST=[]'
    ].join('\n');
  }

  if (clientCode === 'unidad_informatica') {
    return [
      `INFORMATICA_JWT_PUBLIC_KEY=${escapedPublicKey}`,
      `INFORMATICA_JWT_KID=${kid}`,
      'INFORMATICA_ALLOWED_SCOPES=["cardholders.lookup","beneficiarios.staging.create"]',
      'INFORMATICA_IP_ALLOWLIST=[]'
    ].join('\n');
  }

  if (clientCode === 'api_tj') {
    return [
      `API_TJ_PUBLIC_KEY=${escapedPublicKey}`,
      `API_TJ_JWT_KID=${kid}`,
      'API_TJ_AUDIENCE=sys_ipj',
      'API_TJ_ALLOWED_SCOPES=beneficiarios.create',
      'API_TJ_ISSUER=api_tj'
    ].join('\n');
  }

  return [
    `PUBLIC_KEY=${escapedPublicKey}`,
    `JWT_KID=${kid}`
  ].join('\n');
}

function main() {
  const clientCode = String(process.argv[2] || '').trim();
  const outputDir = String(process.argv[3] || 'generated-keys').trim();
  const kid = String(process.argv[4] || `${clientCode}-current`).trim();

  if (!clientCode) {
    usage();
    process.exit(1);
  }

  const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const privateKey = pair.privateKey.export({ format: 'pem', type: 'pkcs8' });
  const publicKey = pair.publicKey.export({ format: 'pem', type: 'spki' });

  const resolvedOutputDir = path.resolve(process.cwd(), outputDir);
  fs.mkdirSync(resolvedOutputDir, { recursive: true });

  const privateKeyPath = path.join(resolvedOutputDir, `${clientCode}_private.pem`);
  const publicKeyPath = path.join(resolvedOutputDir, `${clientCode}_public.pem`);
  const envSnippetPath = path.join(resolvedOutputDir, `${clientCode}_railway.env.txt`);

  const envSnippet = buildEnvSnippet(clientCode, publicKey, kid);

  fs.writeFileSync(privateKeyPath, privateKey);
  fs.writeFileSync(publicKeyPath, publicKey);
  fs.writeFileSync(envSnippetPath, envSnippet);

  console.log(`Llave privada: ${privateKeyPath}`);
  console.log(`Llave publica: ${publicKeyPath}`);
  console.log(`Snippet Railway: ${envSnippetPath}`);
  console.log('');
  console.log('Siguiente paso:');
  if (clientCode === 'api_tj') {
    console.log('1. Copia API_TJ_PUBLIC_KEY y API_TJ_JWT_KID al Sys_IPJ.');
    console.log('2. Conserva la privada fuera de Git y usala para firmar pushes hacia Sys_IPJ.');
  } else if (clientCode === 'sys_ipj') {
    console.log('1. Copia SYS_IPJ_JWT_PUBLIC_KEY y SYS_IPJ_JWT_KID a API_TJ.');
    console.log('2. Conserva la privada fuera de Git y usala para firmar sync hacia API_TJ.');
  } else {
    console.log('1. Copia la llave publica al sistema receptor.');
    console.log('2. Conserva la privada fuera de Git y usala para firmar JWT RS256.');
  }
}

main();
