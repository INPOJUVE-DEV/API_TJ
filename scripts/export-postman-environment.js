const fs = require('fs');
const path = require('path');

const sourcePath = path.join(__dirname, 'fixtures', 'postman-local-env.json');
const outputPath = path.join(__dirname, 'fixtures', 'API_TJ_local.postman_environment.json');

function main() {
  const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const environment = {
    id: 'api-tj-local-environment',
    name: 'API_TJ Local',
    values: Object.entries(source).map(([key, value]) => ({
      key,
      value: value == null ? '' : String(value),
      type: 'text',
      enabled: true
    })),
    _postman_variable_scope: 'environment',
    _postman_exported_at: new Date().toISOString(),
    _postman_exported_using: 'Codex'
  };

  fs.writeFileSync(outputPath, JSON.stringify(environment, null, 2));
  console.log(`Environment Postman exportado en ${outputPath}`);
}

main();
