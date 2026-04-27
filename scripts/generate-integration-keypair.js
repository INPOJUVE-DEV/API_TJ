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
      '  node scripts/generate-integration-keypair.js unidad_informatica generated-keys unidad_informatica-current'
    ].join('\n')
  );
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

  const envSnippet = [
    `INFORMATICA_JWT_PUBLIC_KEY=${String(publicKey).trim().replace(/\n/g, '\\n')}`,
    `INFORMATICA_JWT_KID=${kid}`,
    'INFORMATICA_ALLOWED_SCOPES=["cardholders.lookup","beneficiarios.staging.create"]',
    'INFORMATICA_IP_ALLOWLIST=[]'
  ].join('\n');

  fs.writeFileSync(privateKeyPath, privateKey);
  fs.writeFileSync(publicKeyPath, publicKey);
  fs.writeFileSync(envSnippetPath, envSnippet);

  console.log(`Llave privada: ${privateKeyPath}`);
  console.log(`Llave publica: ${publicKeyPath}`);
  console.log(`Snippet Railway: ${envSnippetPath}`);
  console.log('');
  console.log('Siguiente paso:');
  console.log(`1. Copia INFORMATICA_JWT_PUBLIC_KEY e INFORMATICA_JWT_KID a Railway.`);
  console.log(`2. Conserva la privada fuera de Git y usala para firmar JWT RS256.`);
}

main();
