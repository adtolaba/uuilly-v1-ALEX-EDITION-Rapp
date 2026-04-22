# Database Connection Guide (Postgres 18 Multi-DB)

Following the migration to PostgreSQL 18, the database architecture has been isolated into three distinct databases within the same instance. This guide provides the internal connection details for external tools.

## 1. Primary Application (uuilly)
- **Database Name:** `uuilly_db`
- **Managed by:** Prisma (Backend)
- **Vector Search:** Disabled (Standard relational data only)
- **Internal URL:** `postgresql://postgres:postgres@postgres:5432/uuilly_db?schema=public`

## 2. Automation (n8n)
- **Database Name:** `n8n_db`
- **Vector Search:** **Enabled** (`pgvector` extension)
- **Connection Parameters:**
    - **Host:** `postgres`
    - **Port:** `5432`
    - **Database:** `n8n_db`
    - **User:** `postgres`
    - **Password:** `postgres`
- **Internal URL:** `postgresql://postgres:postgres@postgres:5432/n8n_db`

## 3. AI Workflows (Flowise)
- **Database Name:** `flowise_db`
- **Vector Search:** **Enabled** (`pgvector` extension)
- **Connection Parameters:**
    - **Host:** `postgres`
    - **Port:** `5432`
    - **Database:** `flowise_db`
    - **User:** `postgres`
    - **Password:** `postgres`
- **Internal URL:** `postgresql://postgres:postgres@postgres:5432/flowise_db`

## Important Notes:
- **Port Exposure:** Port 5432 is NOT exposed to the host machine for security. All connections must happen through the `uuilly-network`.
- **Initialization:** Databases are automatically created upon container startup via `init.sql`.
- **Vector Extension:** If you need to verify the extension manually:
  ```sql
  \c n8n_db
  SELECT * FROM pg_extension WHERE extname = 'vector';
  ```
