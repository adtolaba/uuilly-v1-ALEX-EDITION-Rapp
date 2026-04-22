# Copyright (c) 2026 Gustavo Alejandro Medde.
# Licensed under the Apache License, Version 2.0.
# See LICENSE.md in the project root for more information.

import logging
import json
from typing import List, Dict, Any, Optional
from datetime import datetime
from prisma import Prisma, Json
import schemas
import security

logger = logging.getLogger(__name__)

class BackupService:
    """Service to handle backup, restore, and system reset operations."""

    def __init__(self, db: Prisma):
        self.db = db

    # --- Export Logic ---

    async def export_data(self, categories: List[str], created_by: str, description: Optional[str] = None) -> schemas.BackupFile:
        """
        Fetches system data and structures it into a BackupFile schema.
        """
        data = schemas.BackupData()
        
        # 1. Tags
        all_tags = await self.db.tag.find_many()
        if "agents" in categories or "users" in categories:
            data.tags = [t.model_dump() for t in all_tags]

        # 2. Agents
        if "agents" in categories:
            all_agents = await self.db.agent.find_many(include={"agent_tags": True})
            agents_with_tags = []
            for a in all_agents:
                agent_data = a.model_dump()
                tag_names = []
                for at in a.agent_tags:
                    tag = next((t for t in all_tags if t.id == at.tag_id), None)
                    if tag:
                        tag_names.append(tag.name)
                agent_data["tag_names"] = tag_names
                agents_with_tags.append(agent_data)
            data.agents = agents_with_tags

        # 3. AI Credentials
        if "credentials" in categories:
            all_creds = await self.db.aicredentials.find_many()
            data.ai_credentials = [c.model_dump() for c in all_creds]
            settings = await self.db.systemsettings.find_unique(where={"id": 1})
            if settings:
                data.system_settings = settings.model_dump()

        # 4. Users
        if "users" in categories:
            all_users = await self.db.user.find_many(include={"tags": True})
            users_with_tags = []
            for u in all_users:
                user_data = u.model_dump()
                user_data["tag_names"] = [t.name for t in u.tags]
                users_with_tags.append(user_data)
            data.users = users_with_tags

        # 5. System Memory
        if "memory" in categories:
            all_memories = await self.db.agentmemory.find_many(include={"agent": True, "user": True})
            memories_export = []
            for m in all_memories:
                memories_export.append({
                    "fact": m.fact,
                    "agent_name": m.agent.name,
                    "user_email": m.user.email if m.user else None,
                    "created_at": m.created_at.isoformat(),
                    "updated_at": m.updated_at.isoformat()
                })
            data.memories = memories_export

        metadata = schemas.BackupMetadata(
            created_by=created_by,
            description=description
        )

        backup_file = schemas.BackupFile(metadata=metadata, data=data)
        
        await self.log_action(
            user_id=await self._get_user_id_by_email(created_by),
            action_type="EXPORT",
            entities_affected={"categories": categories},
            status="SUCCESS"
        )
        return backup_file

    # --- Import Logic ---

    async def import_data(self, backup: schemas.BackupFile, categories: List[str], overwrite: bool, imported_by: str):
        """
        Imports data from a backup file using a smart merge strategy.
        """
        stats = {"added": 0, "updated": 0, "skipped": 0}
        try:
            async with self.db.tx() as transaction:
                # 1. Tags (Always import new tags if needed)
                tag_map = {} # name -> id
                if backup.data.tags:
                    for t_data in backup.data.tags:
                        tag = await transaction.tag.upsert(
                            where={"name": t_data["name"]},
                            data={
                                "create": {"name": t_data["name"]},
                                "update": {}
                            }
                        )
                        tag_map[tag.name] = tag.id

                # 2. AI Credentials & Settings
                if "credentials" in categories:
                    for c_data in backup.data.ai_credentials:
                        existing = await transaction.aicredentials.find_first(where={"name": c_data["name"]})
                        if existing:
                            if overwrite:
                                await transaction.aicredentials.update(
                                    where={"id": existing.id},
                                    data={
                                        "provider": c_data["provider"],
                                        "api_key": c_data["api_key"],
                                        "is_active": c_data["is_active"],
                                        "tasks": Json(c_data["tasks"])
                                    }
                                )
                                stats["updated"] += 1
                            else:
                                stats["skipped"] += 1
                        else:
                            await transaction.aicredentials.create(
                                data={
                                    "name": c_data["name"],
                                    "provider": c_data["provider"],
                                    "api_key": c_data["api_key"],
                                    "is_active": c_data["is_active"],
                                    "tasks": Json(c_data["tasks"])
                                }
                            )
                            stats["added"] += 1
                    
                    if backup.data.system_settings:
                        s_data = backup.data.system_settings
                        # SANITIZE: Remove internal keys that should not be overwritten directly
                        s_data.pop("id", None)
                        s_data.pop("updated_at", None)

                        # Validate active credentials exist in the new DB before linking
                        # If IDs don't match, we set to None to avoid foreign key/logic issues
                        for cred_key in ["active_cred_id", "active_extraction_cred_id"]:
                            if s_data.get(cred_key):
                                exists = await transaction.aicredentials.find_unique(where={"id": s_data[cred_key]})
                                if not exists:
                                    s_data[cred_key] = None

                        # System settings always overwrite because there is only one record (ID=1)
                        if overwrite:
                            await transaction.systemsettings.upsert(
                                where={"id": 1},
                                data={
                                    "create": {**s_data, "id": 1},
                                    "update": s_data
                                }
                            )

                # 3. Agents
                if "agents" in categories:
                    for a_data in backup.data.agents:
                        tag_names = a_data.pop("tag_names", [])
                        
                        # SANITIZE: Remove ALL relation and internal keys
                        forbidden_keys = ["id", "created_at", "updated_at", "agent_tags", "conversations", "memories"]
                        for key in forbidden_keys:
                            a_data.pop(key, None)

                        existing = await transaction.agent.find_first(where={"name": a_data["name"]})
                        agent_id = None
                        if existing:
                            if overwrite:
                                agent = await transaction.agent.update(where={"id": existing.id}, data=a_data)
                                agent_id = agent.id
                                stats["updated"] += 1
                            else:
                                stats["skipped"] += 1
                        else:
                            agent = await transaction.agent.create(data=a_data)
                            agent_id = agent.id
                            stats["added"] += 1
                        
                        # Handle AgentTags
                        if agent_id and (overwrite or not existing):
                            await transaction.agenttag.delete_many(where={"agent_id": agent_id})
                            for t_name in tag_names:
                                t_id = tag_map.get(t_name)
                                if t_id:
                                    await transaction.agenttag.create(data={"agent_id": agent_id, "tag_id": t_id})

                # 4. Users
                if "users" in categories:
                    for u_data in backup.data.users:
                        tag_names = u_data.pop("tag_names", [])
                        
                        # SANITIZE: Remove ALL relation and internal keys
                        forbidden_keys = ["id", "created_at", "updated_at", "tags", "conversations", "memories", "backup_logs"]
                        for key in forbidden_keys:
                            u_data.pop(key, None)

                        existing = await transaction.user.find_unique(where={"email": u_data["email"]}, include={"tags": True})
                        user_id = None
                        if existing:
                            if overwrite:
                                user = await transaction.user.update(where={"id": existing.id}, data=u_data)
                                user_id = user.id
                                stats["updated"] += 1
                            else:
                                stats["skipped"] += 1
                        else:
                            user = await transaction.user.create(data=u_data)
                            user_id = user.id
                            stats["added"] += 1

                        
                        # Handle UserTags (disconnect existing and connect new ones)
                        if user_id and (overwrite or not existing):
                            # In Prisma, we use 'set' or 'connect/disconnect'
                            await transaction.user.update(
                                where={"id": user_id},
                                data={"tags": {"set": [{"id": tag_map[tn]} for tn in tag_names if tn in tag_map]}}
                            )

                # 5. Memories
                if "memory" in categories:
                    for m_data in backup.data.memories:
                        agent = await transaction.agent.find_first(where={"name": m_data["agent_name"]})
                        user = await transaction.user.find_unique(where={"email": m_data["user_email"]}) if m_data["user_email"] else None
                        
                        if not agent:
                            continue # Cannot restore memory without agent
                        
                        # Check for existing fact
                        existing = await transaction.agentmemory.find_first(
                            where={
                                "fact": m_data["fact"],
                                "agent_id": agent.id,
                                "user_id": user.id if user else None
                            }
                        )
                        
                        if not existing:
                            await transaction.agentmemory.create(
                                data={
                                    "fact": m_data["fact"],
                                    "agent_id": agent.id,
                                    "user_id": user.id if user else None
                                }
                            )
                            stats["added"] += 1
                        else:
                            stats["skipped"] += 1

            await self.log_action(
                user_id=await self._get_user_id_by_email(imported_by),
                action_type="IMPORT",
                entities_affected={"categories": categories, "stats": stats},
                strategy_used="OVERWRITE" if overwrite else "SKIP",
                status="SUCCESS"
            )
            return stats

        except Exception as e:
            logger.error(f"Import failed: {e}")
            await self.log_action(
                user_id=await self._get_user_id_by_email(imported_by),
                action_type="IMPORT",
                entities_affected={"categories": categories},
                status="FAILURE",
                details=str(e)
            )
            raise e

    # --- System Reset Logic ---

    async def reset_system(self, initiated_by: str):
        """
        Deletes all data except for Admin users.
        """
        try:
            async with self.db.tx() as transaction:
                # 1. Delete relations first to satisfy foreign key constraints
                await transaction.agenttag.delete_many()
                await transaction.agentmemory.delete_many()
                
                # 2. Delete main entities
                await transaction.agent.delete_many()
                await transaction.tag.delete_many()
                await transaction.aicredentials.delete_many()
                
                # 3. Reset System Settings to default
                await transaction.systemsettings.update(
                    where={"id": 1},
                    data={
                        "is_titling_enabled": False,
                        "llm_provider": "openai",
                        "llm_model": None,
                        "llm_api_key": None,
                        "titling_prompt": None,
                        "active_cred_id": None,
                        "memory_extraction_model": None,
                        "memory_extraction_prompt": None,
                        "active_extraction_cred_id": None
                    }
                )
                
                # 4. Delete all non-Admin users (Cascade handles their conversations/messages if defined)
                await transaction.user.delete_many(where={"role": {"not": "ADMIN"}})
            
            user_id = await self._get_user_id_by_email(initiated_by)
            await self.log_action(
                user_id=user_id,
                action_type="RESET",
                entities_affected={"all": True},
                status="SUCCESS"
            )
            return True
        except Exception as e:
            logger.error(f"System reset failed: {e}")
            user_id = await self._get_user_id_by_email(initiated_by)
            await self.log_action(
                user_id=user_id,
                action_type="RESET",
                entities_affected={"all": True},
                status="FAILURE",
                details=str(e)
            )
            raise e

    async def log_action(self, user_id: int, action_type: str, entities_affected: Dict[str, Any], status: str, strategy_used: str = None, details: str = None):
        """Logs a backup/restore action to the database."""
        try:
            # Ensure we use a valid user_id (Prisma requires a real ID or we handle it)
            if not user_id:
                logger.warning("Attempted to log action without valid user_id")
                return

            await self.db.backuplog.create(

                data={
                    "user_id": user_id,
                    "action_type": action_type,
                    "entities_affected": Json(entities_affected),
                    "strategy_used": strategy_used,
                    "status": status,
                    "details": details
                }
            )
        except Exception as e:
            logger.error(f"Failed to log backup action: {e}")


    async def _get_user_id_by_email(self, email: str) -> int:
        user = await self.db.user.find_unique(where={"email": email})
        return user.id if user else 0
