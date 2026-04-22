# Guía de Despliegue en Producción (Coolify) - UUilly v1

Este documento detalla los pasos críticos y la configuración necesaria para desplegar UUilly v1 en un servidor de producción utilizando **Coolify**.

## 1. Actualización del Repositorio
Antes de iniciar, asegúrese de tener la última versión del repositorio (`git pull`). Se han aplicado correcciones críticas en la estructura de archivos y rutas de Prisma para entornos de producción.

### Cambios Clave:
- **Rutas Absolutas en Prisma:** El `Dockerfile` y `docker-entrypoint.sh` del backend ahora usan rutas explícitas (`--schema /app/prisma/schema.prisma`). Esto elimina errores de detección del esquema en plataformas automatizadas.
- **Configuración de `.dockerignore`:** Se ha añadido un archivo `.dockerignore` rastreado por Git para asegurar que la carpeta `prisma/` sea incluida en la imagen final.

---

## 2. Configuración en Coolify

### Tipo de Recurso
- Seleccione **Docker Compose** como "Build Pack".
- Copie el contenido de `docker-compose.yml` y aplique los límites de recursos de `docker-compose.prod.yml` (o use ambos si su flujo lo permite).

### Networking y Proxy
- Coolify gestiona el HTTPS mediante su propio proxy (Traefik).
- **Destination Port:** Configure Coolify para que apunte al servicio **`nginx`** en el puerto **80**.
- Su stack interno ya redirige correctamente las peticiones al frontend (puerto 3000) y al backend (puerto 8000).

### Volúmenes y Persistencia
- Los volúmenes definidos son relativos (`./postgres_data`, `./n8n_data`, etc.). Verifique que el servidor tenga permisos de escritura en el directorio de despliegue.

---

## 3. Variables de Entorno
Copie y complete las siguientes variables en la sección **"Environment Variables"** de la UI de Coolify. **No confíe en el archivo `.env` local, ya que Coolify requiere que se definan explícitamente en su panel.**

```bash
# === BASE DE DATOS ===
DB_HOST=postgres
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=            # CAMBIAR POR CONTRASEÑA SEGURA
UUILLY_DB_NAME=uuilly_db
N8N_DB_NAME=n8n_db
FLOWISE_DB_NAME=flowise_db

# URL de Conexión Prisma (Asegúrese de apuntar a pgbouncer:6432 para pooling)
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@pgbouncer:6432/${UUILLY_DB_NAME}?schema=public"

# Inicialización de Postgres
POSTGRES_USER=${DB_USER}
POSTGRES_PASSWORD=${DB_PASSWORD}
POSTGRES_DB=postgres

# === REDIS ===
REDIS_HOST=redis
REDIS_PORT=6379

# === SERVICIOS IA (Flowise / n8n) ===
FLOWISE_PORT=3001
FLOWISE_REDIS_URL=redis://redis:6379
HTTP_SECURITY_CHECK=false

# Seguridad Flowise (Obligatorio para persistencia de login)
# Generar con: openssl rand -hex 32
FLOWISE_SECRETKEY_OVERWRITE=   # REQUERIDO: Clave de encriptación de DB
FLOWISE_JWT_AUTH_TOKEN_SECRET= # REQUERIDO: Clave para JWT Tokens
FLOWISE_EXPRESS_SESSION_SECRET=# REQUERIDO: Clave para sesiones Express

EXECUTIONS_MODE=queue
QUEUE_BULL_REDIS_HOST=redis
QUEUE_BULL_REDIS_PORT=6379

# Seguridad n8n (Obligatorio para persistencia de credenciales)
# Generar con: openssl rand -hex 32
N8N_ENCRYPTION_KEY=           # REQUERIDO: Cifra tus claves de APIs
N8N_USER_MANAGEMENT_JWT_SECRET=# REQUERIDO: Firma tus sesiones de usuario

# === SEGURIDAD Y AUTH ===
# Generar claves con openssl rand -hex 32
JWT_SECRET_KEY=         # REQUERIDO
GOOGLE_CLIENT_ID=       # REQUERIDO PARA AUTH GOOGLE
GOOGLE_CLIENT_SECRET=   # REQUERIDO PARA AUTH GOOGLE
AGENT_AUTH_ENCRYPTION_KEY= # REQUERIDO (Clave Fernet AES-256)

# === URLs DE SERVIDOR ===
# Cambiar por su dominio final
PUBLIC_SERVER_URL=https://tu-dominio.com
INTERNAL_SERVER_URL=http://uuilly-backend:8000

# === USUARIOS BOOTSTRAP (Primer Inicio) ===
USER_1_EMAIL=admin@tu-empresa.com
USER_1_PASSWORD=        # CONTRASEÑA ADMIN
USER_1_ROLE=ADMIN

USER_2_EMAIL=user@tu-empresa.com
USER_2_PASSWORD=        # CONTRASEÑA USUARIO
USER_2_ROLE=USER
```

---

## 4. Resolución de Problemas Comunes

### Error: "Prisma Schema not found"
Este error ha sido mitigado con rutas absolutas. Si persiste, verifique que en el paso de "Build" de Coolify no se esté excluyendo la carpeta `backend/prisma`.

### Problemas de Conectividad entre Contenedores
Asegúrese de que todos los servicios estén en la misma red de Docker (definida en el compose como `uuilly-network`). Coolify suele manejar esto automáticamente si se usa un único Docker Compose.

### Logs
Para depurar el inicio de los servicios desde la terminal del servidor:
`docker compose logs -f backend`
