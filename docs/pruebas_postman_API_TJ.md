# Manual de pruebas Postman para API_TJ

Este documento ya no es solo una lista de casos. Ahora sirve como manual paso a paso para probar localmente el flujo nuevo de API_TJ con MySQL en Docker, JWT RS256 de integracion, staging cifrado, push a Sys_IPJ mock y activacion con Auth0 mock.

## 1. Objetivo

Validar estos endpoints y reglas:

- `POST /api/v1/cardholders/sync`
- `POST /api/v1/cardholders/lookup`
- `POST /api/v1/beneficiarios-staging`
- `GET /api/v1/beneficiarios-staging?status=pending`
- `POST /api/v1/beneficiarios-staging/:id/push`
- `POST /api/v1/cardholders/verify-activation`
- `POST /api/v1/cardholders/complete-activation`
- `POST /api/v1/cardholders/:curp/account`
- `POST /api/v1/register`

Y estas reglas:

- autenticacion sistema-a-sistema con JWT RS256
- `cardholders_sync` usa `curp_hash`
- staging guarda payload cifrado
- Auth0 se valida del lado backend
- `jti` es anti-replay, asi que cada request de integracion necesita un JWT nuevo

## 2. Recomendacion

Si vas a probar en Postman, usa la coleccion y el environment ya generados:

- Coleccion: [API_TJ_local.postman_collection.json](../scripts/fixtures/API_TJ_local.postman_collection.json)
- Environment: [API_TJ_local.postman_environment.json](../scripts/fixtures/API_TJ_local.postman_environment.json)

La coleccion ya hace esto por ti:

- pide un JWT de integracion nuevo antes de cada request
- emite un `auth0_id_token` mock nuevo cuando hace falta
- guarda `staging_id` para el push manual
- evita errores por reutilizar `jti`

## 3. Preparacion del entorno local

### 3.1 Levantar MySQL en Docker

```bash
docker compose up -d db
```

La base queda expuesta en `localhost:3310`.

### 3.2 Levantar mocks externos

```bash
npm run mock:externals
```

Esto levanta:

- mock Auth0 en `http://127.0.0.1:9091/auth0`
- mock Sys_IPJ en `http://127.0.0.1:9091/sys-ipj/beneficiarios`
- emisor local de JWT RS256 en `http://127.0.0.1:9091/integration/issue-token`

### 3.3 Preparar esquema y datos

En PowerShell:

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
```

### 3.4 Levantar la API

En la misma configuracion:

```powershell
node src/index.js
```

La API queda en `http://127.0.0.1:8081`.

### 3.5 Generar el environment de Postman

