# Guia de pruebas API con Postman

Esta guia cubre los flujos principales despues de la actualizacion: autenticacion interna, padron sincronizado, lookup por integracion, staging cifrado, push manual y activacion con Auth0.

## Archivos listos para importar

- Coleccion: [API_TJ_local.postman_collection.json](scripts/fixtures/API_TJ_local.postman_collection.json)
- Environment: [API_TJ_local.postman_environment.json](scripts/fixtures/API_TJ_local.postman_environment.json)

Para regenerarlos en local:

```bash
npm run setup:postman-local
npm run export:postman-env
npm run build:postman-collection
```

Si vas a usar la coleccion con JWT RS256 dinamico y Auth0 mock, levanta tambien:

```bash
npm run mock:externals
```

La coleccion usa `mock_base_url` para pedir un JWT nuevo por request de integracion, porque `jti` es anti-replay y no debe reutilizarse.

## 1. Entorno recomendado

| Variable | Valor inicial | Descripcion |
|----------|---------------|-------------|
| `baseUrl` | `http://localhost:8080/api/v1` | URL base del API. |
| `token` | vacio | JWT local obtenido por login. |
| `integrationToken` | vacio | JWT RS256 firmado por `sys_ipj` o `unidad_informatica`. |
| `auth0IdToken` | vacio | ID token real emitido por Auth0 para completar activacion. |
| `stagingId` | vacio | ID devuelto al crear staging. |

## 2. Login interno

### POST `{{baseUrl}}/auth/login`

```json
{
  "username": "ana.hernandez@example.com",
  "password": "Test1234!"
}
```

Test sugerido:

```javascript
pm.test("Login 200", () => pm.response.to.have.status(200));
const data = pm.response.json();
pm.environment.set("token", data.accessToken);
```

El login interno acepta email y password. El login por CURP y el OTP por CURP quedaron retirados de los flujos activos.

## 3. JWT RS256 de integracion

Los endpoints de integracion requieren:

- Header `Authorization: Bearer {{integrationToken}}`
- Algoritmo `RS256`
- Header JWT con `kid`
- Claims `iss`, `sub`, `aud`, `iat`, `exp`, `jti`, `scope`

Reglas:

- `iss` debe ser `sys_ipj` o `unidad_informatica`.
- `aud` debe coincidir con `INTEGRATION_JWT_AUDIENCE` (`api_tj` por default).
- `kid` debe existir en `service_client_keys`.
- `jti` no se puede reutilizar.
- Las llamadas autorizadas quedan auditadas sin request body ni CURP completa.
- El rate limit se aplica por cliente integrador y ruta.

Scopes:

| Cliente | Scopes |
|---------|--------|
| `sys_ipj` | `cardholders.sync` |
| `unidad_informatica` | `cardholders.lookup`, `beneficiarios.staging.create` |

## 4. Sync de padron minimo

### POST `{{baseUrl}}/cardholders/sync`

Requiere cliente `sys_ipj` con scope `cardholders.sync`.

```json
{
  "sync_id": "SYNC-2026-04-22-01",
  "items": [
    {
      "curp_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "curp_masked": "MELR************06",
      "tarjeta_numero": "TJ-0080",
      "status": "active"
    }
  ]
}
```

Respuesta:

```json
{
  "processed": 1,
  "inserted": 1,
  "updated": 0,
  "skipped": 0,
  "conflict": 0
}
```

## 5. Lookup por CURP

### POST `{{baseUrl}}/cardholders/lookup`

Requiere cliente `unidad_informatica` con scope `cardholders.lookup`.

```json
{
  "curp": "MELR000202MSPSRD06"
}
```

Respuesta si existe:

```json
{
  "registered": true,
  "message": "El usuario ya se encuentra registrado con la tarjeta TJ-0080",
  "folio_tarjeta": "TJ-0080"
}
```

Respuesta si no existe:

```json
{
  "registered": false,
  "message": "La CURP no se encuentra registrada en la app"
}
```

El lookup no devuelve nombres, domicilio, CURP completo ni `curp_masked`.

## 6. Crear staging de beneficiario

### POST `{{baseUrl}}/beneficiarios-staging`

Requiere cliente `unidad_informatica` con scope `beneficiarios.staging.create`.

