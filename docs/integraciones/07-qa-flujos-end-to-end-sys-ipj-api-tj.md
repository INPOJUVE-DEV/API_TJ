# QA flujos end-to-end Sys_IPJ -> API_TJ

## 1. Objetivo

Este documento describe como validar localmente la compatibilidad entre `Sys_IPJ` y `API_TJ` para los flujos de integracion ya aprobados en el backend.

Los objetivos de prueba son:

1. recibir padron minimo desde `Sys_IPJ`,
2. permitir lookup desde Unidad de Informatica,
3. crear staging de beneficiarios no encontrados,
4. empujar staging aprobado hacia `Sys_IPJ`,
5. validar seguridad JWT, scopes, auditoria e idempotencia.

Este documento debe ejecutarse solo contra entorno local o mocks.

## 2. Alcance

Incluye:

- `POST /api/v1/cardholders/sync`
- `POST /api/v1/cardholders/lookup`
- `POST /api/v1/beneficiarios-staging`
- `GET /api/v1/beneficiarios-staging?status=pending`
- `POST /api/v1/admin/beneficiarios-staging/:id/push`
- validacion de JWT RS256, `kid`, `aud`, `scope` y `jti`
- validacion de auditoria y no exposicion de PII

No incluye:

- conexion a produccion real,
- cambios funcionales en `Sys_IPJ`,
- uso de secretos reales,
- pruebas de frontend,
- cambios al contrato acordado.

## 3. Restricciones operativas

- No conectar produccion real.
- No versionar secretos ni llaves privadas reales.
- No relajar validaciones para forzar un caso verde.
- No exponer CURP completa ni otros datos sensibles en logs.
- No usar `records` como contrato para sync con `Sys_IPJ`.

## 4. Preparacion del entorno local

### 4.1 Dependencias

- MySQL local via Docker
- API_TJ local
- mocks externos de `Sys_IPJ`, Auth0 y emisor de JWT
- coleccion y environment de Postman locales, si se desea prueba manual

### 4.2 Arranque recomendado

Base de datos:

```bash
docker compose up -d db
```

Mocks externos:

```bash
npm run mock:externals
```

API y datos locales:

```powershell
$env:DB_HOST='127.0.0.1'
$env:DB_PORT='3310'
$env:DB_USER='usuario'
$env:DB_PASSWORD='password'
$env:DB_NAME='tarjeta_joven'
$env:JWT_SECRET='supersecreto-local'
$env:CURP_HASH_SECRET='curp-secret-local-please-change'
$env:FIELD_ENCRYPTION_KEY='field-secret-local-please-change'
$env:AUTH0_DOMAIN='http://127.0.0.1:9091/auth0'
$env:AUTH0_CLIENT_ID='postman-local-client'
$env:SYS_IPJ_PUSH_URL='http://127.0.0.1:9091/sys-ipj/beneficiarios'
$env:PORT='8081'
npm run db:ensure
npm run seed
node src/index.js
```

Suite automatica:

```powershell
npm.cmd test
```

Resultado esperado:

- suite verde,
- sin tocar produccion,
- sin llaves reales,
- sin fallas de contrato en integracion.

## 5. Matriz de flujos

| Flujo | Actor | Endpoint | Auth requerida | Resultado esperado |
| --- | --- | --- | --- | --- |
| Sync de padron | `sys_ipj` | `POST /api/v1/cardholders/sync` | JWT RS256 + `cardholders.sync` | inserta o actualiza por `curp_hash` |
| Lookup | `unidad_informatica` | `POST /api/v1/cardholders/lookup` | JWT RS256 + `cardholders.lookup` | responde `registered` y `folio_tarjeta` |
| Crear staging | `unidad_informatica` | `POST /api/v1/beneficiarios-staging` | JWT RS256 + `beneficiarios.staging.create` | guarda payload cifrado con estado `pending` |
| Listado staging | admin interno | `GET /api/v1/beneficiarios-staging?status=pending` | token admin | no expone payload sensible |
| Push manual | admin interno | `POST /api/v1/admin/beneficiarios-staging/:id/push` | token admin | llama a `Sys_IPJ`, audita y cambia estado |

## 6. Casos de prueba obligatorios

### 6.1 Sync desde Sys_IPJ

Enviar:

```json
{
  "sync_id": "SYNC-LOCAL-001",
  "items": [
    {
      "curp_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "curp_masked": "AAAA************01",
      "tarjeta_numero": "TJ-LOCAL-0001",
      "status": "active"
    }
  ]
}
```

Validar:

- acepta `items`,
- no requiere `records`,
- valida por item:
  - `curp_hash` hex de 64 caracteres,
  - `curp_masked` requerido,
  - `tarjeta_numero` requerido,
  - `status` en `active`, `inactive`, `blocked`,
