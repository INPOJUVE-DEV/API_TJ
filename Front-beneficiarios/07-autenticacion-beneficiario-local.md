# Autenticacion Beneficiario Local

## Objetivo del cambio

El flujo ciudadano deja de depender de Auth0.

Desde este cambio:

- el beneficiario usa autenticacion local propia de `API_TJ`
- el admin conserva su login tradicional en `/api/v1/admin/auth/login`
- la activacion del beneficiario sigue validando `tarjeta_numero + curp`
- la sesion web usa `accessToken` corto + refresh token en cookie `httpOnly`

## Flujo UX final

1. El usuario captura `tarjeta_numero` y `curp`.
2. Frontend llama `POST /api/v1/cardholders/verify-activation`.
3. Si la tarjeta es elegible, frontend muestra formulario de alta local con `email`, `password`, `password_confirmation`.
4. Frontend llama `POST /api/v1/cardholders/complete-activation`.
5. Backend responde `accessToken`, `expiresIn`, `user` y setea cookie refresh.
6. Frontend usa `GET /api/v1/me` y `GET /api/v1/catalog`.
7. Cuando el `accessToken` vence, frontend llama `POST /api/v1/auth/refresh` con `credentials: "include"`.
8. Para recuperar acceso, frontend llama `POST /api/v1/auth/forgot-password`, abre pantalla de reset y luego usa `POST /api/v1/auth/reset-password`.

## Contratos API

### `POST /api/v1/auth/login`

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

- setea cookie refresh `httpOnly`
- devuelve `401` con `{"message":"Credenciales invalidas"}` si falla autenticacion

### `POST /api/v1/auth/refresh`

Request:

- sin body
- requiere cookie refresh
- frontend debe enviar `credentials: "include"`

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

- `401` con `{"message":"Sesion no disponible."}` si no hay cookie valida o se detecta reuse

### `POST /api/v1/auth/logout`

Request:

- sin body
- frontend debe enviar `credentials: "include"`

Response:

- `204 No Content`

Efecto:

- invalida la cookie refresh actual
- limpia la cookie en navegador

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

Errores funcionales:

- `403` si tarjeta y CURP no coinciden
- `409` si la tarjeta no esta activa o ya tiene password local

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

- `403` si no hubo verificacion previa o la ventana ya expiro
- `409` si el email ya pertenece a otra cuenta o la tarjeta ya fue reclamada
- `422` si `password_confirmation` no coincide o la password no cumple politica

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

Notas:

- la respuesta es deliberadamente generica
- frontend nunca debe inferir si el correo existe por el mensaje

### `POST /api/v1/auth/reset-password`

Request:

```json
{
  "token": "<token-de-reset>",
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

Efecto:

- invalida sesiones previas
- obliga a relogin

### `GET /api/v1/me`

Request:

- requiere `Authorization: Bearer <accessToken>`

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

## Reglas de frontend

- Guardar solo `accessToken` en memoria.
- No guardar refresh token en `localStorage`, `sessionStorage` ni IndexedDB.
- Usar `credentials: "include"` en `refresh` y `logout`.
- Ante `401` en endpoints protegidos, intentar `POST /api/v1/auth/refresh` una sola vez y luego reintentar la llamada original.
- Si `refresh` tambien responde `401`, limpiar estado local y enviar al login.
- Tratar errores de login y recuperación como genéricos.
- No asumir que `nombreCompleto` siempre existe justo despues de activacion.

## Pantallas a ajustar

- Login beneficiario.
- Activacion de cuenta por `tarjeta_numero + curp`.
- Formulario de alta local con email y password.
- Forgot password.
- Reset password.
- Bootstrap de sesion al cargar la app.
- Logout.

## Checklist de integracion

- Frontend envia `Authorization: Bearer <accessToken>` en `/me` y `/catalog`.
- Frontend envia `credentials: "include"` en `refresh` y `logout`.
- El dominio frontend permitido esta configurado en `FRONTEND_ORIGIN`.
- CORS para cookies se valida en local y produccion.
- Login guarda solo `accessToken` en memoria.
- Expiracion de sesion se resuelve con `refresh` automatico.
- Logout limpia estado local aunque la respuesta sea `204`.
- Reset exitoso fuerza regresar a login.
- Rutas protegidas redirigen si no hay sesion recuperable.
