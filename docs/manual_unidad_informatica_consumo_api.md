# Manual de consumo API_TJ para Unidad de Informatica

## Objetivo

Este manual explica paso a paso como consumir los endpoints habilitados para la Unidad de Informatica y como conectarse desde una API propia de forma segura.

Aplica para estos endpoints:

- `POST /api/v1/cardholders/lookup`
- `POST /api/v1/beneficiarios-staging`

## Aclaracion importante

El endpoint legacy `POST /api/v1/register` ya no forma parte del flujo vigente y responde `410 Gone`.

Si el lookup no encuentra la CURP, el alta correcta ya no se hace en `/register`; ahora se hace en:

- `POST /api/v1/beneficiarios-staging`

## Flujo funcional recomendado

1. La API de la Unidad de Informatica genera un JWT RS256.
2. La API de la Unidad de Informatica consulta `POST /api/v1/cardholders/lookup`.
3. Si API_TJ responde `200`, el ciudadano ya existe y se devuelve su `folio_tarjeta`.
4. Si API_TJ responde `404`, la API de la Unidad de Informatica envia el expediente completo a `POST /api/v1/beneficiarios-staging`.
5. API_TJ guarda el expediente de forma temporal y cifrada con estado `pending`.
6. Un usuario interno administrador de API_TJ revisa y empuja el staging hacia Sys_IPJ.

## 1. Prerrequisitos

Antes de consumir los endpoints, se necesita lo siguiente:

- URL base del API, por ejemplo: `https://tu-dominio/api/v1`
- Conexion servidor a servidor por HTTPS
- Un par de llaves RSA para firmar tokens RS256
- La llave publica registrada en API_TJ para el cliente `unidad_informatica`
- Un `kid` activo registrado en API_TJ
- Alcances autorizados para el cliente:
  - `cardholders.lookup`
  - `beneficiarios.staging.create`

## 2. Como habilitar la conexion desde su propia API

La integracion no debe salir desde frontend ni desde aplicaciones moviles. La llave privada debe vivir unicamente en el backend de la API emisora.

### Paso 1. Generar un par de llaves RSA

La Unidad de Informatica debe generar:

- una llave privada para firmar tokens
- una llave publica para entregarla al equipo de API_TJ

Ejemplo con OpenSSL:

```bash
openssl genrsa -out unidad_informatica_private.pem 2048
openssl rsa -in unidad_informatica_private.pem -pubout -out unidad_informatica_public.pem
```

### Paso 2. Registrar la llave publica en API_TJ

API_TJ valida los JWT contra las tablas:

- `service_clients`
- `service_client_keys`

El cliente esperado para esta integracion es:

- `client_code = unidad_informatica`

Los scopes permitidos para ese cliente son:

- `cardholders.lookup`
- `beneficiarios.staging.create`

El `kid` del token debe existir en `service_client_keys` y estar activo.

### Paso 3. Configurar bootstrap automatico por variables de entorno

En este proyecto ya no es necesario insertar manualmente en SQL para produccion si defines estas variables en API_TJ:

```env
INFORMATICA_JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----...
INFORMATICA_JWT_KID=unidad_informatica-current
INFORMATICA_ALLOWED_SCOPES=["cardholders.lookup","beneficiarios.staging.create"]
INFORMATICA_IP_ALLOWLIST=[]
```

Cuando la API inicia, hace bootstrap automatico y crea o actualiza:

- `service_clients.client_code = 'unidad_informatica'`
- `service_clients.allowed_scopes = ["cardholders.lookup","beneficiarios.staging.create"]`
- `service_clients.key_id_current = INFORMATICA_JWT_KID`
- `service_client_keys.kid = INFORMATICA_JWT_KID`
- `service_client_keys.public_key = INFORMATICA_JWT_PUBLIC_KEY`

Si usas Railway, puedes pegar la llave en formato PEM normal o con saltos escapados como `\n`.

### Paso 4. Guardar la llave privada solo en su API

La llave privada:

- no debe enviarse a API_TJ
- no debe guardarse en frontend
- no debe compartirse con otros sistemas

## 3. Configuracion minima en Railway para API_TJ

En Railway, dentro del servicio de API_TJ, define como minimo:

```env
INTEGRATION_JWT_AUDIENCE=api_tj
INFORMATICA_JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----
INFORMATICA_JWT_KID=unidad_informatica-current
INFORMATICA_ALLOWED_SCOPES=["cardholders.lookup","beneficiarios.staging.create"]
INFORMATICA_IP_ALLOWLIST=[]
```

Despues:

1. Guarda las variables.
2. Redeploy del servicio.
3. Espera a que el arranque termine.
4. Verifica en la base que exista `unidad_informatica` en `service_clients`.
5. Prueba `POST /api/v1/cardholders/lookup` con un JWT firmado por la llave privada correspondiente.

