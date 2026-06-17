# Seed de Unidad de Informática → API_TJ

## Archivos

- `seed-unidad-informatica-staging.js`: script ejecutable para insertar expedientes usando el endpoint real de API_TJ.
- `seed-unidad-informatica-staging.payload.json`: payload de referencia con 5 expedientes.

## Ubicación recomendada

Copia el archivo JS dentro del repo API_TJ:

```txt
scripts/seed-unidad-informatica-staging.js
```

El JSON es opcional; guárdalo en:

```txt
scripts/fixtures/seed-unidad-informatica-staging.payload.json
```

## Ejecutar en Windows PowerShell

```powershell
$env:API_BASE_URL="http://localhost:3000"
node scripts/seed-unidad-informatica-staging.js
```

Si el endpoint requiere token:

```powershell
$env:API_BASE_URL="http://localhost:3000"
$env:UI_INTEGRATION_TOKEN="TU_TOKEN"
node scripts/seed-unidad-informatica-staging.js
```

## Ejecutar en CMD

```cmd
set API_BASE_URL=http://localhost:3000
node scripts\seed-unidad-informatica-staging.js
```

## Validación SQL

```sql
SELECT
  id,
  external_request_id,
  curp_masked,
  status,
  submitted_by_system,
  submitted_at,
  sent_at,
  resolved_at,
  error_message
FROM beneficiario_staging
WHERE external_request_id LIKE 'UI-TEST-2026-%'
ORDER BY id DESC;
```

## Resultado esperado

Los registros deben quedar en `beneficiario_staging` con:

```txt
status = pending
payload cifrado
curp_hash calculado
curp_masked calculado
```

Después, desde Admin_App o Postman, ejecuta el envío a Sys_IPJ.
