# Changelog - Uuilly

All notable changes to this project will be documented in this file.

## [1.6.2] - 2026-04-14 (Robust Multi-Provider Memory Atomization)
### Fixed
- **Multi-Provider Compatibility:** Resolved a critical bug where memory atomization failed when using OpenAI or Gemini. The system now correctly extracts and persists facts across all supported providers (OpenAI, Gemini, Mistral).
- **Configuration Crossover Fix:** Corrected a logic error in `IntelligenceService` that caused 404 errors by mispairing providers with incompatible models from global settings. Credentials now strictly enforce provider-model alignment.
- **Robust Fact Parsing:** Implemented a new regex-based, case-insensitive parser for memory commands (`FACT::`, `UPDATE::`, `DELETE::`). This ensures successful extraction even when LLMs include Markdown formatting (bullets, bolding) or preambles.
- **Raw Data Atomization:** Enhanced the mass-knowledge atomization logic to successfully extract facts even from LLM responses that omit explicit command prefixes.

### Changed
- **Improved Memory Quality:** Updated the `DEFAULT_MEMORY_PROMPT` to explicitly instruct the LLM to rephrase facts in the third person ("The user..."), resulting in more natural and professional context injection.
- **Increased Stability:** Extended LLM API timeouts to 30 seconds and increased the token limit for memory extraction to 1000 to prevent truncated responses or connection failures during complex tasks.
- **Test Suite Enhancements:** Added a comprehensive test suite for `IntelligenceService` covering Markdown formatting, token limits, and case-insensitivity, ensuring long-term reliability.

## [1.6.1] - 2026-03-12 (Independent AI Configuration for Titling & Memory)
### Added
- **Independent Task Configuration:** Titling and Memory Extraction now have completely separate settings in the database. You can use different providers, models, and credentials for each task without conflict.
- **Unified Configuration Flow:** Standardized the setup experience in both Admin panels using a three-step flow: Provider selection -> Credential selection (filtered by task) -> Model selection.
- **Model Refresh Capability:** Added a manual "Refresh" button to re-fetch available models for the selected credential in both panels.

### Changed
- **Database Schema Evolution:** Updated `SystemSettings` model to include `titling_llm_provider`, `memory_extraction_provider`, and `active_titling_cred_id`, decoupling them from legacy generic fields.
- **Intelligence Service Refactor:** Optimized `get_active_credential` to prioritize task-specific settings, ensuring the correct API key and model are used for each system operation.
- **UI Consistency:** Aligned the `MemoryManagement` panel aesthetics and interaction patterns with the `AutoTitlesSettings` panel for a cohesive administrative experience.

### Fixed
- **Settings Persistence Bug:** Resolved an issue where AutoTitles credentials were not being persisted correctly due to a missing field in the database schema.
- **Prompt Reset Endpoints:** Fixed return logic and sensitive data masking (API keys) in the backend endpoints for resetting system prompts.
- **Form Synchronization:** Implemented `useAICredentials` hook integration in Memory Management to ensure real-time updates when keys are added or modified.

## [1.6.0] - 2026-03-12 (React Codebase Optimization & Stability)
### Added
- **TanStack Query (React Query) Integration:** Standardized all data fetching using `useQuery` and `useMutation`. Implemented automatic caching, background refetching, and standardized loading/error states across the frontend.
- **Dedicated Fetching Hooks:** Created reusable hooks (`useAgents`, `useAICredentials`, `useDashboardStats`, `useUsers`, `useSettings`) to decouple business logic from UI components.
- **React Query Devtools:** Added developer tools for real-time cache and query monitoring.

### Changed
- **Architectural Refactor (Giant Components):** Split monolithic components into focused sub-components to improve maintainability:
    - `AgentForm.jsx` decomposed into `AgentGeneralInfo`, `AgentMemoryConfig`, and `AgentLLMSettings`.
    - `Sidebar.jsx` decomposed into `SidebarHeader` and `ConversationList`.
- **Modern State Management:** Refactored `AutoTitlesSettings.jsx` to use the `useReducer` hook for cleaner complex state transitions.
- **Test Suite Modernization:** Updated the entire Vitest suite to support TanStack Query and the new component architecture (100% pass rate).