## 4. Contrato del JWT de integracion

Cada llamada de integracion debe enviar:

```http
Authorization: Bearer <token_rs256>
Content-Type: application/json
```

### Header JWT obligatorio

```json
{
  "alg": "RS256",
  "typ": "JWT",
  "kid": "unidad_informatica-current"
}
```

### Claims obligatorios

```json
{
  "iss": "unidad_informatica",
  "sub": "unidad_informatica",
  "aud": "api_tj",
  "scope": "cardholders.lookup",
  "jti": "uuid-unico-por-request",
  "iat": 1713960000,
  "exp": 1713960300
}
```

### Reglas importantes

- `iss` debe coincidir con `service_clients.client_code`
- `aud` debe coincidir con `INTEGRATION_JWT_AUDIENCE`, por default `api_tj`
- `kid` debe existir y estar activo
- `jti` no se puede reutilizar
- se recomienda generar un token nuevo por cada request
- la expiracion debe ser corta, por ejemplo 1 a 5 minutos
- si el token no es valido, el API responde `401`
- si el token es valido pero no tiene permiso, el API responde `403`

## 5. Paso a paso para consumir lookup

Endpoint:

```text
POST /api/v1/cardholders/lookup
```

Scope requerido:

```text
cardholders.lookup
```

Body:

```json
{
  "curp": "MELR000202MSPSRD06"
}
```

### Respuesta si la CURP existe

HTTP `200`

```json
{
  "registered": true,
  "message": "El usuario ya se encuentra registrado con la tarjeta TJ-0080",
  "folio_tarjeta": "TJ-0080"
}
```

### Respuesta si la CURP no existe

HTTP `404`

```json
{
  "registered": false,
  "message": "La CURP no se encuentra registrada en la app"
}
```

### Errores frecuentes

- `401`: token invalido, expirado, sin `kid` o con `jti` repetido
- `403`: cliente sin scope `cardholders.lookup`
- `422`: falta `curp` o llega vacia
- `500`: error interno del servicio

### Ejemplo cURL

```bash
curl -X POST "https://tu-dominio/api/v1/cardholders/lookup" \
  -H "Authorization: Bearer TU_TOKEN_RS256" \
  -H "Content-Type: application/json" \
  -d "{\"curp\":\"MELR000202MSPSRD06\"}"
```

## 6. Paso a paso para registrar un expediente temporal

Este endpoint debe usarse solo cuando el lookup regreso `404`.

Endpoint:

```text
POST /api/v1/beneficiarios-staging
```

Scope requerido:

```text
beneficiarios.staging.create
```

Body recomendado:

```json
{
  "external_request_id": "UI-2026-04-24-0001",
  "beneficiario": {
    "curp": "MOCJ050521MSPNRL01",
    "nombre": "JULIETA",
    "apellido_paterno": "MORALES",
    "apellido_materno": "CANO",
    "fecha_nacimiento": "2005-05-21",
    "sexo": "M",
    "discapacidad": false,
    "id_ine": "INE123456",
    "telefono": "4441234567",
    "domicilio": {
      "calle": "AV REVOLUCION",
      "numero_ext": "321B",
      "numero_int": null,
      "colonia": "ZONA CENTRO",
      "municipio_id": 1,
      "codigo_postal": "22000",
      "seccional": "001"
    }
  }
}
```

### Campos obligatorios

- `external_request_id`
- `beneficiario.curp`
- `beneficiario.nombre`
- `beneficiario.apellido_paterno`
- `beneficiario.apellido_materno`
- `beneficiario.fecha_nacimiento`
- `beneficiario.sexo`
- `beneficiario.discapacidad`
- `beneficiario.id_ine`
- `beneficiario.telefono`
- `beneficiario.domicilio.calle`
- `beneficiario.domicilio.numero_ext`
- `beneficiario.domicilio.colonia`
- `beneficiario.domicilio.municipio_id`
- `beneficiario.domicilio.codigo_postal`
- `beneficiario.domicilio.seccional`

Campo opcional:

- `beneficiario.domicilio.numero_int`

Nota:

- `beneficiario.discapacidad` es obligatorio y debe enviarse como boolean JSON real: `true` o `false`

### Respuesta esperada

HTTP `202`

```json
{
  "created": true,
  "status": "pending",
  "staging_id": 123
}
```

### Errores frecuentes

- `401`: token invalido
- `403`: cliente sin scope `beneficiarios.staging.create`
- `409`: la CURP ya existe en el padron sincronizado o ya existe un staging previo
- `422`: falta un campo obligatorio, `municipio_id` no es entero positivo o `discapacidad` no llega como boolean
- `500`: error interno

### Ejemplo cURL

