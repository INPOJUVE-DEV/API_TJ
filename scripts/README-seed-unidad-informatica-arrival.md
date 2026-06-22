# Seeders de Unidad Informatica -> API_TJ

Estos scripts simulan la llegada del integrador `unidad_informatica` hacia `API_TJ` usando los endpoints reales del backend.

## Archivos

- `scripts/seed-unidad-informatica-lookup.js`
- `scripts/seed-unidad-informatica-arrival.js`
- `scripts/fixtures/unidad-informatica-arrival.payload.json`

## Que simulan

### `seed-unidad-informatica-lookup.js`

Ejecuta casos de:

- CURP ya registrada en `cardholders_sync`
- CURP no encontrada

Sirve para validar el primer paso del flujo de Unidad Informatica.

### `seed-unidad-informatica-arrival.js`

Ejecuta el flujo real:

1. `POST /api/v1/cardholders/lookup`
2. si responde `404`, entonces `POST /api/v1/beneficiarios-staging`

Incluye:

- dos expedientes validos que deben terminar en staging,
- un expediente invalido para validar rechazo `422`.

## Formas de autenticacion soportadas

Los scripts intentan obtener un token nuevo para cada request, en este orden:

1. `UI_LOOKUP_TOKEN` o `UI_STAGING_TOKEN`
2. `UI_PRIVATE_KEY_PATH` para firmar JWT `RS256`
3. `MOCK_BASE_URL` con `POST /integration/issue-token`
4. `UI_INTEGRATION_TOKEN`

Para ejecuciones con varios requests se recomienda usar:

- `UI_PRIVATE_KEY_PATH`, o
- el mock local en `MOCK_BASE_URL`

No es recomendable reutilizar un solo token fijo para todo el flujo porque `jti` es anti-replay.

## Variables utiles

- `API_BASE_URL`
- `MOCK_BASE_URL`
- `UI_PRIVATE_KEY_PATH`
- `UI_LOOKUP_TOKEN`
- `UI_STAGING_TOKEN`
- `UI_INTEGRATION_TOKEN`
- `UI_CLIENT_CODE`
- `UI_KID`
- `UI_AUDIENCE`
- `UI_EXPIRES_IN`
- `UI_SEED_FIXTURE`

## Ejemplo con mock local

Primero levanta la API, la base y los mocks:

```powershell
docker compose up -d db
npm run mock:externals
node src/index.js
```

Luego ejecuta lookup:

```powershell
$env:API_BASE_URL="http://127.0.0.1:8081"
$env:MOCK_BASE_URL="http://127.0.0.1:9091"
node scripts/seed-unidad-informatica-lookup.js
```

Y el flujo de llegada:

```powershell
$env:API_BASE_URL="http://127.0.0.1:8081"
$env:MOCK_BASE_URL="http://127.0.0.1:9091"
node scripts/seed-unidad-informatica-arrival.js
```

## Ejemplo con llave privada RS256

```powershell
$env:API_BASE_URL="http://127.0.0.1:8081"
$env:UI_PRIVATE_KEY_PATH="generated-keys/unidad_informatica_private.pem"
node scripts/seed-unidad-informatica-arrival.js
```

## Resultado esperado

En `lookup`:

- un caso `200`,
- un caso `404`.

En `arrival`:

- dos casos con `lookup 404` y `staging 202`,
- un caso con `lookup 404` y `staging 422`.

Los casos exitosos deben dejar registros `pending` en `beneficiario_staging`.