En otra terminal:

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
$env:BASE_URL='http://127.0.0.1:8081'
$env:MOCK_BASE_URL='http://127.0.0.1:9091'
npm run setup:postman-local
npm run export:postman-env
npm run build:postman-collection
```

## 4. Importar en Postman

Importa estos dos archivos:

- [API_TJ_local.postman_collection.json](../scripts/fixtures/API_TJ_local.postman_collection.json)
- [API_TJ_local.postman_environment.json](../scripts/fixtures/API_TJ_local.postman_environment.json)

Selecciona el environment `API_TJ Local`.

## 5. Variables importantes del environment

Las mas utiles para seguir las pruebas son:

- `base_url`
- `mock_base_url`
- `admin_token`
- `staging_id`
- `sync_id`
- `curp_ok`
- `curp_bad`
- `tarjeta_numero_ok`
- `tarjeta_numero_alt`
- `tarjeta_numero_bad`
- `auth0_id_token_ok`
- `auth0_id_token_bad`

No confies en `sys_ipj_token` o `informatica_token` para repetir requests manuales varias veces. Como `jti` es anti-replay, esos tokens expiran en uso practico despues de una llamada. Para repetir requests manuales, usa la coleccion o pide un token nuevo al mock.

## 6. Orden recomendado de ejecucion

Corre las carpetas o requests en este orden:

1. `00 Login Admin`
2. `01 Sync`
3. `02 Lookup`
4. `03 Staging`
5. `04 Staging Admin`
6. `05 Activacion`
7. `06 Legacy`

Ese orden ya esta pensado para que el estado de la base tenga sentido y para que `staging_id` y la ventana de activacion se usen cuando corresponde.

## 7. Casos y resultado esperado

### 7.1 Sync

#### Sync valido

- endpoint: `POST {{base_url}}/api/v1/cardholders/sync`
- auth: JWT RS256 de `sys_ipj`
- esperado:
  - status `200` o `201`
  - `processed = 1`
  - `inserted >= 1` o `updated >= 1`

#### Sync con token invalido

- esperado: `401`

#### Sync con scope incorrecto

- usar token de `unidad_informatica`
- esperado: `403`

#### Sync duplicado idempotente

- repetir el mismo payload con token nuevo
- esperado:
  - sin duplicados
  - `updated` o `skipped`

#### Sync con cambio de tarjeta

- mandar mismo `curp_hash` con otra `tarjeta_numero`
- esperado:
  - actualiza tarjeta
  - no duplica registro

### 7.2 Lookup

#### Lookup existente

- endpoint: `POST {{base_url}}/api/v1/cardholders/lookup`
- auth: JWT RS256 de `unidad_informatica`
- body:

```json
{
  "curp": "{{curp_ok}}"
}
```

- esperado:
  - status `200`
  - `registered = true`
  - incluye `folio_tarjeta`
  - no incluye `curp`
  - no incluye nombre
  - no incluye domicilio

#### Lookup inexistente

- body:

```json
{
  "curp": "{{curp_bad}}"
}
```

- esperado:
  - status `404`
  - `registered = false`

#### Lookup con formato invalido

- body:

```json
{
  "curp": "123"
}
```

- esperado: `422`

#### Lookup con token de Sys_IPJ

- esperado: `403`

### 7.3 Staging

#### Crear staging valido

- endpoint: `POST {{base_url}}/api/v1/beneficiarios-staging`
- auth: JWT RS256 de `unidad_informatica`
- body:

```json
{
  "external_request_id": "{{staging_external_request_id}}",
  "beneficiario": {
    "curp": "{{staging_curp_new}}",
    "nombre": "MELISSA",
    "apellido_paterno": "RIOS",
    "apellido_materno": "DELGADO",
    "fecha_nacimiento": "2000-02-02",
    "sexo": "M",
    "discapacidad": false,
    "id_ine": "INE0001",
    "telefono": "6641234567",
    "domicilio": {
      "calle": "CALLE 1",
      "numero_ext": "10",
      "numero_int": "2",
      "colonia": "CENTRO",
      "municipio_id": 1,
      "codigo_postal": "22000",
      "seccional": "0001"
    }
  }
}
```

- esperado:
  - status `202`
  - `created = true`
  - guarda `staging_id`

#### Crear staging duplicado por `external_request_id`

- repetir mismo body con token nuevo
- esperado: `409`

#### Crear staging para CURP ya sincronizada

- usar `{{curp_ok}}`
- esperado: `409`

#### Crear staging con faltantes en domicilio

- quitar `codigo_postal` o `seccional`
- esperado: `422`

#### Crear staging con token invalido

- esperado: `401`

### 7.4 Listado y push

#### Listado con admin interno

- endpoint: `GET {{base_url}}/api/v1/beneficiarios-staging?status=pending`
- auth: `{{admin_token}}`
- esperado:
  - status `200`
  - lista registros
  - no devuelve payload descifrado
  - no devuelve CURP en claro

#### Listado con token de integracion

- usar token de `unidad_informatica`
- esperado: `403`

#### Push valido

- endpoint: `POST {{base_url}}/api/v1/beneficiarios-staging/{{staging_id}}/push`
- auth: `{{admin_token}}`
- esperado:
  - status `200`
  - `sent = true`
  - incluye `sys_ipj_status`

#### Push duplicado

- repetir inmediatamente
- esperado:
  - status `409`
  - no duplica envio

#### Push con staging inexistente

- esperado: `404`

### 7.5 Activacion

#### Verify activation correcto

- endpoint: `POST {{base_url}}/api/v1/cardholders/verify-activation`
- esperado:
  - status `200`
  - `can_activate = true`

#### Verify activation con tarjeta incorrecta

- esperado: `403` o `422`

#### Verify activation con CURP incorrecta

- esperado: `403` o `422`

#### Verify activation para usuario ya vinculado

- esperado: `409`

#### Complete activation valido

- endpoint: `POST {{base_url}}/api/v1/cardholders/complete-activation`
- esperado:
  - status `200`
  - `activated = true`

#### Complete activation con token Auth0 invalido

- esperado: `401` o `403`

#### Complete activation para tarjeta ya vinculada

- esperado: `409`

### 7.6 Legacy

#### Cuenta local retirada

- endpoint: `POST {{base_url}}/api/v1/cardholders/MELR000202MSPSRD06/account`
- esperado: `410`

#### Register legacy retirado

- endpoint: `POST {{base_url}}/api/v1/register`
- esperado: `410`

## 8. Como pedir un JWT nuevo si haces pruebas manuales

Si no quieres usar la coleccion y vas request por request a mano, pide un token nuevo antes de cada llamada de integracion:

### Token para Sys_IPJ

`POST http://127.0.0.1:9091/integration/issue-token`

```json
{
  "client_code": "sys_ipj",
  "scopes": ["cardholders.sync"]
}
```

### Token para Unidad de Informatica

`POST http://127.0.0.1:9091/integration/issue-token`

```json
{
  "client_code": "unidad_informatica",
  "scopes": ["cardholders.lookup"]
}
```

o

```json
{
  "client_code": "unidad_informatica",
  "scopes": ["beneficiarios.staging.create"]
}
```

Usa el valor de `token` como Bearer token. No reutilices el mismo token para dos llamadas distintas.

## 9. Como pedir un Auth0 ID token mock nuevo

`POST http://127.0.0.1:9091/auth0/issue-id-token`

```json
{
  "sub": "auth0|postman-local-12345",
  "email": "postman.local.12345@example.com",
  "aud": "postman-local-client"
}
```

Usa el valor de `token` como `auth0_id_token`.

## 10. Verificaciones de no filtracion

Ademas de los status code, revisa esto:

- `lookup` no debe devolver CURP, nombre ni domicilio
- `GET /beneficiarios-staging` no debe devolver payload sensible
- ningun response debe imprimir CURP completa
- los logs del servidor no deben contener CURP completa

## 11. Validacion automatica rapida

Si quieres confirmar que el entorno local esta bien antes de abrir Postman:

```powershell
$env:CURP_HASH_SECRET='curp-secret-local-please-change'
npm run smoke:postman
```

Esperado:

```text
Smoke Postman completado correctamente.
```

## 12. Respuesta corta a la duda original

Si importas la coleccion y el environment nuevos, si puedes seguir este documento paso a paso como manual de pruebas.

Si prefieres pruebas totalmente manuales, tambien puedes seguirlo, pero recuerda dos cosas:

- para integracion necesitas un JWT nuevo en cada request
- para activacion conviene usar un `auth0_id_token` mock nuevo en cada corrida
