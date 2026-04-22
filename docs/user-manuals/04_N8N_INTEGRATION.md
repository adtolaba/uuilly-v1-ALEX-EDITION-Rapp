# 04. n8n Integration Guide ➰

n8n is one of the two core engines supported by **Uuilly** for workflow automation. This guide will help you connect your n8n instance and configure your first agent.

---

## 🛠️ Configuration in Uuilly

1.  **Open the Admin Panel**: Navigate to `http://localhost:8080/admin` (or your production domain).
2.  **Create a new Agent**:
    *   **Name**: Give your assistant a name.
    *   **Type**: Select `N8N`.
    *   **Emoji**: Choose an identifying emoji.
    *   **Webhook URL**: Enter the URL of your n8n production webhook (e.g., `http://n8n:5678/webhook/your-uuid`).
3.  **Assign Tags**: Add tags to the agent to control which users can access it.

---

## 🏗️ Building your n8n Workflow

To work with Uuilly, your n8n workflow must follow a specific structure:

### 1. Webhook Input
Use a **Webhook Node** with the following settings:
*   **HTTP Method**: `POST`
*   **Path**: A unique UUID or descriptive name.
*   **Response Mode**: `When Last Node Finishes`.

### 2. Processing
Uuilly sends a JSON payload to your webhook:
```json
{
  "message": "The user's text",
  "history": [ ... ],
  "thread_id": "unique-conversation-id",
  "attachments": [ ... ]
}
```

### 3. Response Output
Your workflow **must** return a JSON object with a `text` property:
```json
{
  "text": "The response from your AI agent."
}
```

---

## 📦 Starter Template

We provide a pre-configured template to help you get started quickly:
-   **[Uuilly_Starter_Template_n8n.json](../../n8n/templates/Uuilly_Starter_Template_n8n.json)**: Includes basic input processing and a formatted response.

---

## 🚀 Scaling with Queue Mode

Uuilly is configured to run n8n in **Queue Mode**. This means:
*   **`uuilly-n8n`**: Handles the UI and API.
*   **`uuilly-n8n-worker`**: Handles the actual execution of workflows.
*   **Redis**: Acts as the broker between them.

If you have many simultaneous users, you can scale the number of workers without affecting the main interface.

---
Built with ❤️ for the **AI community**.
