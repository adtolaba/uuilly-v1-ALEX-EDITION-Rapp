# Global Configuration Backup & Restore 💾

Uuilly provides a robust system for backing up your global configuration, restoring it when needed, and performing secure system resets. These features are exclusive to the **Admin** role.

## 1. Accessing the Backup Panel
1. Log in as an **Admin**.
2. Navigate to the **Admin Panel**.
3. Select the **Backup** tab.

---

## 2. Exporting Configuration
The export feature generates a single JSON file containing the selected parts of your system.

### Steps:
1. In the **Export Configuration** card, select the categories you want to include:
    *   **Agents & Tags**: Assistant configurations, URLs, and their categories.
    *   **AI Keys & Settings**: Global LLM providers and titling/memory prompts.
    *   **Users & Access**: Accounts, roles, and tag assignments.
    *   **System Memory**: Atomic facts learned by agents.
2. Click **Generate & Download Backup**.
3. A file named `uuilly_backup_YYYYMMDD.json` will be downloaded.

> ⚠️ **Security Note**: Backup files contain sensitive information like API keys and user emails. Store them in a secure location and never share them publicly.

---

## 3. Importing Configuration (Smart Merge)
Uuilly uses a **Smart Merge** strategy to ensure that your current data is preserved unless you explicitly choose to overwrite it.

### Import Logic:
*   **Always Preserved**: Any data currently in your database that is *not* in the backup file will remain untouched.
*   **New Items**: Records in the backup that don't exist in your system will be created.
*   **Existing Items**: For records that already exist (matched by ID or Email), you have a choice:
    *   **Overwrite (Switch ON)**: Updates the existing record with the backup's data.
    *   **Skip (Switch OFF)**: Keeps your current record and ignores the backup version.

### Steps:
1. Select your backup JSON file in the **Import Configuration** card.
2. Toggle the **Overwrite Existing Data** switch according to your preference.
3. Click **Start Selective Import** and confirm the action in the dialog.
4. A notification will show you how many items were added, updated, or skipped.

---

## 4. Secure System Reset (Danger Zone)
The **Danger Zone** allows you to wipe all system data to start fresh, while safely preserving Admin access.

### What is deleted?
*   All Agents and their Tags.
*   All System Memory facts.
*   All AI Credentials and LLM configurations (reset to default).
*   All regular **Users** and **Supervisors**.

### What is preserved?
*   **Admin accounts** are never deleted during a reset to prevent lockouts.

### Double-Lock Safety:
To prevent accidental deletions, the Danger Zone is protected by two locks:
1.  **Unlock**: You must type `DANGER ZONE` in the header field to reveal the reset options.
2.  **Confirm**: You must type `RESET` in the final confirmation dialog to execute the wipe.

---

## 5. Action History
Every backup, import, and reset operation is logged at the bottom of the page. You can see:
*   **Timestamp**: When the action occurred.
*   **User**: Who initiated the process.
*   **Action**: Export, Import, or Reset.
*   **Strategy**: Whether "Overwrite" or "Skip" was used for imports.
*   **Status**: Success or Failure.
