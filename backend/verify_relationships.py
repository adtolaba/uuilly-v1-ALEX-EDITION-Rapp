# Copyright (c) 2026 Gustavo Alejandro Medde.
# Licensed under the Apache License, Version 2.0.
# See LICENSE.md in the project root for more information.

import asyncio
import json
from prisma import Prisma

async def verify():
    """Executes a suite of queries to verify database relationships and integrity."""
    db = Prisma()
    await db.connect()

    print("=== Database Relationship Verification ===\n")

    # 1. User Conversations
    print("--- 1. User Conversations ---")
    user = await db.user.find_first(where={"email": "user@example.com"}, include={"conversations": True})
    if user:
        print(f"User: {user.email}")
        for conv in user.conversations:
            print(f"  - Conv ID: {conv.id}, Title: {conv.title}")
    else:
        print("User not found.")
    print()

    # 2. Access Control Logic (Filter Agents by User Tags)
    print("--- 2. Access Control Logic (Filter Agents by User Tags) ---")
    # Logic: Get user tags, then find agents that have AT LEAST ONE of those tags.
    user_with_tags = await db.user.find_first(where={"email": "user@example.com"}, include={"tags": True})
    if user_with_tags:
        user_tag_ids = [tag.id for tag in user_with_tags.tags]
        print(f"User {user_with_tags.email} has tags: {[tag.name for tag in user_with_tags.tags]}")
        
        # Find agents sharing these tags
        agents = await db.agent.find_many(
            where={
                "agent_tags": {
                    "some": {
                        "tag_id": {"in": user_tag_ids}
                    }
                }
            },
            include={"agent_tags": {"include": {"tag": True}}}
        )
        print(f"Available Agents for user:")
        for agent in agents:
            agent_tags = [at.tag.name for at in agent.agent_tags]
            print(f"  - Agent: {agent.name}, Tags: {agent_tags}")
    print()

    # 3. Message History
    print("--- 3. Message History ---")
    conv = await db.conversation.find_first(include={"messages": True})
    if conv:
        print(f"Conversation: {conv.title}")
        # Sorting by timestamp in memory
        sorted_messages = sorted(conv.messages, key=lambda x: x.timestamp)
        for msg in sorted_messages:
            print(f"  [{msg.sender.upper()}]: {msg.text}")
    print()

    # 4. Reverse Tag Lookups (Users by Tag)
    print("--- 4. Reverse Tag Lookups: Users by Tag ---")
    tag_name = "general"
    tag = await db.tag.find_first(where={"name": tag_name}, include={"users": True})
    if tag:
        print(f"Users with tag '{tag_name}':")
        for u in tag.users:
            print(f"  - {u.email}")
    print()

    # 5. Reverse Tag Lookups (Agents by Tag)
    print("--- 5. Reverse Tag Lookups: Agents by Tag ---")
    tag_name = "ai"
    tag_agents = await db.tag.find_first(
        where={"name": tag_name}, 
        include={"agent_tags": {"include": {"agent": True}}}
    )
    if tag_agents:
        print(f"Agents with tag '{tag_name}':")
        for at in tag_agents.agent_tags:
            print(f"  - {at.agent.name}")
    print()

    # 6. Entity Associations: Conversations per Agent
    print("--- 6. Entity Associations: Conversations per Agent ---")
    agent = await db.agent.find_first(include={"conversations": True})
    if agent:
        print(f"Agent: {agent.name}")
        print(f"Number of conversations: {len(agent.conversations)}")
        for c in agent.conversations:
            print(f"  - Conv ID: {c.id}, Title: {c.title}")

    print("\n=== Verification Complete ===")
    await db.disconnect()

if __name__ == "__main__":
    asyncio.run(verify())
