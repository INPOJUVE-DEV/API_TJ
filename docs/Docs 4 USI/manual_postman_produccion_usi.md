# Manual rapido de pruebas en Postman para USI

## 1. Se puede probar en produccion

Si. Puedes hacer pruebas como si fueras la Unidad de Informatica desde Postman contra:

```text
https://apitj-production.up.railway.app/api/v1
```

Siempre que uses un JWT RS256 real del cliente `unidad_informatica`.

## 2. Que necesitas antes de probar

- La llave privada de `unidad_informatica` para firmar el JWT fuera de Postman.
- Confirmacion de que Railway tiene registrada la llave publica correcta.
- Un `kid` activo que coincida con la llave.
- Scope `cardholders.lookup` para lookup.
- Scope `beneficiarios.staging.create` para staging.

## 2.1 Si estas en Windows y no tienes OpenSSL

Puedes generar las llaves con Node.js desde este repo:

```powershell
cd "C:\Users\Participacion IPJ\Documents\GitHub\API_TJ"
npm run keygen:integration -- unidad_informatica generated-keys unidad_informatica-current
```

Eso te crea:

- `generated-keys/unidad_informatica_private.pem`
- `generated-keys/unidad_informatica_public.pem`
- `generated-keys/unidad_informatica_railway.env.txt`

Luego puedes construir un JWT para lookup con:

```powershell
npm run token:integration -- generated-keys/unidad_informatica_private.pem unidad_informatica unidad_informatica-current cardholders.lookup api_tj 5m
```

Y para staging con:

```powershell
npm run token:integration -- generated-keys/unidad_informatica_private.pem unidad_informatica unidad_informatica-current beneficiarios.staging.create api_tj 5m
```

Pega el JWT resultante en la variable `integrationToken` de Postman.

## 3. Archivos a importar

- Coleccion: `API_TJ_USI_production.postman_collection.json`
- Environment: `API_TJ_USI_production.postman_environment.json`

## 4. Variables del environment

| Variable | Uso |
|----------|-----|
| `baseUrl` | URL base de produccion con `/api/v1` |
| `integrationToken` | JWT RS256 valido |
| `curpLookup` | CURP a consultar |
| `externalRequestId` | Folio unico de solicitud staging |
| `stagingCurp` | CURP para prueba de alta temporal |

## 5. Flujo recomendado

### Paso 1. Pegar token

Genera un token valido y pegalo en:

```text
integrationToken
```

No reutilices el mismo token muchas veces si cambia el `jti` por request.

### Paso 2. Probar lookup

Ejecuta:

- `01 Lookup / Lookup existente`
- o `01 Lookup / Lookup inexistente`

Resultados esperados:

- `200` si la CURP ya esta registrada
- `404` si la CURP no existe
- `401` si el token no es valido
- `403` si el scope no es correcto

### Paso 3. Probar staging

Solo si el lookup regreso `404`, ejecuta:

- `02 Staging / Crear staging valido`

Resultado esperado:

- `202` con `created = true`

## 6. Errores comunes

### `401 Token de integracion invalido`

Revisa:

- `kid`
- `iss = unidad_informatica`
- `sub = unidad_informatica`
- `aud = api_tj`
- firma RS256
- `exp` no vencido
- `jti` no reutilizado

### `403 Permisos insuficientes`

Revisa el `scope`:

- `cardholders.lookup`
- `beneficiarios.staging.create`

### `409`

En staging significa que:

- la CURP ya existe en padron sincronizado, o
- ya existe un staging con ese `external_request_id`, o
- ya existe un staging para esa CURP

### `422`

Revisa campos obligatorios, especialmente:

- `curp`
- `external_request_id`
- `beneficiario.discapacidad` como boolean real
- `domicilio.municipio_id` entero positivo

## 7. Recomendaciones operativas

- Usa un `externalRequestId` nuevo en cada intento.
- No uses datos reales sin autorizacion operativa.
- Si vas a repetir pruebas, genera un token nuevo.
- Guarda evidencia con capturas o export del response en cada prueba.

## 8. Endpoints que no debe usar USI

No forman parte de esta integracion:

- `GET /beneficiarios-staging`
- `POST /beneficiarios-staging/:id/push`
- `DELETE /beneficiarios-staging/expired`
- `POST /register`

Esos endpoints quedan fuera del alcance de USI.
