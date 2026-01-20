# Guia de pruebas API con Postman

Esta guia documenta como validar los endpoints principales del Backend Tarjeta Joven usando Postman. Todos los ejemplos usan los datos generados por `scripts/seed.js`, por lo que puedes reconstruirlos corriendo `npm run seed` (o `docker compose exec api node scripts/seed.js`).

## 1. Entorno recomendado en Postman

| Variable | Valor inicial | Descripcion |
|----------|---------------|-------------|
| `{{baseUrl}}` | `http://localhost:8080/api/v1` | URL base expuesta por el backend (ajusta el puerto si usas otro). |
| `{{token}}` | *(vacio)* | Se llena automaticamente tras el login u OTP para reutilizar el Bearer Token. |
| `{{refreshToken}}` | *(vacio)* | Opcional: guarda el valor devuelto por login/OTP. |
| `{{otpCurp}}` | `HERL020101MBCNRZ01` | CURP del usuario a quien se enviara el OTP en pruebas rapidas. |
| `{{otpCode}}` | *(vacio)* | Variable temporal para almacenar el codigo OTP. |

> Sugerencia: crea un folder en tu coleccion con los scripts de tests indicados en cada seccion para que las variables se actualicen automaticamente.

## 2. Datos de prueba precargados

### 2.1 Usuarios con credenciales listas

| Alias | Usuario (email) | Login alternativo (CURP) | Password | Municipio | Telefono |
|-------|-----------------|--------------------------|----------|-----------|----------|
| Ana | `ana.hernandez@example.com` | `HERL020101MBCNRZ01` | `Test1234!` | Tijuana | 6641234567 |
| Carlos | `carlos.lopez@example.com` | `LOMC990505HBCLPM02` | `Secret456!` | Mexicali | 6869876543 |
| Maria | `maria.soto@example.com` | `SOAM010910MBCSGR03` | `Password789!` | Ensenada | 6465551122 |

### 2.2 Tarjetahabientes cargados

| CURP | Nombre | Municipio | Estado | Notas |
|------|--------|-----------|--------|-------|
| `HERL020101MBCNRZ01` | Ana Hernandez Ruiz | Tijuana | active | Ya tiene cuenta asociada (ideal para login y OTP). |
| `LOMC990505HBCLPM02` | Carlos Lopez Mendez | Mexicali | active | Cuenta vinculada; usar para login tradicional. |
| `MELR000202MBCSRD06` | Melissa Rios Delgado | Tecate | active | **Sin cuenta.** Usar para el flujo lookup + account. |
| `SAQP950101HBCQRP07` | Santiago Quintero Perez | Tijuana | inactive | Responde `404` en lookup. |

### 2.3 Beneficios disponibles

| Nombre | Categoria | Municipio | Descuento |
|--------|-----------|-----------|-----------|
| Cafe Frontera | Restaurantes | Tijuana | 20% en consumo presentando la tarjeta. |
| Gimnasio Vitalia | Salud | Mexicali | Inscripcion gratis + 15% mensualidad. |
| Cine Pacifico | Entretenimiento | Ensenada | 2x1 en taquilla martes y jueves. |
| Coding Lab BC | Tecnologia | Tijuana | Beca del 30% en cursos intensivos. |

### 2.4 Solicitudes de registro existentes

| CURP | Nombre | Municipio | Estado de solicitud |
|------|--------|-----------|---------------------|
| `SAQF030415MBCSLQ04` | Fernanda Salas Quiroz | Tijuana | pending |
| `CATL021102HBCCMT05` | Luis Camacho Torres | Mexicali | approved |

> Tip: evita reutilizar estos CURP cuando pruebes `/register` para no obtener `409 Conflict`. Cambia algunos caracteres finales o genera un CURP temporal para cada prueba.

---

## 3. Autenticacion con usuario y password

### 3.1 POST `{{baseUrl}}/auth/login`

Obtiene un `accessToken` (15 minutos por defecto) y un `refreshToken` valido por 7 dias. El backend acepta email o CURP en `username`.

**Headers**

- `Content-Type: application/json`

**Body (raw / JSON)**

```json
{
  "username": "ana.hernandez@example.com",
  "password": "Test1234!"
}
```

Tambien puedes usar `LOMC990505HBCLPM02` con `Secret456!`.

**Tests recomendados en Postman**

```javascript
pm.test("Login 200", () => pm.response.to.have.status(200));
const data = pm.response.json();
pm.environment.set("token", data.accessToken);
pm.environment.set("refreshToken", data.refreshToken);
```

