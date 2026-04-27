# Docs 4 USI

Paquete de apoyo para que la Unidad de Informatica pruebe la integracion de API_TJ desde Postman contra produccion:

- Base URL objetivo: `https://apitj-production.up.railway.app/api/v1`
- Cliente esperado: `unidad_informatica`
- Endpoints permitidos:
  - `POST /cardholders/lookup`
  - `POST /beneficiarios-staging`

## Archivos incluidos

- `manual_postman_produccion_usi.md`
- `API_TJ_USI_production.postman_collection.json`
- `API_TJ_USI_production.postman_environment.json`
- `payload_lookup.json`
- `payload_staging_ejemplo.json`
- `payload_staging_invalido.json`

## Respuesta corta

Si, se puede probar desde Postman contra `https://apitj-production.up.railway.app/`, pero solo si:

1. El backend de API_TJ ya tiene registrada la llave publica del cliente `unidad_informatica`.
2. El JWT RS256 que pegues en Postman fue firmado con la llave privada correcta.
3. El token usa `kid`, `iss`, `sub`, `aud`, `jti` y `scope` validos.
4. El scope corresponde al endpoint que vas a invocar.

Si falla en produccion:

- `401` suele indicar token invalido, `kid` incorrecto, llave no registrada, `aud` incorrecto o `jti` reutilizado.
- `403` suele indicar scope insuficiente.
- `422` suele indicar payload invalido.

## Importacion rapida

1. Importa la coleccion `API_TJ_USI_production.postman_collection.json`.
2. Importa el environment `API_TJ_USI_production.postman_environment.json`.
3. Pega un JWT valido en la variable `integrationToken`.
4. Ejecuta primero `Lookup existente` o `Lookup inexistente`.
5. Si el lookup responde `404`, usa `Crear staging valido`.

## Importante

- Esta carpeta esta pensada para pruebas manuales de USI.
- No incluye endpoints administrativos internos.
- No genera tokens dentro de Postman; el JWT debe venir de una API propia, script externo o proceso controlado por USI.
