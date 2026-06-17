# Cambios de compatibilidad Sys_IPJ <-> API_TJ

## 1. Objetivo

Este documento resume el contrato de compatibilidad vigente entre `Sys_IPJ` y `API_TJ` para los flujos de sincronizacion, lookup, staging y push manual.

Su funcion es servir como referencia tecnica estable para backend, QA y documentacion.

## 2. Resumen ejecutivo

`API_TJ` queda compatible con `Sys_IPJ` bajo estas reglas:

- `Sys_IPJ` sigue siendo fuente de verdad de beneficiarios.
- `API_TJ` solo recibe padron minimo, resuelve lookup, guarda staging temporal cifrado y permite push manual controlado.
- La autenticacion entre sistemas usa JWT firmado `RS256`.
- El matching de CURP se hace solo mediante `curp_hash`.
- El contrato de sync usa `items`, no `records`.
- El push a `Sys_IPJ` usa `external_request_id` como clave de idempotencia.

## 3. Invariantes de compatibilidad

Estas reglas no deben romperse sin acuerdo explicito entre sistemas:

1. `cardholders_sync` se alimenta solo desde `Sys_IPJ`.
2. `CURP` no se persiste en claro fuera del payload staging cifrado.
3. `lookup` no expone nombres, domicilio ni `curp_masked`.
4. `staging` no inserta beneficiarios oficiales en `cardholders_sync`.
5. `push` no depende de `records`.
6. `Unidad de Informatica` no puede disparar push manual.
7. `Sys_IPJ` no puede crear staging.
8. Los JWT de integracion deben ser de vida corta y anti-replay por `jti`.

## 4. Contrato de entrada desde Sys_IPJ

### 4.1 Endpoint

`POST /api/v1/cardholders/sync`

### 4.2 Autorizacion

- JWT `RS256`
- `iss = sys_ipj`
- `aud = api_tj`
- scope requerido: `cardholders.sync`

### 4.3 Body aceptado

```json
{
  "sync_id": "SYNC-2026-04-21-01",
  "items": [
    {
      "curp_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "curp_masked": "ABCD**********12",
      "tarjeta_numero": "TJ-00012345",
      "status": "active"
    }
  ]
}
```

### 4.4 Reglas de compatibilidad

- `items` debe ser arreglo.
- No se espera `records`.
- Cada item valida:
  - `curp_hash` hex de 64 caracteres,
  - `curp_masked` requerido,
  - `tarjeta_numero` requerido,
  - `status` en `active`, `inactive`, `blocked`.
- La operacion es idempotente por `curp_hash`.
- Si `tarjeta_numero` cambia para el mismo `curp_hash`, se actualiza el registro.

### 4.5 Respuesta esperada

```json
{
  "accepted": 1,
  "status": "success",
  "results": [
    {
      "index": 0,
      "status": "accepted",
      "action": "inserted"
    }
  ],
  "processed": 1,
  "inserted": 1,
  "updated": 0,
  "skipped": 0,
  "conflict": 0
}
```

## 5. Contrato de lookup para Unidad de Informatica

### 5.1 Endpoint

`POST /api/v1/cardholders/lookup`

### 5.2 Autorizacion

- JWT `RS256`
- `iss = unidad_informatica`
- `aud = api_tj`
- scope requerido: `cardholders.lookup`

### 5.3 Request

```json
{
  "curp": "MELR000202MSPSRD06"
}
```

### 5.4 Reglas de compatibilidad

- `API_TJ` normaliza CURP y calcula `curp_hash` con `CURP_HASH_SECRET`.
- No persiste la CURP en claro para este flujo.
- Solo devuelve:
  - `registered`
  - `message`
  - `folio_tarjeta`

### 5.5 Respuesta si existe

```json
{
  "registered": true,
  "message": "El usuario ya se encuentra registrado con la tarjeta TJ-00012345",
  "folio_tarjeta": "TJ-00012345"
}
```

### 5.6 Respuesta si no existe

```json
{
  "registered": false,
  "message": "La CURP no se encuentra registrada en la app"
}
```

## 6. Contrato de creacion de staging

### 6.1 Endpoint

`POST /api/v1/beneficiarios-staging`

### 6.2 Autorizacion

- JWT `RS256`
- `iss = unidad_informatica`
- `aud = api_tj`
- scope requerido: `beneficiarios.staging.create`

### 6.3 Body funcional

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

### 6.4 Reglas de compatibilidad

- valida expediente completo,
- `telefono` debe tener 10 digitos,
- `sexo` debe ser `M`, `F` o `X`,
- `fecha_nacimiento` debe ser fecha valida,
- `municipio_id` debe ser entero positivo,
- `seccional` no puede ir vacio,
- calcula `curp_hash` y `curp_masked`,
- cifra payload antes de guardar,
- rechaza duplicados por `external_request_id` o `curp_hash`,
- rechaza CURP ya existente en `cardholders_sync`.

### 6.5 Respuesta esperada

```json
{
  "created": true,
  "status": "pending",
  "staging_id": 123
}
```

