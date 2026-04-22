# 06. Custom Flows Guide 🛠️

Uuilly is highly flexible. This guide provides advanced tips for building custom flows in n8n and Flowise that take full advantage of Uuilly's features.

---

## 📁 Handling Attachments

When a user uploads a file in Uuilly, the platform sends the file information to your flows.

### In n8n
The `attachments` array in the JSON payload contains:
-   `name`: Original filename.
-   `type`: MIME type (e.g., `image/png`).
-   `url`: The internal URL where the file is hosted (e.g., `http://uuilly-backend:8000/api/v1/storage/...`).

You can use an **HTTP Request** node inside n8n to download the file using the provided `url`.

---

## 💬 Managing History

Uuilly automatically manages conversation history in its own database, but also passes the `history` array to your flows.

### Structure of `history`:
```json
[
  { "role": "user", "content": "Hello!" },
  { "role": "assistant", "content": "Hi there! How can I help?" }
]
```
You can pass this array directly to a **Memory** node in Flowise or an **AI Agent** node in n8n to maintain context.

---

## ⚡ Real-time Streaming

If you are using Flowise, Uuilly supports **Streaming**. To enable it:
1.  Configure your Flowise agent to support streaming (e.g., in the LLM node settings).
2.  Enable the **Streaming** switch in the Uuilly Admin Panel for that agent.

Uuilly will use WebSockets to display the agent's response word-by-word as it is generated.

---

## 🛡️ Secure Headers

If your n8n or Flowise instances are protected by authentication, you can configure **Custom Headers** in the Uuilly Admin Panel. These headers will be sent with every request from Uuilly to your flow.

Common use case: `Authorization: Bearer your-api-key`.

---
Built with ❤️ for the **AI community**.