**Respuesta 200 (ejemplo)**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "8b6427f65679c3b2a7f1..."
}
```

### 3.2 POST `{{baseUrl}}/auth/logout`

Elimina los refresh tokens asociados al usuario autenticado.

- Header: `Authorization: Bearer {{token}}`
- Respuesta exitosa: `204 No Content`.

---

## 4. Autenticacion con OTP

Usa este flujo para sesiones sin password (ideal para QA). El OTP se devuelve en la respuesta para facilitar la prueba manual.

### 4.1 POST `{{baseUrl}}/auth/otp/send`

**Body**

```json
{
  "curp": "{{otpCurp}}"
}
```

Con `{{otpCurp}} = HERL020101MBCNRZ01` la respuesta incluye:

```json
{
  "message": "OTP generado",
  "otp": "123456"
}
```

Guarda el codigo automaticamente:

```javascript
const data = pm.response.json();
pm.environment.set("otpCode", data.otp);
```

### 4.2 POST `{{baseUrl}}/auth/otp/verify`

**Body**

```json
{
  "curp": "{{otpCurp}}",
  "otp": "{{otpCode}}"
}
```

Respuesta `200`:

```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<refresh>"
}
```

Agrega el mismo test que en login para llenar `{{token}}`.

---

## 5. Perfil del usuario autenticado

### GET `{{baseUrl}}/me`

- Header: `Authorization: Bearer {{token}}`
- Respuesta cuando usaste a Ana:

```json
{
  "id": 1,
  "nombre": "Ana",
  "apellidos": "Hernandez Ruiz",
  "curp": "HERL020101MBCNRZ01",
  "email": "ana.hernandez@example.com",
  "municipio": "Tijuana",
  "telefono": "6641234567"
}
```

---

## 6. Catalogo de beneficios

### GET `{{baseUrl}}/catalog`

Parametros utiles:

| Parametro | Significado | Ejemplo |
|-----------|-------------|---------|
| `municipio` | Filtra por municipio. | `municipio=Tijuana` |
| `categoria` | Filtra por categoria. | `categoria=Salud` |
| `q` | Busca en nombre o descripcion. | `q=coding` |
| `page`, `pageSize` | Paginacion (max 100). | `page=1&pageSize=10` |

**Casos sugeridos**

1. `GET ...?municipio=Tijuana` debe devolver `Cafe Frontera` y `Coding Lab BC`.
2. `GET ...?categoria=Salud` regresa `Gimnasio Vitalia`.
3. `GET ...?q=cine` encuentra `Cine Pacifico`.

**Respuesta tipo**

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
      "lat": "32.52151",
      "lng": "-117.02454"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "totalPages": 1
}
```

---

## 7. Tarjetahabiente: lookup y creacion de cuenta

### 7.1 Lookup POST `{{baseUrl}}/cardholders/lookup`

**Body**

```json
{
  "curp": "MELR000202MBCSRD06"
}
```

**Respuesta 200**

```json
{
  "curp": "MELR000202MBCSRD06",
  "nombres": "Melissa",
  "apellidos": "Rios Delgado",
  "municipio": "Tecate",
  "hasAccount": false
}
```

**Escenarios extra**

- `HERL020101MBCNRZ01` devuelve `409` porque ya tiene cuenta.
- `SAQP950101HBCQRP07` devuelve `404` (tarjeta inactiva).
- Al superar 5 intentos en 15 minutos recibes `429` y la CURP se bloquea otros 15 minutos.

El lookup exitoso habilita durante 15 minutos la creacion de cuenta (`pending_account_until`).

### 7.2 Crear cuenta POST `{{baseUrl}}/cardholders/MELR000202MBCSRD06/account`

Ejecuta este paso inmediatamente despues del lookup.

```json
{
  "username": "melissa.rios@example.com",
  "password": "NewPassword123!",
  "confirmPassword": "NewPassword123!"
}
```

Respuesta `201`:

```json
{ "message": "Cuenta creada. Ya puedes iniciar sesion." }
```

Si repites la peticion recibiras `409` porque la CURP ya tiene `account_user_id`.

---

## 8. Solicitud de registro (personas sin tarjeta)

### POST `{{baseUrl}}/register`

El frontend envia **multipart/form-data** con **solo campos de texto**; los documentos (`ine`, `comprobante`, `curpDoc`) ya no son obligatorios para registrar la solicitud.

| Key | Value de ejemplo | Tipo | Validacion |
|-----|------------------|------|-----------|
| `nombres` | `Julieta` | Text | >= 2 caracteres |
| `apellidos` | `Morales Cano` | Text | >= 2 caracteres |
| `fechaNacimiento` | `21/05/2005` | Text | Formato `DD/MM/AAAA` valido; la edad calculada debe ser <= 29 anos |
| `curp` | `MOCJ050521MBCNRL01` | Text | CURP oficial; debe codificar la misma fecha de nacimiento |
| `calle` | `Av. Revolucion` | Text | >= 2 caracteres |
| `numero` | `321B` | Text | `S/N` o 1-5 digitos + sufijo alfanumerico |
| `cp` | `22000` | Text | 5 digitos |
| `colonia` | `Zona Centro` | Text | No vacio |
| `username` | `julieta.morales@example.com` | Text | Email valido, se guarda en minusculas |
| `password` | `SecurePass2025!` | Text | >=8 caracteres con mayuscula, minuscula y numero |
| `aceptaTerminos` | `true` | Text | Debe evaluarse como verdadero (`true`, `1`, `si`, `on`, `yes`) |

> Si aun envias campos de archivo `ine`, `comprobante` o `curpDoc`, el backend los aceptara de forma opcional pero ya no son requeridos para la validacion principal.

**Respuesta 201**

```json
{
  "message": "Solicitud recibida",
  "folio": "TJ-000123"
}
```

Errores comunes:

- `409` si el CURP ya existe en `usuarios`/`cardholders` o hay una solicitud `pending/approved` con el mismo CURP/username.
- `422` si algun campo no cumple los requisitos (fecha invalida, password debil, CP incorrecto, archivos sin formato permitido o >2 MB).
- `400` si faltan campos obligatorios antes de validar el resto.

> Si una validacion falla, el backend elimina los archivos ya subidos para evitar basura en el directorio de uploads (`UPLOADS_DIR`, default `uploads/`).

---

## 9. Buenas practicas

- Versiona tu coleccion y el archivo `readme_postman.md` junto al repositorio para que el equipo tenga los mismos datos de referencia.
- Antes de cualquier sesion de prueba, ejecuta `npm run seed` para volver a un estado conocido.
- Usa las variables `{{token}}` y `{{otpCode}}` en tus headers/body en lugar de copiar valores manualmente.

Con esta guia deberias poder cubrir todos los flujos funcionales expuestos por la API y validar regresiones rapidamente.