- responde:
  - `accepted`,
  - `status`,
  - `results`,
  - `processed`,
  - `inserted`,
  - `updated`,
  - `skipped`,
  - `conflict`,
- cada `result` incluye `index` y `action` o `reason`.

Casos minimos:

- sync valido,
- item invalido con `status: skipped`,
- conflicto por `tarjeta_numero`,
- token invalido `401`,
- scope incorrecto `403`,
- replay de `jti` `401`.

### 6.2 Lookup de Unidad de Informatica

Enviar:

```json
{
  "curp": "MELR000202MSPSRD06"
}
```

Validar:

- requiere `cardholders.lookup`,
- usa `CURP_HASH_SECRET` para resolver `curp_hash`,
- si existe responde `200` con:
  - `registered: true`
  - `folio_tarjeta`
  - `message`
- no devuelve:
  - `curp`
  - `curp_masked`
  - nombres
  - domicilio

Casos minimos:

- CURP existente `200`,
- CURP inexistente `404`,
- formato invalido `422`,
- token de `sys_ipj` `403`.

### 6.3 Creacion de staging

Enviar:

```json
{
  "external_request_id": "UI-STAGING-001",
  "beneficiario": {
    "curp": "MOCJ050521MSPNRL01",
    "nombre": "JULIETA",
    "apellido_paterno": "MORALES",
    "apellido_materno": "CANO",
    "fecha_nacimiento": "2005-05-21",
    "sexo": "M",
    "discapacidad": false,
    "id_ine": "INE-LOCAL-001",
    "telefono": "4441234567",
    "domicilio": {
      "calle": "AV REVOLUCION",
      "numero_ext": "321B",
      "numero_int": "2",
      "colonia": "ZONA CENTRO",
      "municipio_id": 1,
      "codigo_postal": "22000",
      "seccional": "0001"
    }
  }
}
```

Validar:

- requiere `beneficiarios.staging.create`,
- rechaza:
  - telefono distinto a 10 digitos,
  - sexo fuera de `M`, `F`, `X`,
  - `fecha_nacimiento` invalida,
  - `municipio_id` no entero positivo,
  - `seccional` vacio,
- cifra payload antes de persistir,
- rechaza duplicado por `external_request_id` o `curp_hash`,
- responde `202` con `created`, `status`, `staging_id`.

### 6.4 Push manual hacia Sys_IPJ

Precondiciones:

- existe staging `pending` o `error`,
- el actor es usuario admin interno,
- `SYS_IPJ_PUSH_URL` apunta a mock local.

Validar:

- descifra payload antes de enviar,
- llama `sysIpjClient.pushBeneficiario`,
- envia:
  - `Authorization: Bearer <jwt>`
  - `Idempotency-Key: <external_request_id>`
  - `Content-Type: application/json`
- body enviado:

```json
{
  "external_request_id": "UI-STAGING-001",
  "source": "api_tj",
  "submitted_by": {
    "system": "api_tj"
  },
  "beneficiario": {}
}
```

- mapea respuesta:
  - `2xx => accepted`
  - `4xx => rejected`
  - `timeout` o `5xx => error`
- registra intento en `staging_push_attempts`,
- actualiza `beneficiario_staging.status`,
- persiste `sys_ipj_response_code`,
- no duplica envio de un registro finalizado.

### 6.5 Seguridad JWT

Validar en endpoints de integracion:

- sin token => `401`
- token malformado => `401`
- `kid` no registrado => `401`
- audiencia incorrecta => `401`
- replay de `jti` => `401`
- scope faltante => `403`
- scope no permitido para el cliente => `403`
- token de integracion fuera de su superficie permitida => `403`

## 7. Evidencia minima a conservar

- salida de `npm.cmd test`
- request y response del sync valido
- request y response del lookup existente
- request y response del staging valido
- request y response del push valido contra mock
- evidencia de al menos un `401` y un `403`
- evidencia de que no aparece CURP completa en responses ni logs

## 8. Criterios de salida

Se considera `GO` para pruebas end-to-end con `Sys_IPJ` cuando:

- la suite automatica esta verde,
- `sysIpjClient` firma con `RS256` y payload compatible,
- `cardholders/sync` usa `items` y devuelve `results` por indice,
- `lookup` responde solo el minimo permitido,
- `staging` valida y cifra correctamente,
- `push` cambia estado y audita correctamente,
- seguridad JWT responde con `401` o `403` segun corresponda,
- no hay exposicion de PII en respuestas o logs.

## 9. Fuentes de referencia

Este documento fue reconstruido a partir de:

- `docs/pruebas_postman_API_TJ.md`
- `docs/updateAPI.md`
- `docs/ajustes_plan_API_TJ.md`

Si alguno de esos documentos cambia, este checklist debe revisarse para mantener el mismo contrato operativo.