### Fixed
- **Critical Accessibility (A11y):** Resolved "label-has-associated-control" warnings by ensuring all form inputs have properly linked IDs and labels.
- **Keyboard Navigation:** Added focus-within logic to the sidebar to ensure chat action menus are accessible to keyboard users.
- **Codebase Hygiene:** Removed dead code components (`ActiveCursor.jsx`, `TypingIndicator.jsx`) identified by automated audits.

## [1.5.0] - 2026-03-09 (Global Backup, Restore & Secure Reset)
### Added
- **Global Configuration Backup:** Administrators can now export the entire system state (Agents, AI Keys, Users, Memory) into a single JSON file.
- **Smart Merge Import:** New restoration logic that allows merging backup data with the current database. Supports a global "Overwrite" toggle to update existing records or only add new ones.
- **Secure System Reset (Danger Zone):** Added a powerful feature to wipe all system data while strictly preserving Admin accounts.
- **Double-Lock Safety System:** The Danger Zone is protected by a two-step verification: a text-based unlock (`DANGER ZONE`) and a final confirmation word (`RESET`).
- **Action History & Audit Log:** Detailed tracking of all backup, import, and reset operations, visible in the new Admin tab.
- **New User Manual:** Added "Backup & Restore Guide" to the official documentation.

### Fixed
- **Foreign Key Violations on Reset:** Optimized the deletion order to handle relational constraints between agents, tags, and memories during system wipes.
- **Import Validation Errors:** Implemented data sanitization to strip internal relation fields (conversations, messages) from backup entities before database insertion.
- **UI Nesting Warnings:** Fixed invalid HTML DOM nesting in AlertDialog components to ensure accessibility and hydration stability.
- **File Input Readability:** Improved the "Select File" button visibility in dark mode using custom Tailwind modifiers.

### Changed
- **Admin Panel Structure:** Added a dedicated "Backup" tab for administrators.
- **Dependency Update:** Added `@radix-ui/react-label` to support standard shadcn/ui forms.

## [1.4.0] - 2026-03-09 (Secure WebSocket Auth & Reliability)
### Added
- **First-Message WebSocket Authentication:** Tokens are no longer exposed in the connection URL. The client now authenticates via a secure JSON message immediately after connecting.
- **WebSocket Health Monitoring:** Real-time connection status indicator added to the Admin Dashboard ("Quick Insights"), allowing administrators to verify communication health at a glance.
- **Robust Reconnection Strategy:** Implemented exponential backoff (1s to 30s) in the frontend to gracefully handle server restarts or network micro-cuts.
- **Backend Heartbeat (Ping/Pong):** New mechanism to keep WebSocket connections alive and detect "silent" disconnects through proxies or firewalls.
- **Multi-Connection Support:** The backend now correctly handles multiple active WebSocket sessions for the same user simultaneously.

### Changed
- **WebSocket Endpoint Refactor:** Migrated from individual user paths (`/ws/{user_id}`) to a single, unified, and secure `/ws` endpoint.
- **Improved UI Stability:** Refactored React effects to prevent unnecessary connection/disconnection loops caused by state updates.
- **Backend Connection Manager:** Optimized to track both unauthenticated and authenticated connections independently for better security enforcement.

## [1.3.0] - 2026-03-08 (Interactive Message Correction & WYSIWYG Editor)
### Added
- **Interactive Agent Message Correction:** Users can now refine the agent's last response using a dedicated edit button (Pencil icon).
- **TipTap WYSIWYG Editor:** Integrated a modern, Markdown-friendly editor for seamless message refinement with formatting support (Bold, Italics, Lists, Headings).
- **Streaming Correction Flow:** Edits trigger a new streaming acknowledgement from the agent, maintaining a natural conversation flow.
- **Auto-Cleanup Logic:** Previous confirmation messages are automatically deleted from the UI and Database during re-edits to keep the history clean.
- **New API Endpoints:** Added `PUT` and `DELETE` endpoints for message management with ownership validation.
- **Chat Interaction Guide:** Comprehensive new user manual covering advanced chat features.

### Changed
- **Bubble Actions Refactor:** Replaced the three-dot menu with direct, intuitive icons for 'Copy' and 'Edit'.
- **Enhanced ID Sync:** WebSocket broadcasts now include reliable message and conversation IDs to prevent UI state inconsistencies.
- **Optimized Processing Indicator:** The "Thinking" indicator now persists correctly across both normal messages and corrections until the agent begins responding.

