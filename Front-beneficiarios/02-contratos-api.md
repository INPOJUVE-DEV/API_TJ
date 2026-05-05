# Contratos API

Base path publico: `/api/v1`

## Sesion

### `POST /auth/login`

Request:

```json
{
  "username": "beneficiary@example.com",
  "password": "LegacyPassword1!"
}
```

Response `200`:

```json
{
  "accessToken": "<jwt>",
  "expiresIn": 900,
  "user": {
    "id": 1,
    "email": "beneficiary@example.com",
    "nombreCompleto": "Carlos Lopez Mendez",
    "role": "beneficiary",
    "status": "active",
    "cardholderSyncId": 1,
    "tarjetaNumero": "TJ-1000"
  }
}
```

Errores:

- `400` -> `{"message":"username y password son obligatorios"}`
- `401` -> `{"message":"Credenciales invalidas"}`
- `422` -> `{"message":"username no es valido"}`
- `500` -> `{"message":"Error interno"}`

Notas:

- setea cookie refresh
- incluye `Cache-Control: no-store`

### `POST /auth/refresh`

Request:

- sin body
- requiere cookie refresh

Response `200`:

```json
{
  "accessToken": "<jwt>",
  "expiresIn": 900,
  "user": {
    "id": 1,
    "email": "beneficiary@example.com",
    "nombreCompleto": "Carlos Lopez Mendez",
    "role": "beneficiary",
    "status": "active",
    "cardholderSyncId": 1,
    "tarjetaNumero": "TJ-1000"
  }
}
```

Errores:

- `401` -> `{"message":"Sesion no disponible."}`
- `500` -> `{"message":"Error interno"}`

Notas:

- rota la cookie refresh
- si detecta reuse de refresh invalida sesiones del usuario

### `POST /auth/logout`

Request:

- sin body
- requiere cookie refresh si existe

Response:

- `204 No Content`

Errores:

- `500` -> `{"message":"Error interno"}`

## Recuperacion de contrasena

### `POST /auth/forgot-password`

Request:

```json
{
  "email": "beneficiary@example.com"
}
```

Response `200`:

```json
{
  "message": "Si el correo existe y esta habilitado, recibira instrucciones para restablecer la contrasena."
}
```

Errores:

- `400` -> `{"message":"email es obligatorio"}`
- `422` -> `{"message":"email no es valido"}`
- `500` -> `{"message":"Error interno"}`

Nota:

- la respuesta exitosa es neutra aunque el correo no exista

### `POST /auth/reset-password`

Request:

```json
{
  "token": "<token>",
  "password": "PasswordNueva123!",
  "password_confirmation": "PasswordNueva123!"
}
```

Response `200`:

```json
{
  "reset": true,
  "message": "Contrasena actualizada correctamente."
}
```

Errores:

- `400` -> `{"message":"token, password y password_confirmation son obligatorios."}`
- `400` -> `{"message":"Token de restablecimiento invalido o expirado."}`
- `422` -> `{"message":"password_confirmation no coincide."}`
- `422` -> mensajes de politica de password
- `500` -> `{"message":"Error interno"}`

## Activacion local

### `POST /cardholders/verify-activation`

Request:

```json
{
  "tarjeta_numero": "TJ-2000",
  "curp": "MELR000202MSPSRD06"
}
```

Response `200`:

```json
{
  "can_activate": true,
  "message": "Validacion correcta"
}
```

Errores:

- `403` -> `{"can_activate":false,"message":"La tarjeta no esta disponible para activacion."}`
- `409` -> `{"can_activate":false,"message":"La tarjeta no esta activa."}`
- `409` -> `{"can_activate":false,"message":"La tarjeta ya cuenta con una cuenta vinculada."}`
- `422` -> mensajes de validacion
- `500` -> `{"message":"Error al validar activacion."}`

### `POST /cardholders/complete-activation`

Request:

```json
{
  "tarjeta_numero": "TJ-2000",
  "email": "nuevo.beneficiario@example.com",
  "password": "NuevaPassword123!",
  "password_confirmation": "NuevaPassword123!"
}
```

Response `200`:

```json
{
  "activated": true,
  "message": "Cuenta activada correctamente",
  "accessToken": "<jwt>",
  "expiresIn": 900,
  "user": {
    "id": 3,
    "email": "nuevo.beneficiario@example.com",
    "nombreCompleto": null,
    "role": "beneficiary",
    "status": "active",
    "cardholderSyncId": 2,
    "tarjetaNumero": "TJ-2000"
  }
}
```

Errores:

- `403` -> `{"message":"Debes validar tarjeta y CURP antes de completar la activacion."}`
- `404` -> `{"message":"La tarjeta no esta disponible."}`
- `409` -> `{"message":"La tarjeta ya esta vinculada."}`
- `409` -> `{"message":"La tarjeta ya esta vinculada a otra cuenta."}`
- `409` -> `{"message":"El email ya esta vinculado a otra cuenta."}`
- `409` -> `{"message":"El email ya esta vinculado a otra tarjeta."}`
- `409` -> `{"message":"El email ya existe en otra cuenta."}`
- `409` -> `{"message":"El email ya existe."}`
- `422` -> mensajes de validacion de email o password
- `500` -> `{"message":"Error al activar cuenta."}`

## Perfil

### `GET /me`

Headers:

```http
Authorization: Bearer <accessToken>
```

Response `200`:

```json
{
  "id": 1,
  "nombre": "Carlos",
  "apellidos": "Lopez Mendez",
  "role": "beneficiary",
  "status": "active",
  "edad": null,
  "creditos": 0,
  "barcodeValue": "TJ1-...-202604",
  "email": "beneficiary@example.com",
  "municipio": "Tijuana",
  "telefono": "***4567",
  "fotoUrl": null,
  "portadaUrl": null,
  "cardholderSyncId": 1,
  "tarjetaNumero": "TJ-1000"
}
```

Errores:

- `401` -> `{"message":"Token no proporcionado"}` o `{"message":"Token invalido"}`
- `404` -> `{"message":"Usuario no encontrado"}`
- `500` -> `{"message":"Error al cargar el perfil."}`

## Catalogo

### `GET /catalog`

Headers:

```http
Authorization: Bearer <accessToken>
```

Query params:

- `q`
- `categoria`
- `municipio`
- `page`
- `pageSize`

Response `200`:

```json
{
  "items": [
    {
      "id": 1,
      "nombre": "Cafe Frontera",
      "categoria": "Restaurantes",
      "municipio": "Tijuana",
      "descuento": "20% en consumo presentando la tarjeta",
      "direccion": "Av. Revolucion 123, Zona Centro",
      "horario": "L-D 08:00 - 22:00",
      "descripcion": "Coffee shop local con descuentos especiales para estudiantes.",
      "lat": "32.52151000",
      "lng": "-117.02454000"
    }
  ],
  "total": 11,
  "page": 1,
  "pageSize": 20,
  "totalPages": 1
}
```

### `GET /catalog/:id`

Headers:

```http
Authorization: Bearer <accessToken>
```

Errores comunes:

- `401`
- `404`
- `422`

## Endpoints legacy retirados

- `POST /auth/otp/send` -> `410`
- `POST /auth/otp/verify` -> `410`
- `POST /cardholders/:curp/account` -> `410`
- `POST /register` -> `410`
