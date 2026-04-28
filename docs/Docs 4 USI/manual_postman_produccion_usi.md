# Manual de entrega para Postman en produccion

Documento preparado el 24 de abril de 2026 antes de las 14:30 hrs.

## Objetivo

Este manual deja lista la operacion de prueba para la Unidad de Informatica contra:

```text
https://apitj-production.up.railway.app/api/v1
```

Solo cubre los endpoints permitidos para `unidad_informatica`:

- `POST /cardholders/lookup`
- `POST /beneficiarios-staging`

## 1. Requisitos previos

Antes de abrir Postman, se necesita:

- llave privada RSA del cliente `unidad_informatica`
- llave publica ya cargada en Railway
- `kid` activo y consistente entre token y backend
- `aud = api_tj`
- token RS256 vigente

## 2. Archivos a importar en Postman

- `API_TJ_USI_production.postman_collection.json`
- `API_TJ_USI_production.postman_environment.json`

## 3. Variable principal

La variable clave del environment es:

```text
integrationToken
```

Ahí debe pegarse el JWT RS256 vigente.

## 4. Que ya esta preconfigurado

La coleccion ya trae:

- 4 lookups validados con CURP reales de prueba
- 1 lookup inexistente controlado
- 1 lookup invalido
- 1 staging valido con CURP sintetica generada al vuelo
- 1 staging duplicado
- 1 staging invalido

## 5. Orden recomendado de ejecucion

### Paso 1. Ejecutar lookups validados

Ejecuta estas requests:

1. `Lookup FEFA090821MSPLLNA5`
2. `Lookup HEES090305MSPRLLA0`
3. `Lookup BAHC090421MSPTRNA4`
4. `Lookup HEHI090906MNLRRSA2`

Resultado esperado: `200` en los cuatro casos.

### Paso 2. Ejecutar lookup inexistente

Ejecuta:

- `Lookup inexistente controlado`

Resultado esperado: `404`

### Paso 3. Ejecutar lookup invalido

Ejecuta:

- `Lookup invalido`

Resultado esperado: `422`

### Paso 4. Ejecutar staging valido

Genera antes un token nuevo con scope:

```text
beneficiarios.staging.create
```

Pégalo en `integrationToken` y ejecuta:

- `Crear staging valido`

Resultado esperado:

- `202`
- `created = true`
- `stagingId` guardado en el environment

### Paso 5. Ejecutar staging duplicado

Sin cambiar `externalRequestId` ni `stagingCurpGenerated`, ejecuta:

- `Crear staging duplicado`

Resultado esperado:

- `409`

### Paso 6. Ejecutar staging invalido

Ejecuta:

- `Crear staging invalido`

Resultado esperado:

- `422`

## 6. Reglas del token

Para `lookup`, el token debe tener:

```text
scope = cardholders.lookup
```

Para `staging`, el token debe tener:

```text
scope = beneficiarios.staging.create
```

Recomendacion:

- usa un token nuevo por request o por bloque corto de pruebas
- no reutilices `jti`

## 7. Respuestas esperadas

### Lookup exitoso

```json
{
  "registered": true,
  "message": "El usuario ya se encuentra registrado con la tarjeta 4454",
  "folio_tarjeta": "4454"
}
```

### Lookup inexistente

```json
{
  "registered": false,
  "message": "La CURP no se encuentra registrada en la app"
}
```

### Staging exitoso

```json
{
  "created": true,
  "status": "pending",
  "staging_id": 123
}
```

## 8. Errores comunes

### `401`

Revisar:

- firma RS256
- `kid`
- `iss = unidad_informatica`
- `sub = unidad_informatica`
- `aud = api_tj`
- expiracion
- `jti` unico

### `403`

Revisar:

- scope del token

### `409`

En staging significa:

- CURP ya sincronizada, o
- staging previo para esa solicitud, o
- staging previo para esa CURP

### `422`

Revisar:

- `curp`
- `external_request_id`
- `beneficiario.discapacidad` como boolean
- `domicilio.municipio_id`

## 9. Lo que no debe usar USI

No forman parte de esta integracion:

- `GET /beneficiarios-staging`
- `POST /beneficiarios-staging/:id/push`
- `DELETE /beneficiarios-staging/expired`
- `POST /register`

## 10. Referencias internas del paquete

- `paso_a_paso_railway_windows_postman.md`
- `validacion_produccion_2026-04-24.md`
