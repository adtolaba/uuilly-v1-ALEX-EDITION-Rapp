# 07. Centralized Intelligence & Persistent Memory 🧠

Uuilly is designed to be the "Central Brain" for your AI agents. This guide explains how to manage system-wide AI credentials and how the Persistent Memory system works.

---

## 🔑 Centralized AI Keys

Uuilly uses a centralized credential management system. Instead of configuring API keys for each system function (like auto-titling), you manage an inventory of keys in the **AI Keys** tab of the Admin Panel.

### Key Features:
-   **Multiple Providers**: Support for OpenAI, Google Gemini, and Mistral AI.
-   **Alias/Names**: Assign friendly names to keys (e.g., "Personal OpenAI", "Company Mistral") to easily distinguish between multiple accounts.
-   **Task Assignment**: Define which keys are authorized for specific tasks:
    -   `titling`: Used for generating conversation titles.
    -   `extraction`: Used for the autonomous extraction of user facts (Persistent Memory).
-   **Security**: All keys are encrypted at rest in the database using the `AGENT_AUTH_ENCRYPTION_KEY`.

---

## 🧬 Persistent Memory (Uuilly's "Learned Facts")

Persistent Memory allows Uuilly to remember important information about users across different conversations. Unlike traditional memory, it focuses on "Atomic Facts" that are injected into the agent's context.

### How it works:
1.  **Manual Learning Mode**: To teach Uuilly something new, click the **Brain icon** (🧠) next to the attachment clip. The input area will turn indigo and the system will automatically refocus on the field, indicating that Uuilly is listening specifically to learn.
2.  **Fact Consolidation**: Uuilly is smart. When you teach it something that contradicts or updates an old fact (e.g., "Actually, my name is Alberto, not Gustavo"), it will automatically **UPDATE** or **DELETE** the old information using internal IDs to ensure 100% reliability.
3.  **Real-time Feedback**: You will see a "Uuilly is learning..." indicator, followed by a **Sonner toast** confirming that "Uuilly has consolidated your memories".
4.  **Optimized Injection**: Uuilly fetches all relevant facts and prepends them to the prompt **ONLY during the first message of a new conversation**. This ensures the agent (n8n/Flowise) gets the full context immediately while keeping subsequent messages lean and efficient.

### Memory Scopes:
You can configure the scope of memory per agent in the **Agents** management tab:
-   **Individual (Per User)**: The agent only remembers facts about the specific user it's talking to. Ideal for personalized assistants.
-   **Global (Shared)**: The agent shares learned facts across all users. Ideal for community knowledge or shared company context.

---

## 🛠️ Managing Memories

Admins and **Supervisors** can manage the "learned facts" in the **Memory** tab:
-   **Configuration Accordion (Admin Only)**: Select specific API Keys, Models and customize the extraction prompt.
-   **Search & Filter**: Search through facts or filter them by a specific agent.
-   **Bulk Actions**: Select multiple facts using checkboxes to perform bulk deletions.
-   **Manual Entry**: Manually add facts to an agent's memory to "seed" its knowledge.

---

## 📁 Next Steps

Persistent Memory turns your generic agents into truly personalized assistants. Start by adding an API key in **AI Keys** and then enable memory on your favorite **Agents**! 🚀

---
Built with ❤️ for the **AI community**.