```json
{
  "external_request_id": "UI-2026-04-22-0001",
  "nombre": "Julieta",
  "apellido_paterno": "Morales",
  "apellido_materno": "Cano",
  "curp": "MOCJ050521MSPNRL01",
  "fecha_nacimiento": "2005-05-21",
  "sexo": "M",
  "discapacidad": false,
  "id_ine": "INE123",
  "telefono": "4441234567",
  "domicilio": {
    "calle": "Av. Revolucion",
    "numero_ext": "321B",
    "numero_int": null,
    "colonia": "Zona Centro",
    "municipio": "San Luis Potosi",
    "codigo_postal": "22000",
    "seccional": "001"
  }
}
```

Respuesta:

```json
{
  "created": true,
  "status": "pending",
  "staging_id": 123
}
```

Test sugerido:

```javascript
pm.test("Staging creado", () => pm.response.to.have.status(201));
pm.environment.set("stagingId", pm.response.json().staging_id);
```

## 7. Listado interno de staging

### GET `{{baseUrl}}/beneficiarios-staging?status=pending`

Requiere `Authorization: Bearer {{token}}` de usuario local con rol `admin`.

Respuesta:

```json
{
  "items": [
    {
      "id": 123,
      "external_request_id": "UI-2026-04-22-0001",
      "curp_masked": "MOCJ************01",
      "status": "pending",
      "submitted_at": "2026-04-22T12:00:00.000Z",
      "sent_at": null,
      "resolved_at": null,
      "error_message": null
    }
  ]
}
```

No devuelve payload descifrado.

## 8. Push manual a Sys_IPJ

### POST `{{baseUrl}}/beneficiarios-staging/{{stagingId}}/push`

Requiere `Authorization: Bearer {{token}}` de usuario local con rol `admin`.

Comportamiento:

- Hace lock transaccional del staging.
- Descifra payload.
- Envia `external_request_id` como `Idempotency-Key` y dentro del body hacia `SYS_IPJ_PUSH_URL`.
- Audita intento y resultado.

Respuesta exitosa:

```json
{
  "sent": true,
  "message": "Beneficiario enviado a Sys_IPJ",
  "sys_ipj_status": 201
}
```

### DELETE `{{baseUrl}}/beneficiarios-staging/expired?dryRun=true`

Requiere `Authorization: Bearer {{token}}` de usuario local con rol `admin`.

Elimina solo registros `pending` o `error` que ya vencieron por TTL, no estan bloqueados y no estan en proceso. Usa `dryRun=true` para revisar cuantos coinciden sin borrar.

Respuesta:

```json
{
  "dryRun": true,
  "ttlDays": 30,
  "cutoff": "2026-03-23T12:00:00.000Z",
  "deleted": 0,
  "matched": 2
}
```

## 9. Activacion con Auth0

### POST `{{baseUrl}}/cardholders/verify-activation`

```json
{
  "tarjeta_numero": "TJ-0080",
  "curp": "MELR000202MSPSRD06"
}
```

Respuesta:

```json
{
  "can_activate": true,
  "message": "Validacion correcta"
}
```

Esta llamada abre una ventana corta de activacion en `cardholders_sync`; `complete-activation` la exige antes de vincular Auth0.

### POST `{{baseUrl}}/cardholders/complete-activation`

```json
{
  "tarjeta_numero": "TJ-0080",
  "auth0_id_token": "{{auth0IdToken}}"
}
```

El backend valida JWKS, firma, issuer, audience `AUTH0_CLIENT_ID` y `sub`. El `auth0_user_id` se deriva del `sub`; no se acepta desde el frontend.

Respuesta:

```json
{
  "activated": true,
  "message": "Cuenta vinculada correctamente"
}
```

## 10. Endpoint legacy retirado

### POST `{{baseUrl}}/cardholders/MELR000202MSPSRD06/account`

Respuesta:

```json
{
  "message": "El alta local con contrasena fue retirada. Usa el flujo de activacion con Auth0."
}
```

Status esperado: `410 Gone`.

### POST `{{baseUrl}}/register`

El registro local legacy tambien responde `410 Gone`; los expedientes nuevos deben crearse en `/beneficiarios-staging`.

## 11. Perfil

### GET `{{baseUrl}}/me`

Requiere JWT local. Funciona para usuarios Auth0 vinculados porque no depende de CURP ni de password local.

```json
{
  "id": 1,
  "nombre": "Ana",
  "apellidos": "Hernandez Ruiz",
  "edad": null,
  "creditos": 0,
  "barcodeValue": "TJ1-<token>-202604",
  "email": "ana.hernandez@example.com",
  "municipio": "San Luis Potosi",
  "telefono": "***4567",
  "fotoUrl": null,
  "portadaUrl": null,
  "auth0UserId": null,
  "cardholderSyncId": 1,
  "tarjetaNumero": "TJ-0001"
}
```
