# Paso a paso Railway, Windows y Postman

Documento preparado el 24 de abril de 2026 antes de las 14:30 hrs.

## 1. Objetivo

Esta guia explica desde cero que debe ajustarse en Railway y como probar desde Windows usando Postman.

## 2. Variables que deben existir en Railway

En el servicio backend de Railway deben estar al menos:

```env
INTEGRATION_JWT_AUDIENCE=api_tj
INFORMATICA_JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----
INFORMATICA_JWT_KID=unidad_informatica-current
INFORMATICA_ALLOWED_SCOPES=["cardholders.lookup","beneficiarios.staging.create"]
INFORMATICA_IP_ALLOWLIST=[]
```

Tambien deben existir las variables base del backend:

- `JWT_SECRET`
- `CURP_HASH_SECRET`
- `FIELD_ENCRYPTION_KEY`
- variables de conexion a MySQL

## 3. Generar llaves en Windows sin OpenSSL

Desde este repo:

```powershell
cd "C:\Users\Participacion IPJ\Documents\GitHub\API_TJ"
npm.cmd run keygen:integration -- unidad_informatica generated-keys unidad_informatica-current
```

Archivos generados:

- `generated-keys/unidad_informatica_private.pem`
- `generated-keys/unidad_informatica_public.pem`
- `generated-keys/unidad_informatica_railway.env.txt`

## 4. Cargar configuracion en Railway

1. Abre Railway.
2. Entra al proyecto del backend.
3. Abre el servicio de la API.
4. Entra a `Variables`.
5. Copia el contenido necesario desde `generated-keys/unidad_informatica_railway.env.txt`.
6. Guarda cambios.
7. Haz redeploy del servicio.

## 5. Que revisar en logs

En el arranque deberia aparecer una linea similar a:

```text
Cliente de integracion listo: unidad_informatica (unidad_informatica-current)
```

Si aparece que el bootstrap fue omitido, la llave publica no quedo bien configurada.

## 6. Generar token para Postman

### Token para lookup

```powershell
npm.cmd run token:integration -- generated-keys/unidad_informatica_private.pem unidad_informatica unidad_informatica-current cardholders.lookup api_tj 5m
```

### Token para staging

```powershell
npm.cmd run token:integration -- generated-keys/unidad_informatica_private.pem unidad_informatica unidad_informatica-current beneficiarios.staging.create api_tj 5m
```

## 7. Importar Postman

Importar:

- `API_TJ_USI_production.postman_collection.json`
- `API_TJ_USI_production.postman_environment.json`

Luego:

1. Selecciona el environment `API_TJ USI Production`.
2. Pega el token en `integrationToken`.
3. Corre primero la carpeta `01 Lookup validados`.

## 8. Flujo de prueba recomendado

1. `Lookup FEFA090821MSPLLNA5`
2. `Lookup HEES090305MSPRLLA0`
3. `Lookup BAHC090421MSPTRNA4`
4. `Lookup HEHI090906MNLRRSA2`
5. `Lookup inexistente controlado`
6. Cambiar a token con scope de staging
7. `Crear staging valido`
8. `Crear staging duplicado`
9. `Crear staging invalido`

## 9. Consideraciones por capa gratuita

- Railway puede tardar un poco en la primera llamada por cold start.
- Despues de editar variables, siempre redeploy.
- No conviene usar allowlist IP si el origen no tiene IP fija.
- Si el token expira, genera uno nuevo.

## 10. Resultado esperado si todo esta bien

- `health` responde `200`
- lookup responde `200` para las CURP validadas
- lookup responde `404` para una CURP inexistente
- staging responde `202` cuando el token y payload son correctos
