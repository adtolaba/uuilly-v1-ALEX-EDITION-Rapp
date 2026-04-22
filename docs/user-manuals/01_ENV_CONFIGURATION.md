# 01. Environment Configuration Guide ⚙️

Setting up your environment variables correctly is the most important step to get **Uuilly** running smoothly. This guide explains every variable found in your `.env` file.

---

## 📋 Getting Started

1.  **Locate the Example**: In the root directory, find `env.example`.
2.  **Create your .env**: Copy it to a new file named `.env`.
    ```bash
    cp env.example .env
    ```
3.  **Edit the values**: Open `.env` in your favorite editor and fill in the details.

---

## 🗄️ Database Configuration

Uuilly uses PostgreSQL 18 with high-concurrency connection pooling via PgBouncer.

-   **`DB_HOST`**: The hostname of your database (usually `postgres` when using Docker).
-   **`DB_PORT`**: The database port (default `5432`).
-   **`DB_USER`**: Your database username (default `postgres`).
-   **`DB_PASSWORD`**: A strong password for your database.
-   **`UUILLY_DB_NAME`**: The name of the main Uuilly database.
-   **`N8N_DB_NAME`**: The database name for n8n integration.
-   **`FLOWISE_DB_NAME`**: The database name for Flowise integration.
-   **`DATABASE_URL`**: The connection string used by Prisma.
    -   *Format*: `postgresql://user:password@host:port/dbname?schema=public`

---

## 🧠 Messaging & Caching (Redis)

Uuilly uses Redis as a message broker to handle asynchronous tasks and distributed execution.

-   **`REDIS_HOST`**: Hostname for the Redis service (default `redis`).
-   **`REDIS_PORT`**: Redis port (default `6379`).

---

## ➰ n8n & Flowise Queue Mode

To handle heavy AI workloads, Uuilly runs n8n and Flowise in **Queue Mode**.

### n8n Configuration
-   **`EXECUTIONS_MODE`**: Must be set to `queue`.
-   **`QUEUE_BULL_REDIS_HOST`**: Set to `redis`.
-   **`QUEUE_BULL_REDIS_PORT`**: Set to `6379`.
-   **`N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS`**: Set to `false` for Docker compatibility.

### Flowise Configuration
-   **`FLOWISE_MODE`**: Must be set to `queue`.
-   **`FLOWISE_REDIS_URL`**: `redis://redis:6379`

---

## 🔐 Security & Authentication

### JWT Secret Key
Used to sign and verify session tokens.
-   **`JWT_SECRET_KEY`**: A long, random string.
-   **Generate one**: `openssl rand -hex 32`

### Agent & AI Credential Encryption
Uuilly encrypts your AI agents' API keys and the **Centralized AI Credentials** (OpenAI, Gemini, etc.) using AES-256 (Fernet).
-   **`AGENT_AUTH_ENCRYPTION_KEY`**: A Fernet-compatible key.
-   **Generate one**: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`
-   ⚠️ **WARNING**: If you lose this key, you will not be able to decrypt or use saved agent credentials or system-wide AI keys!

---

## 🌐 Google OAuth 2.0 (Optional)

To enable "Login with Google", you need to create a project in the [Google Cloud Console](https://console.cloud.google.com/).

1.  Go to **APIs & Services > Credentials**.
2.  Create an **OAuth 2.0 Client ID**.
3.  Set the Authorized Redirect URI to: `http://localhost:8080/api/v1/auth/google/callback` (adjust the domain for production).
4.  Copy these into your `.env`:
    -   **`GOOGLE_CLIENT_ID`**
    -   **`GOOGLE_CLIENT_SECRET`**

---

## 👥 User Bootstrap (Auto-provisioning)

You can pre-load users (like an admin) automatically when the backend starts. Use the pattern `USER_{n}_...` where `n` is a unique number.

-   **`USER_1_EMAIL`**: The email address for the first user.
-   **`USER_1_PASSWORD`**: Initial password.
-   **`USER_1_ROLE`**: `ADMIN`, `SUPERVISOR`, or `USER`.
-   **`USER_1_FIRST_NAME`**: First name.
-   **`USER_1_LAST_NAME`**: Last name.

---

## 🔗 Server URLs

-   **`PUBLIC_SERVER_URL`**: The URL used by the frontend to reach the backend (e.g., `http://localhost:8080` or `https://yourdomain.com`).
-   **`INTERNAL_SERVER_URL`**: The internal Docker network URL (usually `http://uuilly-backend:8000`).

---

## 📁 Next Steps

Now that your environment is configured, proceed to **[02. Docker Deployment](./02_DEPLOYMENT_DOCKER.md)** to launch the platform! 🚀

---
Built with ❤️ for the **AI community**.