```bash
curl -X POST "https://tu-dominio/api/v1/beneficiarios-staging" \
  -H "Authorization: Bearer TU_TOKEN_RS256" \
  -H "Content-Type: application/json" \
  -d "{\"external_request_id\":\"UI-2026-04-24-0001\",\"beneficiario\":{\"curp\":\"MOCJ050521MSPNRL01\",\"nombre\":\"JULIETA\",\"apellido_paterno\":\"MORALES\",\"apellido_materno\":\"CANO\",\"fecha_nacimiento\":\"2005-05-21\",\"sexo\":\"M\",\"discapacidad\":false,\"id_ine\":\"INE123456\",\"telefono\":\"4441234567\",\"domicilio\":{\"calle\":\"AV REVOLUCION\",\"numero_ext\":\"321B\",\"numero_int\":null,\"colonia\":\"ZONA CENTRO\",\"municipio_id\":1,\"codigo_postal\":\"22000\",\"seccional\":\"001\"}}}"
```

## 7. Que pasa despues del staging

La Unidad de Informatica solo crea el expediente temporal. Los siguientes pasos no se exponen por integracion externa:

- listar staging
- hacer push a Sys_IPJ
- limpiar registros expirados

Esas acciones requieren un usuario interno autenticado en API_TJ con rol `admin`.

## 8. Ejemplo de integracion desde su propia API en Node.js

Este ejemplo firma el JWT en backend y consume ambos endpoints.

Instalacion:

```bash
npm install jsonwebtoken
```

Ejemplo:

```js
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const API_TJ_BASE_URL = process.env.API_TJ_BASE_URL;
const API_TJ_AUDIENCE = process.env.API_TJ_AUDIENCE || 'api_tj';
const API_TJ_CLIENT_CODE = 'unidad_informatica';
const API_TJ_KID = process.env.API_TJ_KID || 'unidad_informatica-current';
const PRIVATE_KEY = fs.readFileSync(process.env.API_TJ_PRIVATE_KEY_PATH, 'utf8');

function buildIntegrationToken(scope) {
  return jwt.sign(
    {
      iss: API_TJ_CLIENT_CODE,
      sub: API_TJ_CLIENT_CODE,
      aud: API_TJ_AUDIENCE,
      scope,
      jti: crypto.randomUUID()
    },
    PRIVATE_KEY,
    {
      algorithm: 'RS256',
      expiresIn: '2m',
      header: { kid: API_TJ_KID }
    }
  );
}

async function lookupCurp(curp) {
  const token = buildIntegrationToken('cardholders.lookup');
  const response = await fetch(`${API_TJ_BASE_URL}/cardholders/lookup`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ curp })
  });

  const data = await response.json();
  return { status: response.status, data };
}

async function createStaging(expediente) {
  const token = buildIntegrationToken('beneficiarios.staging.create');
  const response = await fetch(`${API_TJ_BASE_URL}/beneficiarios-staging`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(expediente)
  });

  const data = await response.json();
  return { status: response.status, data };
}

async function validarYRegistrar(curp, expedienteCompleto) {
  const lookup = await lookupCurp(curp);

  if (lookup.status === 200) {
    return {
      paso: 'lookup',
      resultado: 'ya_registrado',
      detalle: lookup.data
    };
  }

  if (lookup.status === 404) {
    const staging = await createStaging(expedienteCompleto);
    return {
      paso: 'staging',
      resultado: staging.status === 202 ? 'enviado_a_staging' : 'error',
      detalle: staging.data
    };
  }

  return {
    paso: 'lookup',
    resultado: 'error',
    detalle: lookup.data
  };
}
```

## 9. Recomendaciones operativas

- generar un JWT nuevo por cada request
- no reutilizar el mismo `jti`
- guardar la llave privada en variables seguras o en un secret manager
- registrar logs internos con `external_request_id`
- manejar `404` en lookup como un flujo esperado, no como fallo tecnico
- reenviar a staging solo cuando el lookup haya confirmado que no existe registro

## 10. Pruebas manuales desde Postman

Esta seccion sirve para probar manualmente los endpoints sin integrar todavia una API consumidora completa.

### Paso 1. Crear un environment

Crea un environment en Postman con estas variables:

| Variable | Valor sugerido |
|----------|----------------|
| `baseUrl` | `https://tu-dominio/api/v1` |
| `integrationToken` | vacio |
| `curp` | `MELR000202MSPSRD06` |
| `externalRequestId` | `UI-TEST-0001` |

Si vas a probar produccion de Railway:

```text
baseUrl = https://apitj-production.up.railway.app/api/v1
```

### Paso 2. Obtener un JWT valido

Para que Postman pueda consumir estos endpoints, primero necesitas un token RS256 valido firmado con la llave privada de `unidad_informatica`.

