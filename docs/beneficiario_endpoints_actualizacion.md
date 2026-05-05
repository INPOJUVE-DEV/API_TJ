# Actualizacion del sistema del beneficiario

## Objetivo

Documentar los endpoints actuales del modulo beneficiario en `API_TJ` despues del retiro de Auth0 y la adopcion de autenticacion local propia.

## Alcance actual

El frontend del beneficiario consume hoy:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- `GET /api/v1/me`
- `GET /api/v1/catalog`
- `GET /api/v1/catalog/:id`
- `POST /api/v1/cardholders/verify-activation`
- `POST /api/v1/cardholders/complete-activation`

## Resumen ejecutivo

### Sesion

1. `login` devuelve `accessToken`, `expiresIn` y `user`.
2. El refresh token viaja en cookie `httpOnly`.
3. `refresh` rota la cookie y entrega un nuevo `accessToken`.
4. `logout` invalida la sesion refresh actual.

### Alta local

1. `verify-activation` valida `tarjeta_numero + curp`.
2. `complete-activation` crea o reclama la cuenta local con `email + password`.
3. La respuesta de activacion ya entrega sesion inicial.

### Recuperacion

1. `forgot-password` responde siempre con mensaje generico.
2. `reset-password` consume un token de un solo uso y obliga a relogin.

## Autenticacion y headers

### Login

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

Notas:

- la cookie refresh no va en el body
- el frontend debe usar `credentials: "include"` en `refresh` y `logout`

### Header requerido para endpoints protegidos

```http
Authorization: Bearer <accessToken>
```

## Endpoints vigentes del beneficiario

### `POST /api/v1/auth/login`

- inicia sesion local del beneficiario
- responde `401` con `Credenciales invalidas` si falla autenticacion

### `POST /api/v1/auth/refresh`

- no recibe body
- rota refresh token
- responde `401` con `Sesion no disponible.` si la cookie es invalida, vencio o fue reutilizada

### `POST /api/v1/auth/logout`

- invalida la cookie refresh actual
- responde `204 No Content`

### `POST /api/v1/auth/forgot-password`

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

### `POST /api/v1/auth/reset-password`

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

### `GET /api/v1/me`

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

Observaciones:

- la ruta usa `no-store`
- `barcodeValue` se genera o reutiliza desde `user_qr_tokens`

### `GET /api/v1/catalog`

- requiere `Bearer`
- permite `role=beneficiary`, `admin` y `reader`
- sigue alimentando tambien la vista de mapa

### `GET /api/v1/catalog/:id`

- requiere `Bearer`
- devuelve detalle completo de beneficio

### `POST /api/v1/cardholders/verify-activation`

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

Notas:

- abre una ventana temporal de 15 minutos para completar la activacion

### `POST /api/v1/cardholders/complete-activation`

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

Errores comunes:

- `403` si no hubo verificacion previa o expiro
- `409` si la tarjeta ya fue reclamada o el email pertenece a otra cuenta
- `422` si falla validacion de password

## Endpoints retirados o legacy

- `POST /api/v1/auth/otp/send` -> `410 Gone`
- `POST /api/v1/auth/otp/verify` -> `410 Gone`
- `POST /api/v1/cardholders/:curp/account` -> `410 Gone`
- `POST /api/v1/register` -> `410 Gone`

## Observaciones de arquitectura

### 1. Auth0 ya no participa

El flujo ciudadano actual no usa:

- `AUTH0_DOMAIN`
- `AUTH0_CLIENT_ID`
- `auth0_id_token`

### 2. La sesion publica es local

El backend emite:

- `accessToken` JWT corto
- refresh token opaco rotado en cookie `httpOnly`

### 3. El mapa sigue usando catalogo

No existe aun un endpoint dedicado para geolocalizacion.

## Matriz rapida de consumo

| Pantalla | Endpoint | Metodo | Auth |
|----------|----------|--------|------|
| Login | `/api/v1/auth/login` | `POST` | No |
| Refresh | `/api/v1/auth/refresh` | `POST` | Cookie |
| Logout | `/api/v1/auth/logout` | `POST` | Cookie |
| Forgot password | `/api/v1/auth/forgot-password` | `POST` | No |
| Reset password | `/api/v1/auth/reset-password` | `POST` | No |
| Perfil | `/api/v1/me` | `GET` | `Bearer` |
| Catalogo | `/api/v1/catalog` | `GET` | `Bearer` |
| Detalle de beneficio | `/api/v1/catalog/:id` | `GET` | `Bearer` |
| Verificacion de activacion | `/api/v1/cardholders/verify-activation` | `POST` | No |
| Completar activacion | `/api/v1/cardholders/complete-activation` | `POST` | No |
