# 02. Docker Deployment Guide 🚀

Uuilly is designed to be easily deployed using **Docker Compose**. This ensures that all components (Frontend, Backend, Database, n8n, Flowise, and Nginx) work perfectly together in an isolated environment.

---

## 🏗️ Multi-Layer Orchestration

Uuilly uses a layered Docker Compose setup to separate development from production:

1.  **`docker-compose.yml`**: Base architecture (Common to all environments).
2.  **`docker-compose.override.yml`**: **(Development)** Includes hot-reload, volume mounts for code, and Adminer.
3.  **`docker-compose.prod.yml`**: **(Production)** Includes restart policies, resource limits, and minimal "clean" images.

---

## 🛠️ Step-by-Step Deployment

### 1. Configure your Environment
Make sure you have followed the **[01. Environment Configuration Guide](./01_ENV_CONFIGURATION.md)** and created your `.env` file.

### 2. Launch (Development)
By default, Docker Compose uses the `override` file for a seamless development experience:
```bash
docker-compose up -d --build
```

### 3. Launch (Production-like)
To simulate or deploy in a production state locally:
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

### 4. Verify Status
Check that all services are up and healthy:
```bash
docker-compose ps
```
You should see `uuilly-backend`, `uuilly-n8n`, `uuilly-n8n-worker`, `uuilly-flowise-worker`, etc.

---

## 📈 Scaling Workers (Horizontal Scaling)

One of Uuilly's most powerful features is the ability to scale your execution engine. If you notice that n8n or Flowise are slow under heavy load, you can add more workers.

### Scale n8n Workers
To run 3 workers instead of 1:
```bash
docker-compose up -d --scale n8n-worker=3
```

### Scale Flowise Workers
To run 2 Flowise workers:
```bash
docker-compose up -d --scale flowise-worker=2
```

---

## 🔍 Service Access Points

-   **Frontend**: `http://localhost:8080`
-   **n8n (Main UI)**: `http://localhost:5678`
-   **Flowise (Main UI)**: `http://localhost:3001`
-   **Adminer (DB - Dev Only)**: `http://localhost:8082`

---

## ⚙️ Common Management Commands

| Action | Command |
| :--- | :--- |
| **View All Logs** | `docker-compose logs -f` |
| **Check Worker Logs** | `docker logs uuilly-n8n-worker` |
| **Verify Image Hygiene** | `docker run --rm uuilly-backend:prod ls -la /app` |
| **Execute in Backend** | `docker exec -it uuilly-backend bash` |

---

## ✅ Initial Verification

Populate the database with initial data:
```bash
docker-compose exec backend python seed.py
```

---

## 📁 Next Steps

Now that your platform is running, proceed to **[03. VPS Deployment Guide](./03_DEPLOYMENT_VPS.md)** if you are ready to go live! ☁️

---
Built with ❤️ for the **AI community**.