Opciones recomendadas:

1. Generarlo desde tu propia API consumidora.
2. Generarlo con un script Node local.
3. Pedir un token temporal al equipo que administra la llave privada.

Luego pega el token en la variable:

```text
integrationToken
```

Importante:

- usa un token nuevo si el anterior expira
- no reutilices el mismo token demasiadas veces si tu flujo usa `jti` unico por request
- el `kid` del token debe coincidir con `INFORMATICA_JWT_KID`

### Paso 3. Crear el request de lookup

En Postman crea una request:

- Metodo: `POST`
- URL: `{{baseUrl}}/cardholders/lookup`
- Headers:
  - `Authorization: Bearer {{integrationToken}}`
  - `Content-Type: application/json`
- Body `raw` tipo `JSON`:

```json
{
  "curp": "{{curp}}"
}
```

### Paso 4. Interpretar la respuesta de lookup

Si la CURP existe:

- HTTP `200`
- respuesta esperada:

```json
{
  "registered": true,
  "message": "El usuario ya se encuentra registrado con la tarjeta TJ-0080",
  "folio_tarjeta": "TJ-0080"
}
```

Si la CURP no existe:

- HTTP `404`
- respuesta esperada:

```json
{
  "registered": false,
  "message": "La CURP no se encuentra registrada en la app"
}
```

Si recibes:

- `401`: el token no es valido o no corresponde a una llave registrada
- `403`: el token no trae el scope `cardholders.lookup`
- `422`: falta `curp` o llega vacia

### Paso 5. Crear el request de staging

Usa este request solo cuando `lookup` haya devuelto `404`.

En Postman crea otra request:

- Metodo: `POST`
- URL: `{{baseUrl}}/beneficiarios-staging`
- Headers:
  - `Authorization: Bearer {{integrationToken}}`
  - `Content-Type: application/json`
- Body `raw` tipo `JSON`:

```json
{
  "external_request_id": "{{externalRequestId}}",
  "beneficiario": {
    "curp": "MOCJ050521MSPNRL01",
    "nombre": "JULIETA",
    "apellido_paterno": "MORALES",
    "apellido_materno": "CANO",
    "fecha_nacimiento": "2005-05-21",
    "sexo": "M",
    "discapacidad": false,
    "id_ine": "INE123456",
    "telefono": "4441234567",
    "domicilio": {
      "calle": "AV REVOLUCION",
      "numero_ext": "321B",
      "numero_int": null,
      "colonia": "ZONA CENTRO",
      "municipio_id": 1,
      "codigo_postal": "22000",
      "seccional": "001"
    }
  }
}
```

### Paso 6. Interpretar la respuesta de staging

Si el expediente fue aceptado en staging:

- HTTP `202`
- respuesta esperada:

```json
{
  "created": true,
  "status": "pending",
  "staging_id": 123
}
```

Si recibes:

- `401`: token invalido
- `403`: el token no trae el scope `beneficiarios.staging.create`
- `409`: la CURP ya existe o ya hay un staging previo
- `422`: falta algun campo obligatorio o `discapacidad` no es boolean

### Paso 7. Flujo sugerido de prueba

Para una prueba funcional completa en Postman:

1. Coloca `baseUrl`.
2. Genera un token valido y guardalo en `integrationToken`.
3. Ejecuta `POST /cardholders/lookup`.
4. Si responde `200`, la prueba de consulta fue correcta.
5. Si responde `404`, ejecuta `POST /beneficiarios-staging`.
6. Verifica que staging responda `202`.

### Paso 8. Recomendaciones para Postman

- guarda `baseUrl` e `integrationToken` en un environment, no pegues el token en cada request
- si estas probando produccion, usa una CURP real solo con autorizacion
- cambia `externalRequestId` en cada prueba para evitar `409`
- si el token expira, genera uno nuevo antes de repetir la llamada
- si Railway ya tiene configurado el bootstrap por variables, no necesitas insertar clientes manualmente en DB

## 11. Resumen rapido del contrato

| Caso | Endpoint | Scope | Exito |
|------|----------|-------|-------|
| Validar si una CURP ya existe | `POST /api/v1/cardholders/lookup` | `cardholders.lookup` | `200` o `404` |
| Enviar expediente temporal cuando no existe | `POST /api/v1/beneficiarios-staging` | `beneficiarios.staging.create` | `202` |

## 12. Endpoints que no debe usar la Unidad de Informatica

- `POST /api/v1/register`
- `GET /api/v1/beneficiarios-staging`
- `POST /api/v1/beneficiarios-staging/:id/push`
- `DELETE /api/v1/beneficiarios-staging/expired`

Los tres ultimos son de uso interno administrativo dentro de API_TJ.
