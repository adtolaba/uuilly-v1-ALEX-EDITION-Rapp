# 05. Flowise Integration Guide 🦜

Flowise is the second core engine supported by **Uuilly**, specializing in visual LLM orchestration. This guide will help you connect your Flowise instance and configure your AI agents.

---

## 🛠️ Configuration in Uuilly

1.  **Open the Admin Panel**: Go to the **Agents** section.
2.  **Create a new Agent**:
    *   **Type**: Select `FLOWISE`.
    *   **Host**: Enter your Flowise internal URL (default: `http://flowise:3001`).
    *   **Flow ID**: The UUID of your specific flow from the Flowise URL.
3.  **Streaming**: Enable this if your flow supports real-time token output.

---

## 🏗️ Flowise Setup

For the best experience with Uuilly, we recommend the following:

*   **Database**: Uuilly is pre-configured to use PostgreSQL for Flowise, ensuring your chat history and flows are persistent.
*   **API Keys**: If your flow requires an API Key (e.g., OpenAI), you can configure it directly in Flowise or pass it via headers from Uuilly.

---

## 🚀 Scaling with Workers

Uuilly uses a distributed architecture for Flowise:
*   **`uuilly-flowise`**: The main server for UI and API.
*   **`uuilly-flowise-worker`**: A dedicated process for executing heavy AI predictions.

This separation ensures that the UI remains responsive even when complex LLM chains are being processed in the background.

---
Built with ❤️ for the **AI community**.
