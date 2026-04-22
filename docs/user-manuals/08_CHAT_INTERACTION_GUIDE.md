# Chat Interaction Guide 💬

This guide covers advanced interaction features within the Uuilly chat interface to help you get the most out of your agents.

## 1. Message Actions

Every agent message bubble includes quick actions visible on hover (or persistent while a menu is open):

*   **Copy Button:** Allows you to copy the message content as plain Text or original Markdown.
*   **Edit Button (Pencil):** Trigger the interactive correction flow (available only for the last relevant agent message).

## 2. Interactive Agent Message Correction ✏️

Uuilly allows you to refine agent responses if they are not quite what you expected. This feature uses a full WYSIWYG editor to make the process intuitive.

### How to Edit a Message:
1.  **Locate the message:** Find the agent's response you wish to correct.
2.  **Click the Pencil Icon:** A modal window will open with the **TipTap WYSIWYG Editor**.
3.  **Apply Formatting:** You can use bold, italics, lists, and headings (H1, H2) to structure the corrected response. The editor is "Markdown Friendly" and will preserve your formatting.
4.  **Save Changes:** Click "Save Changes".

### What happens next?
*   The original message bubble is updated with your new text.
*   The modal closes, and you will see the "Thinking" indicator.
*   The system sends a hidden notification to the agent with your correction.
*   The agent will respond via **streaming** acknowledging the update (e.g., "Message updated!").

### Re-editing:
If you are still not satisfied after an edit, the edit button will remain available on the corrected message, even if the agent has already sent a short confirmation response. Uuilly intelligently manages the history to ensure you can always refine the core response until it's perfect.

## 3. Attachment Support 📎

You can enrich your prompts by adding files:
*   **Drag & Drop:** Drop files directly into the chat area.
*   **Paste Screenshots:** Use `Ctrl+V` (or `Cmd+V`) to paste images directly from your clipboard.
*   **File Picker:** Use the paperclip icon to select multiple documents or images (up to 5MB per file).

## 4. Learning Mode (Persistent Memory) 🧠

If the active agent has memory enabled, you will see a **Brain Icon** in the input area.
*   **Toggle Learning Mode:** Click the brain icon to turn it on (it will pulse and show a "Learning Mode" label).
*   **Teach Uuilly:** Any message sent while this mode is active will be processed by the Central Intelligence system to extract "Atomic Facts" about you.
*   **Visual Feedback:** You will see a "Uuilly is learning..." indicator while the facts are being processed.
