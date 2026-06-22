# Contratos API Admin

## Base URL

Todos los endpoints se consumen bajo la misma API actual.

Ejemplo local:

```txt
http://localhost:8080/api/v1
```

## Autenticacion

### Login admin

`POST /api/v1/admin/auth/login`

Request:

```json
{
  "username": "ana.hernandez@example.com",
  "password": "Test1234!"
}
```

Response `200`:

```json
{
  "accessToken": "jwt-admin",
  "authenticated": true,
  "user": {
    "id": 1,
    "email": "ana.hernandez@example.com",
    "nombreCompleto": "Ana Hernandez Ruiz",
    "role": "admin",
    "status": "active",
    "municipio": "San Luis Potosi"
  },
  "role": "admin",
  "status": "active",
  "permissions": [
    "dashboard.read",
    "convenios.read",
    "convenios.write",
    "users.read",
    "users.write",
    "staging.read",
    "staging.push",
    "lookups.read"
  ]
}
```

Errores esperados:

- `400`: faltan credenciales
- `401`: credenciales invalidas
- `429`: demasiados intentos

### Sesion actual

`GET /api/v1/admin/session`

Headers:

```txt
Authorization: Bearer <accessToken>
```

Response `200`:

```json
{
  "authenticated": true,
  "user": {
    "id": 1,
    "email": "ana.hernandez@example.com",
    "nombreCompleto": "Ana Hernandez Ruiz",
    "role": "admin",
    "status": "active",
    "municipio": "San Luis Potosi"
  },
  "role": "admin",
  "status": "active",
  "permissions": [
    "dashboard.read",
    "convenios.read",
    "convenios.write",
    "users.read",
    "users.write",
    "staging.read",
    "staging.push",
    "lookups.read"
  ]
}
```

### Logout

`POST /api/v1/admin/auth/logout`

Response `204`.

## Regla de sesion vigente

- No existe refresh token.
- El token admin expira en `8h`.
- Al hacer logout, cambio de rol, bloqueo o reset de password, la sesion queda invalidada en backend por `session_version`.
- Frontend debe tratar `401` como sesion expirada y mandar al login.

## Dashboard

`GET /api/v1/admin/dashboard`

Response:

```json
{
  "staging": {
    "pending": 3,
    "accepted": 9,
    "rejected": 1,
    "error": 2
  },
  "sync": {
    "lastRunAt": "2026-04-28T10:00:00.000Z",
    "lastStatus": "success",
    "processed": 120
  },
  "catalog": {
    "benefits": 7
  },
  "users": {
    "admins": 1,
    "readers": 1,
    "blocked": 0
  },
  "cardholders": {
    "total": 120,
    "withAccount": 48
  },
  "integration": {
    "failedCallsLast24h": 4
  },
  "stagingPush": {
    "attemptedAt": "2026-04-28T11:00:00.000Z",
    "status": "accepted",
    "responseStatus": 200
  }
}
```

## Lookups

`GET /api/v1/admin/lookups?include=municipios,categorias`

Response:

```json
{
  "municipios": [
    { "id": 1, "nombre": "San Luis Potosi" }
  ],
  "categorias": [
    { "id": 1, "nombre": "Restaurantes" }
  ]
}
```

## Convenios

### Lista

`GET /api/v1/catalog?page=1&pageSize=20&q=cafe&categoria=Restaurantes&municipio=Ciudad%20Valles`

Response:

```json
{
  "items": [
    {
      "id": 1,
      "nombre": "Cafe Huasteco",
      "categoria": "Restaurantes",
      "municipio": "Ciudad Valles",
      "descuento": "20% en consumo",
      "direccion": "Blvd. Mexico-Laredo 123",
      "horario": "L-D 08:00 - 22:00",
      "descripcion": "Coffee shop local",
      "lat": 21.9833,
      "lng": -99.0167
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "totalPages": 1
}
```

### Detalle

`GET /api/v1/catalog/:id`

### Crear

`POST /api/v1/catalog`

Request:

```json
{
  "nombre": "Cafe Huasteco",
  "descripcion": "Coffee shop local",
  "categoriaId": 1,
  "municipioId": 2,
  "descuento": "20% en consumo",
  "direccion": "Blvd. Mexico-Laredo 123",
  "horario": "L-D 08:00 - 22:00",
  "lat": 21.9833,
  "lng": -99.0167
}
```

Response `201`: devuelve el objeto creado.

### Editar

`PUT /api/v1/catalog/:id`

Response `200`: devuelve el objeto actualizado.

### Eliminar

`DELETE /api/v1/catalog/:id`

Response `204`.

## Usuarios internos

### Lista

