# Tutorial de Onboarding: Backend Tarjeta Joven

El presente documento constituye la guía técnica inicial para la configuración y ejecución local del entorno Backend correspondiente al sistema Tarjeta Joven.

**Nota de Seguridad (Conformidad ISO 27001):** Este sistema procesa datos personales e información sensible. Los procedimientos de desarrollo deben sujetarse a las normativas de confidencialidad y control de acceso establecidas. Queda estrictamente prohibida la exposición o inyección de datos reales en entornos locales o de desarrollo.

## 1. Clonado y preparación inicial

El código fuente del proyecto debe extraerse en el entorno local designado. Para el correcto funcionamiento de los entornos virtualizados, es requerido el siguiente software en la estación de trabajo:
- Node.js (versión 22 o superior).
- Docker Engine / Docker Desktop (para la virtualización de la base de datos MySQL y la API en contenedores).

## 2. Configuración del entorno (.env)

En el directorio raíz del proyecto, es indispensable crear un archivo `.env` configurado para el entorno de desarrollo. A continuación se detallan los parámetros estandarizados de prueba:

```ini
# Configuración global
PORT=8080
FRONTEND_ORIGIN=http://localhost:3000
NODE_ENV=development

# Base de datos (Entorno de contenedores Docker)
DB_HOST=db
DB_PORT=3306
DB_USER=usuario
DB_PASSWORD=password
DB_NAME=tarjeta_joven

# Seguridad JWT (Exclusivo para desarrollo)
JWT_SECRET=secreto_desarrollo_temporal
JWT_EXPIRATION=15m

# Variables de Negocio
OTP_DEBUG=true
EXPOSE_PII=false
```

## 3. Despliegue mediante Docker Compose

La orquestación de la base de datos y la aplicación se encuentra estructurada formalmente en el archivo `docker-compose.yml`.

1. Inicie los servicios en segundo plano ejecutando:
   ```bash
   docker compose up -d --build
   ```

2. Valide el estado de ejecución y salud de los contenedores (`api` y `db`):
   ```bash
   docker compose ps
   ```

## 4. Inyección de datos (Seeding)

Para facilitar el desarrollo, el sistema incluye un proceso automatizado que estructura los esquemas de tablas e inyecta parámetros de prueba (orientados a la región geográfica de San Luis Potosí).

Revisando que los contenedores se encuentren activos, ejecute:

```bash
docker compose exec api npm run seed
```

El script reportará de forma secuencial la finalización del poblamiento de locaciones, validación de credenciales de usuarios predeterminados, listado de beneficios y asignación de titulares de tarjetas.

## 5. Ejecución e Integración

La API estará operando sobre el puerto asignado y será accesible mediante la red interna en `http://localhost:9080`. Se recomienda utilizar como material de referencia y validación el archivo adjunto `readme_postman.md`, donde se documentan a detalle las especificaciones y flujos técnicos requeridos para interrogar la API de manera estándar.
