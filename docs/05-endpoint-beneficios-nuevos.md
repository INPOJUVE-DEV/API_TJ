# Endpoint Propuesto: Beneficios Nuevos

## Objetivo
Permitir que el frontend de beneficiarios muestre un modal discreto cuando exista al menos un beneficio nuevo publicado desde la ultima vez que la persona lo reviso.

## Endpoint
- Metodo: `GET`
- Ruta: `/catalog/highlights`
- Auth: requerida
- Base esperada en desarrollo: `http://127.0.0.1:8081/api/v1`

## Query params
- `since` opcional
  - tipo: `string`
  - formato: `ISO 8601`
  - uso: regresar solo beneficios publicados despues de esa fecha
- `limit` opcional
  - tipo: `integer`
  - default sugerido: `1`
  - maximo sugerido: `3`

Ejemplo:

```http
GET /api/v1/catalog/highlights?since=2026-04-29T18:30:00Z&limit=1
Authorization: Bearer <access_token>
Cookie: refresh_token=...
Accept: application/json
```

## Regla de negocio esperada
- Solo incluir beneficios activos y visibles para beneficiarios.
- Ordenar de mas reciente a mas antiguo.
- `since` debe filtrar por fecha de publicacion del beneficio, no por fecha de actualizacion administrativa.
- Si no hay novedades, responder `200` con `items: []`.
- No responder `204`, para mantener consistente el cliente del frontend.
- Cada item debe contener suficiente informacion para renderizar el modal sin necesidad de una segunda llamada.

## Response 200

```json
{
  "items": [
    {
      "id": 321,
      "nombre": "Cafe Ruta Norte",
      "categoria": "Alimentos y bebidas",
      "municipio": "Tijuana",
      "descuento": "20% de descuento",
      "direccion": "Blvd. Agua Caliente 1234",
      "horario": "Lunes a domingo de 08:00 a 22:00",
      "descripcion": "Presenta tu Tarjeta Joven y recibe el descuento en consumo participante.",
      "lat": "32.514900",
      "lng": "-117.038200",
      "publishedAt": "2026-04-30T15:00:00Z",
      "headline": "Nuevo beneficio en cafeterias",
      "summary": "Aprovecha 20% de descuento en bebidas y alimentos participantes.",
      "imageUrl": "https://cdn.tarjetajoven.gob.mx/benefits/cafe-ruta-norte.jpg"
    }
  ],
  "generatedAt": "2026-04-30T15:05:00Z"
}
```

## Campos requeridos por item
- `id`: `string | number`
- `nombre`: `string`
- `categoria`: `string`
- `municipio`: `string`
- `descuento`: `string`
- `publishedAt`: `string` ISO 8601

## Campos opcionales por item
- `direccion`: `string | null`
- `horario`: `string | null`
- `descripcion`: `string | null`
- `lat`: `number | string | null`
- `lng`: `number | string | null`
- `headline`: `string | null`
- `summary`: `string | null`
- `imageUrl`: `string | null`

## Semantica para frontend
- Si `headline` existe, se usa como titulo principal del modal.
- Si `headline` no existe, el frontend usa `nombre`.
- Si `summary` existe, se usa como texto corto del modal.
- Si `summary` no existe, el frontend usa `descripcion`.
- Si `imageUrl` no existe, el frontend renderiza un arte local con categoria y descuento.

## Errores esperados
- `401 Unauthorized`
  - sesion expirada o token invalido
- `403 Forbidden`
  - usuario autenticado sin permisos para consultar beneficios
- `422 Unprocessable Entity`
  - `since` invalido o `limit` fuera de rango
- `500 Internal Server Error`
  - error inesperado

Ejemplo `422`:

```json
{
  "message": "El parametro since debe tener formato ISO 8601."
}
```

## Comportamiento esperado en frontend
- El frontend hace la llamada al entrar a `/catalog`.
- El frontend envia `since` con la fecha del ultimo beneficio ya visto por la persona.
- Si llega al menos un item nuevo, se muestra un modal una sola vez por beneficio.
- Si la respuesta trae varios items, por ahora el frontend usa solo el primero.

## Recomendaciones de implementacion backend
- Resolver `publishedAt` desde la fecha real de publicacion o activacion pública del beneficio.
- Garantizar orden descendente por `publishedAt`.
- Mantener la forma del item alineada al contrato actual de `/catalog` para reducir mapeos extras.
- Servir `imageUrl` publica y cacheable si existe material grafico.

## Criterio de aceptacion
- Con `since` anterior a la publicacion mas reciente, el endpoint devuelve al menos un item.
- Con `since` igual o posterior a la ultima publicacion, el endpoint devuelve `items: []`.
- El frontend puede renderizar el modal sin hacer una consulta adicional a detalle.