`GET /api/v1/admin/users?page=1&pageSize=20&q=ana&role=admin&status=active`

Response:

```json
{
  "items": [
    {
      "id": 1,
      "nombre": "Ana",
      "apellidos": "Hernandez Ruiz",
      "nombreCompleto": "Ana Hernandez Ruiz",
      "email": "ana.hernandez@example.com",
      "telefono": "***4567",
      "municipioId": 1,
      "municipio": "San Luis Potosi",
      "role": "admin",
      "status": "active",
      "cardholderSyncId": null,
      "lastLoginAt": "2026-04-28T12:00:00.000Z",
      "lastFailedLoginAt": null,
      "createdAt": "2026-04-01T00:00:00.000Z",
      "updatedAt": "2026-04-01T00:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "totalPages": 1
}
```

### Detalle

`GET /api/v1/admin/users/:id`

Response `200`: mismo shape de un item.

### Crear

`POST /api/v1/admin/users`

Request:

```json
{
  "nombre": "Ana",
  "apellidos": "Hernandez Ruiz",
  "email": "ana.hernandez@example.com",
  "telefono": "4441234567",
  "municipioId": 1,
  "role": "admin",
  "status": "active",
  "password": "Test1234!"
}
```

Errores esperados:

- `409`: email duplicado
- `422`: validacion

### Editar

`PATCH /api/v1/admin/users/:id`

Request parcial:

```json
{
  "role": "reader",
  "status": "blocked",
  "telefono": "4441234567"
}
```

### Reset de password

`POST /api/v1/admin/users/:id/set-password`

Request:

```json
{
  "password": "NuevaPassword123!"
}
```

Response `204`.

## Staging de beneficiarios

### Lista

`GET /api/v1/admin/beneficiarios-staging?page=1&pageSize=20&status=pending&q=REQ-2026-001`

Response:

```json
{
  "items": [
    {
      "id": 14,
      "external_request_id": "REQ-2026-001",
      "curp_masked": "HE***01",
      "status": "pending",
      "submitted_by_system": "unidad_informatica",
      "submitted_at": "2026-04-26T18:00:00.000Z",
      "sent_at": null,
      "resolved_at": null,
      "error_message": null,
      "locked_at": null,
      "locked_by": null,
      "sys_ipj_response_code": null
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "totalPages": 1
}
```

### Detalle

`GET /api/v1/admin/beneficiarios-staging/:id`

Notas:

- `reader` recibe `payload: null`
- `admin` recibe `payload` desencriptado con mascara

Response de `admin`:

```json
{
  "id": 14,
  "external_request_id": "REQ-2026-001",
  "curp_masked": "HE***01",
  "status": "pending",
  "submitted_by_system": "unidad_informatica",
  "submitted_at": "2026-04-26T18:00:00.000Z",
  "sent_at": null,
  "resolved_at": null,
  "error_message": null,
  "sys_ipj_response_code": null,
  "locked_at": null,
  "locked_by": null,
  "payload": {
    "curp": "****************06",
    "nombre": "Melissa",
    "apellido_paterno": "Rios",
    "apellido_materno": "Delgado",
    "fecha_nacimiento": "2000-02-02",
    "sexo": "M",
    "discapacidad": false,
    "id_ine": "*******0001",
    "telefono": "******4567",
    "domicilio": {
      "calle": "Av. Revolucion",
      "numero_ext": "321B",
      "numero_int": "2",
      "colonia": "Zona Centro",
      "municipio_id": 1,
      "codigo_postal": "***00",
      "seccional": "0001"
    }
  }
}
```

### Intentos de push

`GET /api/v1/admin/beneficiarios-staging/:id/attempts`

Response:

```json
{
  "items": [
    {
      "id": 10,
      "staging_id": 14,
      "external_request_id": "REQ-2026-001",
      "actor": "user:1",
      "response_status": 200,
      "status": "accepted",
      "error_message": null,
      "attempted_at": "2026-04-28T11:00:00.000Z",
      "created_at": "2026-04-28T11:00:00.000Z"
    }
  ]
}
```

### Push manual

`POST /api/v1/admin/beneficiarios-staging/:id/push`

Response exitosa:

```json
{
  "sent": true,
  "message": "Beneficiario enviado a Sys_IPJ",
  "sys_ipj_status": 200
}
```

## Errores globales a manejar

| Status | Significado |
|--------|-------------|
| `400` | Request incompleto |
| `401` | Sesion invalida o expirada |
| `403` | Rol sin permisos |
| `404` | Recurso no encontrado |
| `409` | Conflicto de negocio |
| `422` | Validacion |
| `429` | Rate limit |
| `500` | Error interno |
