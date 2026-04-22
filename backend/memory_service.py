# Copyright (c) 2026 Gustavo Alejandro Medde.
# Licensed under the Apache License, Version 2.0.
# See LICENSE.md in the project root for more information.

import logging
from typing import List, Optional, Any
from prisma import Prisma

logger = logging.getLogger(__name__)

class MemoryService:
    """Service to handle agent memory storage and retrieval with scope logic."""

    def __init__(self, prisma: Prisma):
        self.prisma = prisma

    async def store_fact(self, agent_id: int, user_id: int, fact: str):
        """
        Stores an atomic fact in the database based on the agent's memory scope.
        If INDIVIDUAL: stored with user_id.
        If GLOBAL: user_id is set to None.
        """
        try:
            agent = await self.prisma.agent.find_unique(where={"id": agent_id})
            if not agent:
                logger.error(f"Agent {agent_id} not found when storing fact.")
                return

            target_user_id = user_id if agent.memory_scope == "INDIVIDUAL" else None

            # Simple deduplication: don't store exact same fact for same scope
            existing = await self.prisma.agentmemory.find_first(
                where={
                    "agent_id": agent_id,
                    "user_id": target_user_id,
                    "fact": fact
                }
            )

            if existing:
                logger.info(f"Fact already exists for agent {agent_id}, scope {agent.memory_scope}")
                # Update timestamp
                await self.prisma.agentmemory.update(
                    where={"id": existing.id},
                    data={"updated_at": None} # This forces @updatedAt to refresh
                )
                return existing

            # Create new fact
            return await self.prisma.agentmemory.create(
                data={
                    "agent_id": agent_id,
                    "user_id": target_user_id,
                    "fact": fact
                }
            )
        except Exception as e:
            logger.error(f"Error storing fact for agent {agent_id}: {e}")
            return None

    async def get_relevant_facts(self, agent_id: int, user_id: int) -> List[Any]:
        """
        Retrieves all relevant facts for the current context.
        Returns full AgentMemory objects.
        """
        try:
            # We query for both specific user_id and null user_id for this agent
            memories = await self.prisma.agentmemory.find_many(
                where={
                    "OR": [
                        {"agent_id": agent_id, "user_id": user_id},
                        {"agent_id": agent_id, "user_id": None}
                    ]
                },
                order={"updated_at": "desc"}
            )
            return memories
        except Exception as e:
            logger.error(f"Error retrieving facts for agent {agent_id}: {e}")
            return []

    async def update_fact(self, fact_id: int, new_fact: str):
        """Updates the content of a specific fact."""
        try:
            return await self.prisma.agentmemory.update(
                where={"id": fact_id},
                data={"fact": new_fact}
            )
        except Exception as e:
            logger.error(f"Error updating fact {fact_id}: {e}")
            return None

    async def delete_fact(self, fact_id: int):
        """Deletes a specific fact by ID."""
        try:
            return await self.prisma.agentmemory.delete(where={"id": fact_id})
        except Exception as e:
            logger.error(f"Error deleting fact {fact_id}: {e}")
            return None
