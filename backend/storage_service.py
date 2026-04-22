# Copyright (c) 2026 Gustavo Alejandro Medde.
# Licensed under the Apache License, Version 2.0.
# See LICENSE.md in the project root for more information.

import os
import shutil
import logging
import time
import glob

logger = logging.getLogger(__name__)

class StorageService:
    """Service to handle physical storage for users and conversations."""

    def __init__(self, base_path: str = "storage"):
        """
        Initializes the storage service.
        Args:
            base_path: The root directory for all storage.
        """
        self.base_path = base_path
        if not os.path.exists(self.base_path):
            os.makedirs(self.base_path, mode=0o777, exist_ok=True)

    def get_conversation_folder_path(self, user_id: int, conversation_id: int) -> str:
        """
        Returns the path to a conversation's storage folder.
        Structure: storage/users/{user_id}/{conversation_id}/
        """
        return os.path.join(
            self.base_path, 
            "users", 
            str(user_id), 
            str(conversation_id)
        )

    def create_conversation_folder(self, user_id: int, conversation_id: int) -> str:
        """
        Creates the physical directory for a conversation and its local tmp folder.
        """
        path = self.get_conversation_folder_path(user_id, conversation_id)
        if not os.path.exists(path):
            os.makedirs(path, mode=0o777, exist_ok=True)
            os.chmod(path, 0o777)
            
            # Also create a tmp folder INSIDE the conversation folder
            tmp_path = os.path.join(path, "tmp")
            os.makedirs(tmp_path, mode=0o777, exist_ok=True)
            os.chmod(tmp_path, 0o777)
            
            logger.info(f"Created conversation folder structure: {path}")
        return path

    def delete_conversation_folder(self, user_id: int, conversation_id: int):
        """
        Deletes the conversation folder and EVERYTHING inside it.
        """
        path = self.get_conversation_folder_path(user_id, conversation_id)
        if os.path.exists(path):
            shutil.rmtree(path)
            logger.info(f"Deleted entire conversation folder: {path}")
        else:
            logger.warning(f"Attempted to delete non-existent folder: {path}")

    def save_file(self, user_id: int, file_name: str, content: bytes, conversation_id: int) -> str:
        """
        Saves a file directly to the conversation's folder.
        """
        conv_path = self.create_conversation_folder(user_id, conversation_id)
        file_path = os.path.join(conv_path, file_name)
        
        with open(file_path, "wb") as f:
            f.write(content)
        
        os.chmod(file_path, 0o666)
        logger.info(f"Saved file to conversation {conversation_id}: {file_path}")
        
        return f"/storage/users/{user_id}/{conversation_id}/{file_name}"

    def get_public_url(self, relative_path: str) -> str:
        base = os.getenv("PUBLIC_SERVER_URL", "http://localhost:8080").rstrip("/")
        path = relative_path if relative_path.startswith("/") else f"/{relative_path}"
        return f"{base}{path}"

    def get_internal_url(self, relative_path: str) -> str:
        base = os.getenv("INTERNAL_SERVER_URL", "http://uuilly-backend:8000").rstrip("/")
        path = relative_path if relative_path.startswith("/") else f"/{relative_path}"
        return f"{base}{path}"

    def cleanup_temporary_files(self, max_age_seconds: int = 86400):
        """
        Cleans up files in any 'tmp' subfolders inside conversation folders 
        if they are older than max_age_seconds.
        """
        search_pattern = os.path.join(self.base_path, "users", "*", "*", "tmp", "*")
        files = glob.glob(search_pattern)
        
        now = time.time()
        for f in files:
            if os.path.isfile(f) and (now - os.path.getmtime(f) > max_age_seconds):
                try:
                    os.remove(f)
                    logger.info(f"Cleaned up old internal tmp file: {f}")
                except Exception as e:
                    logger.error(f"Error cleaning up {f}: {e}")

    def cleanup_orphaned_folders(self, valid_conversation_ids: list):
        """
        Deletes folders in storage/users/{user_id}/{conv_id} that are not in the 
        provided list of valid IDs.
        """
        # Convert all to strings for comparison
        valid_str_ids = [str(id) for id in valid_conversation_ids]
        
        # storage/users/*/
        users_pattern = os.path.join(self.base_path, "users", "*")
        user_dirs = glob.glob(users_pattern)
        
        for user_dir in user_dirs:
            if not os.path.isdir(user_dir):
                continue
                
            # Iterate through conversation folders inside each user
            # storage/users/{user_id}/*
            conv_dirs = glob.glob(os.path.join(user_dir, "*"))
            for conv_dir in conv_dirs:
                if not os.path.isdir(conv_dir):
                    continue
                
                conv_id_str = os.path.basename(conv_dir)
                
                # Check if it's a conversation folder (numeric ID)
                if conv_id_str.isdigit():
                    if conv_id_str not in valid_str_ids:
                        try:
                            shutil.rmtree(conv_dir)
                            logger.info(f"Cleaned up ORPHANED folder (not in DB): {conv_dir}")
                        except Exception as e:
                            logger.error(f"Error deleting orphan {conv_dir}: {e}")