## [1.2.0] - 2026-03-06 (Role-Based Access Control & Guest Passwords)
### Added
- **Supervisor Role:** New intermediary role between User and Admin. Supervisors can manage regular users and edit memories but cannot access system settings, AI keys, or manage administrators.
- **Optional Guest Passwords:** Administrators can now assign manual passwords to any user. This allows accounts to log in via both traditional password methods and Google OAuth.
- **Restricted Admin View:** Tailored dashboard and sidebar for Supervisors, hiding sensitive configuration tabs.
- **Improved User Management:** Enhanced form with role assignment and optional password fields (Admin only).

### Changed
- **Database Schema:** Migrated user roles from strings to a native Enum (`USER`, `SUPERVISOR`, `ADMIN`) for better integrity.
- **JWT Security:** Tokens now include the user role, enforced by centralized FastAPI dependencies.
- **Frontend Permission Logic:** Conditional rendering across the Admin Panel to ensure UI consistency with backend permissions.

## [1.1.0] - 2026-03-05 (Persistent Memory & Central Intelligence)
### Added
- **Manual Learning Mode:** Users can explicitly teach assistants new facts via a dedicated "Brain" button (🧠) in the chat.
- **Fact Consolidation:** Uuilly now handles memory updates and deletions intelligently, avoiding duplicate or contradictory records.
- **Bulk Memory Management:** Admins can select and delete multiple facts at once in the Admin Panel.
- **Centralized AI Credentials:** New "AI Keys" inventory to manage multiple API keys (OpenAI, Gemini, Mistral) with friendly names and task authorization.
- **Memory Scopes:** Support for Individual (per user) or Global (shared) memory per agent.
- **Real-time Feedback:** Animated learning indicators and Sonner toast notifications for memory events.
- **Configuration Accordion:** New collapsible settings for memory extraction (model, provider, custom prompts).

### Changed
- **Admin UI Redesign:** Reorganized Admin Panel with modular tabs for 'AI Keys', 'Auto Titles', and 'Memory'.
- **Optimized Context Injection:** Memory facts are now injected only at the beginning of conversations to save tokens and improve speed.
- **Auto-Titling Refactor:** Migrated to use the centralized credential system with dynamic model selection.
- **Robustness:** Added silent error handling for memory injection to ensure core chat functionality is never blocked.

## [1.0.0] - 2026-03-05 (Production-Ready Infrastructure)
### Added
- **Redis Integration:** Added Redis 7 as a central message broker for the entire stack.
- **n8n Queue Mode:** Split n8n into `n8n` and `n8n-worker` for distributed execution.
- **Flowise Queue Mode:** Split Flowise into `flowise` and `flowise-worker` for asynchronous AI predictions.
- **Multi-layer Orchestration:** Restructured Docker Compose into base, development (override), and production layers.
- **Production Hygiene:** Implemented Multi-stage Docker builds and specialized `.dockerignore` to ensure minimal, secure production images.
- **Resource Management:** Defined CPU/Memory limits and restart policies for all services in production.
- **English Documentation:** Full translation of all user manuals and README.

### Changed
- **Environment Management:** Centralized all infrastructure variables in `.env` and `env.example`.
- **Backend Dockerfile:** Refactored to support multi-stage builds (base, builder, development, production).
- **Test Infrastructure:** Standardized imports and paths to support execution within orchestrated containers.

## [0.9.0] - 2026-03-04 (Pre-Production Milestone)
### Added
- **Intelligent Conversation Titling:** Automatic descriptive titles generated using LLM (OpenAI/Gemini/Mistral).
- **Robust Authentication:** Full JWT-based flow with Google OAuth 2.0 integration and whitelist control.
- **Agent Identity & Customization:** Optional emoji icons for agents and unified "Uuilly" brand identity.
- **Advanced Multimedia Support:** File attachments via drag-and-drop or clipboard (screenshots).
- **Conversation Management:** Historical thread persistence and export in .txt and .md formats.
- **Modern Admin Panel:** Dynamic Agent Management (CRUD) and global LLM configuration.
- **1080p UI Optimization:** Dedicated scaling for high resolutions (1920x1080).
- **High Performance Infrastructure:** PostgreSQL 18 with Multi-DB isolation and PgBouncer.

### Changed
- **Database Architecture:** Migrated from SQLite to a unified PostgreSQL + Adminer ecosystem.
- **UI Unification:** Shifted to a "Soft & Modern" aesthetic using Geist Sans and shadcn/ui.

---
Built with ❤️ for the **AI community**.
