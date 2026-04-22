# Uuilly - Agnostic Chat Platform for n8n and Flowise 🚀

Uuilly is a modern, centralized chat interface designed to interact with **n8n** and **Flowise** workflows. It allows you to manage multiple agents dynamically, associate them with users via tags, and maintain a persistent conversation history.

![Architecture](https://img.shields.io/badge/Architecture-Orchestrated-blue)
![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2018-blue)
![Redis](https://img.shields.io/badge/Broker-Redis%207-red)
![License](https://img.shields.io/badge/License-Apache%202.0-green)

---

## ✨ Main Features

*   **Distributed Multi-service**: Scalable infrastructure with dedicated workers for heavy tasks.
*   **Agnostic**: Connect to any n8n or Flowise flow transparently.
*   **Agent Management (CRUD)**: Administrative panel to configure URLs, headers, and agent parameters.
*   **Authentication**: Support for traditional Login, Google OAuth 2.0 with Whitelist, and optional password assignment for guest accounts.
*   **Role-Based Access Control (RBAC)**: Defined hierarchy (Admin, Supervisor, User) to manage system visibility and security.
*   **Tagging System**: Granular access control for users and agents.
*   **Interactive Agent Message Correction**: Refine agent responses using a built-in WYSIWYG TipTap editor with real-time streaming acknowledgement.
*   **E2E Persistence**: Secure storage of conversations and attachments.
*   **Persistent Contextual Memory**: Empower your assistants by teaching them facts via a dedicated "Learning Mode" (Brain button). Facts are consolidated intelligently and injected automatically during the first message of new conversations.
*   **System AI & Centralized Keys**: Managed inventory of LLM providers for auto-titling and memory extraction.
*   **Backup & Restore**: Secure export/import of global configuration with a "Smart Merge" strategy and a double-locked "Danger Zone" for system resets.

---


## 🏗️ Infrastructure Architecture

Uuilly uses a multi-layer Docker orchestration to ensure environment parity:

1.  **Backend (FastAPI)**: The core application logic and persistence manager.
2.  **Frontend (React)**: Modern user interface built with `shadcn/ui`.
3.  **Redis**: Central message broker for asynchronous communication.
4.  **Distributed Engines**:
    *   `n8n` + `n8n-worker`: Scalable automation flows.
    *   `flowise` + `flowise-worker`: Scalable LLM orchestration.

5.  **Data Layer**: PostgreSQL 18 with PgBouncer for high concurrency.
6.  **Gateway**: Nginx as a single point of entry.

---

## 🚀 Quick Start

### Prerequisites
*   Docker and Docker Compose.

### Steps
1.  **Configure Environment**:
    ```bash
    cp env.example .env
    # Edit .env with your credentials
    ```

2.  **Launch (Development)**:
    ```bash
    docker-compose up -d --build
    ```

3.  **Launch (Production)**:
    ```bash
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
    ```

---

## 📚 Documentation and Manuals

For detailed configuration and usage guides, check our `docs/user-manuals/` folder:

1.  [Environment Configuration](./docs/user-manuals/01_ENV_CONFIGURATION.md) ⚙️
2.  [Docker Deployment](./docs/user-manuals/02_DEPLOYMENT_DOCKER.md) 🚀
3.  [VPS / Production Deployment](./docs/user-manuals/03_DEPLOYMENT_VPS.md) ☁️
4.  [n8n Integration](./docs/user-manuals/04_N8N_INTEGRATION.md) ➰
5.  [Flowise Integration](./docs/user-manuals/05_FLOWISE_INTEGRATION.md) 🦜
6.  [Custom Flows Guide](./docs/user-manuals/06_CUSTOM_FLOWS_GUIDE.md) 🛠️
7.  [Centralized Intelligence & Memory](./docs/user-manuals/07_CENTRAL_INTELLIGENCE_AND_MEMORY.md) 🧠
8.  [Chat Interaction Guide](./docs/user-manuals/08_CHAT_INTERACTION_GUIDE.md) 💬
9.  [Backup & Restore Guide](./docs/user-manuals/09_BACKUP_AND_RESTORE.md) 💾

---

## 📄 License

This project is licensed under the Apache 2.0 License. See the [LICENSE.md](LICENSE.md) file for more details.

---
Built with ❤️ for the **AI community**.