## 7. Contrato de salida hacia Sys_IPJ

### 7.1 Endpoint interno

Ruta preferida:

`POST /api/v1/admin/beneficiarios-staging/:id/push`

Alias interno actualmente disponible:

`POST /api/v1/beneficiarios-staging/:id/push`

El push sigue reservado a usuarios admin internos. No es un endpoint de integracion externa.

### 7.2 JWT emitido por API_TJ

El cliente saliente hacia `Sys_IPJ` usa `RS256` y estos valores por defecto:

- `iss = api_tj`
- `sub = api_tj`
- `aud = sys_ipj`
- `scope = beneficiarios.staging.push`
- `kid = api_tj-current`
- `jti` unico por request

### 7.3 Headers salientes

- `Authorization: Bearer <jwt>`
- `Idempotency-Key: <external_request_id>`
- `Content-Type: application/json`

### 7.4 Body saliente

```json
{
  "external_request_id": "UI-STAGING-001",
  "source": "api_tj",
  "submitted_by": {
    "system": "api_tj"
  },
  "beneficiario": {
    "curp": "MOCJ050521MSPNRL01"
  }
}
```

### 7.5 Reglas de compatibilidad

- `external_request_id` es la llave de idempotencia del envio.
- `API_TJ` descifra el payload antes de enviar.
- El contrato no depende de `records`.
- La traduccion de resultado debe ser:
  - `2xx => accepted`
  - `4xx => rejected`
  - `timeout` o `5xx => error`
- Cada intento se registra en `staging_push_attempts`.
- El staging actualiza su `status`, `sent_at`, `resolved_at`, `sys_ipj_response_code` y `error_message`.

## 8. Reglas de seguridad compartidas

### 8.1 JWT de integracion

Todos los JWT de integracion deben incluir:

- `iss`
- `sub`
- `aud`
- `exp`
- `iat`
- `jti`
- `scope`
- `kid` en header

### 8.2 Respuestas esperadas de seguridad

- `401`:
  - sin token,
  - token malformado,
  - `kid` no registrado,
  - audiencia incorrecta,
  - replay de `jti`
- `403`:
  - scope faltante,
  - scope no permitido,
  - token valido fuera de su superficie permitida

### 8.3 PII y logs

- no registrar CURP completa,
- no devolver domicilio o nombres en lookup,
- solo permitir `curp_hash` o `curp_masked` en trazas operativas,
- mantener payload completo solo cifrado en staging.

## 9. Variables de entorno relevantes

Estas variables deben estar documentadas en `.env.example` y en el runbook operativo:

- `SYS_IPJ_PUSH_URL`
- `API_TJ_TO_SYS_IPJ_SCOPE=beneficiarios.staging.push`
- `API_TJ_TO_SYS_IPJ_AUDIENCE=sys_ipj`
- `API_TJ_TO_SYS_IPJ_ISSUER=api_tj`
- `API_TJ_TO_SYS_IPJ_SUBJECT=api_tj`
- `API_TJ_TO_SYS_IPJ_JWT_KID=api_tj-current`
- `API_TJ_TO_SYS_IPJ_PRIVATE_KEY_PATH`
- `SYS_IPJ_JWT_PUBLIC_KEY`
- `INFORMATICA_JWT_PUBLIC_KEY`
- `CURP_HASH_SECRET`

`CURP_HASH_SECRET` debe considerarse secreto compartido entre backends para producir el mismo `curp_hash`.

## 10. Cambios de compatibilidad confirmados

Los cambios relevantes respecto a flujos previos quedan asi:

1. `lookup` deja de depender de CURP persistida en claro y usa solo `curp_hash`.
2. `sync` usa `items` como contrato oficial.
3. `staging` se guarda cifrado y no como alta oficial.
4. `push` a `Sys_IPJ` usa JWT `RS256` saliente emitido por `API_TJ`.
5. el endpoint legacy `POST /api/v1/cardholders/:curp/account` queda fuera del flujo nuevo y responde `410`.
6. `POST /api/v1/register` queda fuera del flujo nuevo y responde `410`.

## 11. Impacto para equipos consumidores

### Sys_IPJ

Debe:

- seguir enviando `items` en sync,
- firmar con `RS256`,
- respetar `cardholders.sync`,
- aceptar push con `Authorization`, `Idempotency-Key` y body acordado.

No debe:

- invocar lookup,
- crear staging,
- asumir que `API_TJ` almacena padrón completo oficial.

### Unidad de Informatica

Debe:

- usar solo `cardholders.lookup` y `beneficiarios.staging.create`,
- tratar `404` de lookup como habilitador de staging,
- no esperar push directo por token de integracion.

No debe:

- consumir datos extra en lookup,
- disparar rutas admin,
- reutilizar el mismo JWT varias veces.

## 12. Referencias

Este documento fue reconstruido desde:

- `docs/pruebas_postman_API_TJ.md`
- `docs/updateAPI.md`
- `docs/ajustes_plan_API_TJ.md`

Debe mantenerse alineado con pruebas automatizadas y con el contrato real implementado en `API_TJ`.
