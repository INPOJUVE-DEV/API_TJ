# Docs 4 USI

Documento preparado el 24 de abril de 2026 antes de las 14:30 hrs.

Paquete de entrega para la Unidad de Informatica sobre la integracion de `API_TJ` en produccion.

Base validada:

- URL: `https://apitj-production.up.railway.app/api/v1`
- Cliente: `unidad_informatica`
- Endpoints permitidos:
  - `POST /cardholders/lookup`
  - `POST /beneficiarios-staging`

## Archivos incluidos

- `manual_postman_produccion_usi.md`
- `paso_a_paso_railway_windows_postman.md`
- `validacion_produccion_2026-04-24.md`
- `API_TJ_USI_production.postman_collection.json`
- `API_TJ_USI_production.postman_environment.json`
- `payload_lookup.json`
- `payload_lookup_missing.json`
- `payload_staging_ejemplo.json`
- `payload_staging_invalido.json`

## Lo que ya quedo validado

Al corte del 24 de abril de 2026 antes de las 14:30 hrs, se deja documentado que:

1. `GET /health` responde `200`.
2. El JWT RS256 de `unidad_informatica` autentica correctamente en Railway.
3. `lookup` responde `200` para las CURP de prueba entregadas por ustedes.
4. `beneficiarios-staging` responde `202` con token y scope correctos.

Las evidencias estan en `validacion_produccion_2026-04-24.md`.

## Respuesta corta

Si, se puede probar desde Postman contra Railway si:

1. Railway tiene registrada la llave publica correcta.
2. El token fue firmado con la llave privada correcta.
3. El JWT usa `kid`, `iss`, `sub`, `aud`, `jti` y `scope` validos.
4. El scope corresponde al endpoint que se esta invocando.

## Uso recomendado

1. Leer `paso_a_paso_railway_windows_postman.md`.
2. Importar la coleccion y el environment.
3. Generar un JWT con los scripts Node de este repo o desde la API propia de USI.
4. Ejecutar primero los lookups validados.
5. Ejecutar staging solo con un token nuevo y scope `beneficiarios.staging.create`.

## Importante

- Esta carpeta no incluye endpoints administrativos internos.
- Postman no genera tokens por si solo en este paquete.
- La llave privada nunca debe subirse a Railway ni a Git.
