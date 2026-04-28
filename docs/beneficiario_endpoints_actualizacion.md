# Actualizacion del sistema del beneficiario

## Objetivo

Documentar los endpoints que hoy utiliza el sistema del beneficiario en `API_TJ`, con foco en:

- acceso a sesion,
- perfil del usuario,
- catalogo de beneficios,
- mapa de beneficios,
- activacion de cuenta cuando aplica.

Este documento **no** cubre endpoints administrativos ni las integraciones sistema a sistema de `Sys_IPJ` o `Unidad de Informatica`.

## Alcance actual

El sistema del beneficiario consume hoy el namespace publico de la API bajo `/api/v1`.

Para el modulo de beneficiario, los contratos vigentes son:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/me`
- `GET /api/v1/catalog`
- `GET /api/v1/catalog/:id`
- `POST /api/v1/cardholders/verify-activation`
- `POST /api/v1/cardholders/complete-activation`

## Resumen ejecutivo

### Lo que usa hoy el frontend del beneficiario

1. `POST /api/v1/auth/login` para obtener `accessToken` y `refreshToken`.
2. `GET /api/v1/me` para cargar el perfil y los datos de tarjeta del usuario.
3. `GET /api/v1/catalog` para listar beneficios.
4. `GET /api/v1/catalog/:id` para mostrar el detalle de un beneficio.
5. El mapa **no tiene un endpoint dedicado**: se alimenta del mismo `GET /api/v1/catalog`, usando `lat` y `lng`.

### Lo que forma parte del flujo nuevo de activacion

1. `POST /api/v1/cardholders/verify-activation` valida `tarjeta_numero + curp`.
2. `POST /api/v1/cardholders/complete-activation` vincula la cuenta Auth0 con el registro local.

## Autenticacion y headers

### Login

El login actual del modulo beneficiario es:

- `POST /api/v1/auth/login`

Recibe:

```json
{
  "username": "carlos.lopez@example.com",
  "password": "Secret456!"
}
```

Responde:

```json
{
  "accessToken": "jwt-local",
  "refreshToken": "refresh-token"
}
```

Notas:

- El endpoint aplica rate limit.
- La respuesta sale con `Cache-Control: no-store`.
- Hoy no existe `POST /api/v1/auth/refresh`.

### Header requerido

Para perfil, catalogo, detalle de beneficio y logout se requiere:

```http
Authorization: Bearer <accessToken>
```

## Endpoints vigentes del beneficiario

## 1. Login

### `POST /api/v1/auth/login`

Uso:

- inicia sesion del usuario beneficiario con credenciales locales.

Request:

```json
{
  "username": "carlos.lopez@example.com",
  "password": "Secret456!"
}
```

Response `200`:

```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<token>"
}
```

Errores comunes:

- `400` si faltan `username` o `password`
- `401` si las credenciales no coinciden
- `500` si ocurre un error interno

Observacion:

- El JWT local solo contiene `id` en el payload al generarse en este flujo.

## 2. Logout

### `POST /api/v1/auth/logout`

Uso:

- invalida los `refresh_tokens` del usuario autenticado.

Request:

- requiere `Authorization: Bearer <accessToken>`

Response:

- `204 No Content`

Errores comunes:

- `401` si no se envia token
- `401` si el token es invalido

## 3. Perfil del beneficiario

### `GET /api/v1/me`

Uso:

- carga el perfil basico del usuario autenticado
- devuelve datos utiles para la pantalla de perfil y la tarjeta digital

Request:

- requiere `Authorization: Bearer <accessToken>`

Response `200`:

```json
{
  "id": 2,
  "nombre": "Carlos",
  "apellidos": "Lopez Mendez",
  "edad": null,
  "creditos": 0,
  "barcodeValue": "TJ1-...-202604",
  "email": "carlos.lopez@example.com",
  "municipio": "Ciudad Valles",
  "telefono": "***6543",
  "fotoUrl": null,
  "portadaUrl": null,
  "auth0UserId": null,
  "cardholderSyncId": 2,
  "tarjetaNumero": "TJ-0002"
}
```

Campos relevantes para frontend:

- `barcodeValue`: codigo util para credencial o tarjeta digital
- `creditos`: saldo visible del usuario
- `municipio`: dato de perfil
- `telefono`: llega enmascarado salvo que `EXPOSE_PII=true`
- `fotoUrl` y `portadaUrl`: assets visuales del perfil
- `tarjetaNumero`: numero de tarjeta vinculada si existe

Errores comunes:

- `401` si no se envia token
- `404` si el usuario no existe
- `500` si falla la consulta

Observaciones:

- La ruta usa `no-store`.
- El backend intenta generar o reutilizar un token QR activo para poblar `barcodeValue`.
- El perfil ya soporta usuarios vinculados por Auth0 porque usa `auth0_user_id` y `cardholder_sync_id`.

## 4. Catalogo de beneficios

### `GET /api/v1/catalog`

Uso:

- lista beneficios para la vista de catalogo
- alimenta tambien la vista de mapa

Request:

- requiere `Authorization: Bearer <accessToken>`

Query params soportados:

- `q`: busca por `nombre` o `descripcion`
- `categoria`: filtra por nombre de categoria
- `municipio`: filtra por nombre de municipio
- `page`: pagina actual, default `1`
- `pageSize`: tamano de pagina, default `20`, max `100`

Ejemplo:

```http
GET /api/v1/catalog?q=gimnasio&municipio=San%20Luis%20Potos%C3%AD&page=1&pageSize=20
```

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

Campos relevantes para frontend:

- `nombre`
- `categoria`
- `municipio`
- `descuento`
- `direccion`
- `horario`
- `descripcion`
- `lat`
- `lng`

Errores comunes:

- `401` si no se envia token
- `403` si el rol no esta autorizado
- `500` si falla la consulta

Observaciones:

- La ruta esta protegida con rol `admin` o `reader`.
- Los usuarios finales vinculados por el flujo nuevo quedan con rol `reader`, por lo que este contrato es compatible con ellos.

## 5. Detalle de beneficio

### `GET /api/v1/catalog/:id`

Uso:

- muestra el detalle completo de un beneficio

Request:

- requiere `Authorization: Bearer <accessToken>`

Response `200`:

```json
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
```

Errores comunes:

- `401` si no se envia token
- `404` si el beneficio no existe
- `422` si `id` no es entero positivo

## 6. Mapa de beneficios

### Estado actual

No existe `GET /api/v1/map` ni un endpoint dedicado para geolocalizacion.

El mapa del beneficiario debe construirse con los registros de:

- `GET /api/v1/catalog`

Campos usados para mapa:

- `lat`
- `lng`
- `nombre`
- `direccion`
- `categoria`
- `descuento`

Implicacion para frontend:

- la pantalla de mapa debe consumir el catalogo y transformar cada item en un marcador
- si se requiere clustering, viewport query o busqueda geoespacial, eso hoy no existe en backend

## 7. Activacion de cuenta

Estas rutas pertenecen al flujo nuevo del beneficiario cuando la cuenta se vincula contra `cardholders_sync` y Auth0.

## 7.1 Verificar elegibilidad de activacion

### `POST /api/v1/cardholders/verify-activation`

Uso:

- valida que una tarjeta y una CURP correspondan
- confirma si la tarjeta esta disponible para activacion

Request:

```json
{
  "tarjeta_numero": "TJ-0080",
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

Posibles respuestas funcionales:

- `403` si la tarjeta no coincide con la CURP
- `409` si la tarjeta no esta activa
- `409` si la tarjeta ya esta vinculada

Observacion:

- cuando la validacion es correcta, el backend abre una ventana temporal de 15 minutos para completar la activacion

## 7.2 Completar activacion con Auth0

### `POST /api/v1/cardholders/complete-activation`

Uso:

- vincula un usuario Auth0 con el registro local del beneficiario

Request:

```json
{
  "tarjeta_numero": "TJ-0080",
  "auth0_id_token": "<id-token-auth0>"
}
```

Response `200`:

```json
{
  "activated": true,
  "message": "Cuenta vinculada correctamente"
}
```

Errores comunes:

- `422` si faltan campos
- `401` si el token de Auth0 es invalido
- `403` si no hubo verificacion previa o ya vencio
- `404` si la tarjeta no esta disponible
- `409` si la tarjeta o el usuario ya estan vinculados
- `500` si falla la vinculacion

Observaciones importantes:

- este endpoint no regresa `accessToken` local
- solo vincula `auth0_user_id`, `email` y `cardholder_sync_id`
- el usuario creado o actualizado queda con rol `reader`

## Endpoints retirados o no aplicables al beneficiario actual

### `POST /api/v1/auth/otp/send`

Responde:

- `410 Gone`

Mensaje:

- el flujo OTP por CURP fue retirado

### `POST /api/v1/auth/otp/verify`

Responde:

- `410 Gone`

Mensaje:

- el flujo OTP por CURP fue retirado

### `POST /api/v1/cardholders/:curp/account`

Responde:

- `410 Gone`

Mensaje:

- el alta local con contrasena fue retirada

## Observaciones de arquitectura

### 1. El mapa no tiene backend dedicado

Hoy el mapa del beneficiario depende del catalogo completo. Si se espera:

- filtros por cercania,
- busqueda por bounding box,
- performance con muchos puntos,
- clustering server-side,

sera necesario crear un endpoint nuevo.

### 2. El flujo Auth0 todavia no cierra completamente el ciclo de sesion local

Hoy existe:

- verificacion de activacion
- vinculacion con Auth0

Pero no existe hoy un endpoint explicito que:

- reciba un token Auth0 del beneficiario
- lo valide
- entregue un `accessToken` local para consumir `/api/v1/me` y `/api/v1/catalog`

Si la app del beneficiario va a migrar completamente a Auth0, este punto sigue abierto.

### 3. Catalogo y mapa comparten contrato

Esto simplifica el frontend actual, pero acopla dos pantallas al mismo payload.

## Matriz rapida de consumo

| Pantalla | Endpoint | Metodo | Auth |
|----------|----------|--------|------|
| Login | `/api/v1/auth/login` | `POST` | No |
| Perfil | `/api/v1/me` | `GET` | `Bearer` |
| Catalogo | `/api/v1/catalog` | `GET` | `Bearer` |
| Detalle de beneficio | `/api/v1/catalog/:id` | `GET` | `Bearer` |
| Mapa | `/api/v1/catalog` | `GET` | `Bearer` |
| Logout | `/api/v1/auth/logout` | `POST` | `Bearer` |
| Verificacion de activacion | `/api/v1/cardholders/verify-activation` | `POST` | No |
| Completar activacion | `/api/v1/cardholders/complete-activation` | `POST` | No |

## Fuente

Este documento fue levantado contra la implementacion actual en:

- `src/routes/auth.js`
- `src/routes/user.js`
- `src/routes/catalog.js`
- `src/routes/cardholders.js`
- `src/controllers/authController.js`
- `src/controllers/userController.js`
- `src/controllers/catalogController.js`
- `src/controllers/cardholderController.js`
