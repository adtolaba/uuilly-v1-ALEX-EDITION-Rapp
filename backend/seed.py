# Copyright (c) 2026 Gustavo Alejandro Medde.
# Licensed under the Apache License, Version 2.0.
# See LICENSE.md in the project root for more information.

import asyncio
import json
import os
from prisma import Prisma
from datetime import datetime
from bootstrap import bootstrap_users

async def clean_db(db: Prisma):
    """Deletes all records in the correct order to avoid FK constraints."""
    print("Clearing database...")
    # Order matters due to Foreign Keys
    await db.backuplog.delete_many()
    await db.agentmemory.delete_many()
    await db.message.delete_many()
    await db.conversation.delete_many()
    await db.agenttag.delete_many()
    await db.agent.delete_many()
    await db.systemsettings.delete_many()
    await db.aicredentials.delete_many()
    await db.user.delete_many()
    await db.tag.delete_many()
    print("Database cleared.")

async def seed():
    """Populates the database with 12 agents, settings, and credentials."""
    db = Prisma()
    await db.connect()
    await clean_db(db)

    print("Starting database seeding (Agents, Settings & AI Credentials)...")

    # 0. Create Tags
    user_tag = await db.tag.create(data={"name": "user"})
    admin_tag = await db.tag.create(data={"name": "admin"})
    print(f"Created tags: {user_tag.name}, {admin_tag.name}")

    # 1. Create AI Credentials (for Titling and Memory)
    # Note: Keys are dummy/placeholders. In a real env, use valid keys or leave as env vars.
    await db.aicredentials.create(
        data={
            "name": "OpenAI Primary",
            "provider": "OPENAI",
            "api_key": "sk-placeholder-openai",
            "tasks": json.dumps(["titling", "extraction"]),
            "is_active": True
        }
    )
    await db.aicredentials.create(
        data={
            "name": "Gemini Flash",
            "provider": "GEMINI",
            "api_key": "ai-placeholder-gemini",
            "tasks": json.dumps(["titling"]),
            "is_active": False
        }
    )
    print("Created AI Credentials placeholders.")

    # 2. Create 12 Agents with Icons and Memory Settings
    agents_data = [
        {
            "name": "n8n Sales Bot", 
            "description": "Automated sales assistant specialized in leads and CRM integration.", 
            "type": "n8n", 
            "url": "http://n8n:5678/webhook/sales", 
            "config": json.dumps({"workflow_id": "123"}), 
            "is_active": True, 
            "is_streaming_enabled": True, 
            "icon": "💰",
            "memory_enabled": True,
            "has_user_tag": True
        },
        {
            "name": "Flowise Support", 
            "description": "Technical support agent powered by RAG and documentation.", 
            "type": "flowise", 
            "url": "http://flowise:3001/api/v1/prediction/support", 
            "config": json.dumps({"overrideConfig": {}}), 
            "is_active": True, 
            "is_streaming_enabled": True, 
            "icon": "🛠️",
            "memory_enabled": True,
            "has_user_tag": True
        },
        {
            "name": "Marketing Specialist", 
            "description": "Creative assistant for social media, ad copy, and campaign planning.", 
            "type": "n8n", 
            "url": "http://n8n:5678/webhook/marketing", 
            "config": json.dumps({}), 
            "is_active": True, 
            "is_streaming_enabled": True, 
            "icon": "📢",
            "has_user_tag": False
        },
        {
            "name": "Legal Advisor", 
            "description": "Analyzes contracts and provides legal compliance summaries.", 
            "type": "flowise", 
            "url": "http://flowise:3001/api/v1/prediction/legal", 
            "config": json.dumps({}), 
            "is_active": True, 
            "is_streaming_enabled": True, 
            "icon": "⚖️",
            "memory_enabled": True,
            "has_user_tag": True
        },
        {
            "name": "Code Reviewer", 
            "description": "Senior engineer bot that reviews PRs and suggests optimizations.", 
            "type": "n8n", 
            "url": "http://n8n:5678/webhook/code", 
            "config": json.dumps({}), 
            "is_active": True, 
            "is_streaming_enabled": True, 
            "icon": "💻",
            "has_user_tag": False
        },
        {
            "name": "Customer Success", 
            "description": "Helps onboarding new users and tracking satisfaction metrics.", 
            "type": "n8n", 
            "url": "http://n8n:5678/webhook/success", 
            "config": json.dumps({}), 
            "is_active": True, 
            "is_streaming_enabled": True, 
            "icon": "🤝",
            "has_user_tag": False
        },
        {
            "name": "HR Assistant", 
            "description": "Manages interview scheduling and employee FAQ responses.", 
            "type": "flowise", 
            "url": "http://flowise:3001/api/v1/prediction/hr", 
            "config": json.dumps({}), 
            "is_active": True, 
            "is_streaming_enabled": True, 
            "icon": "🧑‍💼",
            "has_user_tag": False
        },
        {
            "name": "Data Analyst", 
            "description": "Transforms raw data into actionable insights and visualizations.", 
            "type": "n8n", 
            "url": "http://n8n:5678/webhook/data-analyst", 
            "config": json.dumps({}), 
            "is_active": True, 
            "is_streaming_enabled": True, 
            "icon": "📊",
            "has_user_tag": False
        },
        {
            "name": "Copywriter AI", 
            "description": "Specialist in SEO-optimized content and creative storytelling.", 
            "type": "flowise", 
            "url": "http://flowise:3001/api/v1/prediction/copy", 
            "config": json.dumps({}), 
            "is_active": True, 
            "is_streaming_enabled": True, 
            "icon": "📝",
            "has_user_tag": False
        },
        {
            "name": "DevOps Helper", 
            "description": "Assists with CI/CD pipelines, container monitoring, and logs.", 
            "type": "n8n", 
            "url": "http://n8n:5678/webhook/devops", 
            "config": json.dumps({}), 
            "is_active": True, 
            "is_streaming_enabled": True, 
            "icon": "♾️",
            "has_user_tag": False
        },
        {
            "name": "Social Media Manager", 
            "description": "Plans posting schedules and generates engagement strategies.", 
            "type": "flowise", 
            "url": "http://flowise:3001/api/v1/prediction/social", 
            "config": json.dumps({}), 
            "is_active": True, 
            "is_streaming_enabled": True, 
            "icon": "📱",
            "has_user_tag": False
        },
        {
            "name": "Security Auditor", 
            "description": "Reviews code patterns for vulnerabilities and compliance.", 
            "type": "n8n", 
            "url": "http://n8n:5678/webhook/security", 
            "config": json.dumps({}), 
            "is_active": True, 
            "is_streaming_enabled": True, 
            "icon": "🔒",
            "has_user_tag": False
        }
    ]

    for a in agents_data:
        has_tag = a.pop("has_user_tag")
        agent_data = {**a}
        if has_tag:
            agent_data["agent_tags"] = {"create": [{"tag_id": user_tag.id}]}
        await db.agent.create(data=agent_data)
    
    print(f"Created {len(agents_data)} agents.")

    # 3. Create System Settings
    from services import DEFAULT_TITLING_PROMPT
    await db.systemsettings.create(
        data={
            "id": 1,
            "is_titling_enabled": True,
            "llm_provider": "openai",
            "llm_model": "gpt-4o-mini",
            "titling_prompt": DEFAULT_TITLING_PROMPT,
            "memory_extraction_model": "gpt-4o-mini"
        }
    )
    print("Created initial system settings.")

    # 4. Bootstrap Users
    print("Syncing bootstrap users...")
    await bootstrap_users(db)

    print("Database seeding completed successfully.")
    await db.disconnect()

if __name__ == "__main__":
    asyncio.run(seed())
