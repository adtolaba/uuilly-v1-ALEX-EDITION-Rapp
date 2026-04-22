# Copyright (c) 2026 Gustavo Alejandro Medde.
# Licensed under the Apache License, Version 2.0.
# See LICENSE.md in the project root for more information.

"""Database configuration and persistence logic using Prisma."""
from prisma import Prisma, Json
import os
from datetime import datetime
import logging
from storage_service import StorageService
from titling_service import TitlingService
from services import SettingsService
from tenacity import retry, stop_after_attempt, wait_fixed, retry_if_exception_type
import security

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/uuilly")

prisma = Prisma()
storage_service = StorageService()

@retry(
    stop=stop_after_attempt(5),
    wait=wait_fixed(2),
    retry=retry_if_exception_type((RuntimeError, Exception)),
    before_sleep=lambda retry_state: logger.warning(f"Retrying database connection (attempt {retry_state.attempt_number}/5)...")
)
async def init_db():
    """Initializes the database connection with retries."""
    try:
        if not prisma.is_connected():
            await prisma.connect()
        else:
            # Simple check to see if the loop is still alive
            await prisma.execute_raw("SELECT 1")
    except Exception as e:
        # If loop is closed or other error, try to disconnect and re-raise to trigger retry
        if prisma.is_connected():
            try:
                await prisma.disconnect()
            except:
                pass
        logger.error(f"Database connection attempt failed: {e}")
        raise

async def get_db():
    """Dependency for getting the Prisma client.
    
    Yields:
        Prisma: The Prisma client instance.
    """
    await init_db()
    try:
        yield prisma
    finally:
        pass

# --- Conversation Persistence ---

async def create_conversation(user_id: int, agent_id: int, title: str = None):
    """
    Creates a new conversation record.
    If no title is provided, generates a default one.
    """
    if not title:
        date_str = datetime.now().strftime("%d/%m/%y")
        title = f"Nueva conversación {date_str}"
    
    conv = await prisma.conversation.create(
        data={
            "user_id": user_id,
            "agent_id": agent_id,
            "title": title
        }
    )

    # Create physical storage folder for the conversation
    try:
        storage_service.create_conversation_folder(user_id, conv.id)
    except Exception as e:
        logger.error(f"Error creating storage folder for conversation {conv.id}: {e}")
    
    return conv

async def update_message(message_id: int, conversation_id: int, user_id: int, new_text: str):
    """
    Updates an agent message's text.
    Enforces that:
    1. The conversation belongs to the user (if user_id provided).
    2. The message belongs to that conversation.
    3. The message was sent by 'agent'.
    """
    where_conv = {"id": conversation_id}
    if user_id:
        where_conv["user_id"] = user_id
        
    conv = await prisma.conversation.find_unique(where=where_conv)
    if not conv:
        return None
        
    msg = await prisma.message.find_unique(where={"id": message_id})
    if not msg or msg.conversation_id != conversation_id:
        return None
        
    if msg.sender != "bot":
        raise ValueError("Only agent messages can be edited")
        
    updated_msg = await prisma.message.update(
        where={"id": message_id},
        data={"text": new_text}
    )
    return updated_msg

async def delete_message(message_id: int, conversation_id: int, user_id: int):
    """Deletes a specific message after verifying ownership."""
    where_conv = {"id": conversation_id}
    if user_id:
        where_conv["user_id"] = user_id
        
    conv = await prisma.conversation.find_unique(where=where_conv)
    if not conv:
        return None
        
    msg = await prisma.message.find_unique(where={"id": message_id})
    if not msg or msg.conversation_id != conversation_id:
        return None
        
    deleted_msg = await prisma.message.delete(where={"id": message_id})
    return deleted_msg

async def get_user_conversations(user_id: int, agent_id: int = None):
    """Retrieves all conversations for a specific user, optionally filtered by agent."""
    where = {"user_id": user_id}
    if agent_id:
        where["agent_id"] = agent_id

    return await prisma.conversation.find_many(
        where=where,
        order={"updated_at": "desc"},
        include={"agent": {"include": {"agent_tags": {"include": {"tag": True}}}}}
    )

async def get_conversation(conversation_id: int, user_id: int = None):
    """
    Retrieves a specific conversation.
    If user_id is provided, enforces isolation.
    """
    where = {"id": conversation_id}
    if user_id:
        where["user_id"] = user_id

    conv = await prisma.conversation.find_unique(
        where=where,
        include={
            "messages": True, 
            "agent": {"include": {"agent_tags": {"include": {"tag": True}}}}
        }
    )
    if conv and conv.messages:
        # Sort messages by timestamp manually if prisma client version has issues with nested order
        conv.messages.sort(key=lambda x: x.timestamp)
        
    return conv

async def delete_conversation(conversation_id: int, user_id: int = None):
    """
    Deletes a conversation. 
    If user_id is provided, ensures ownership.
    """
    # Enforce isolation
    db_conv = None
    if user_id:
        db_conv = await prisma.conversation.find_first(
            where={"id": conversation_id, "user_id": user_id}
        )
        if not db_conv:
            return None
    else:
        # We need user_id to delete the folder, fetch it if not provided
        db_conv = await prisma.conversation.find_unique(where={"id": conversation_id})
        if not db_conv:
            return None
            
    # Delete from DB
    deleted_conv = await prisma.conversation.delete(where={"id": conversation_id})
    
    # Phase 2: Delete physical folder
    if db_conv:
        try:
            storage_service.delete_conversation_folder(db_conv.user_id, conversation_id)
        except Exception as e:
            logger.error(f"Error deleting conversation folder: {e}")

    return deleted_conv

async def update_conversation_title(conversation_id: int, user_id: int, title: str):
    """Updates the title of a conversation."""
    # Ensure ownership
    conv = await prisma.conversation.find_first(
        where={"id": conversation_id, "user_id": user_id}
    )
    if not conv:
        return None
        
    return await prisma.conversation.update(
        where={"id": conversation_id},
        data={"title": title}
    )

# --- Message Persistence ---

from typing import List, Optional
import schemas

async def save_message(text: str, sender: str, conversation_id: int, files: Optional[List[schemas.FileAttachment]] = None):
    """Saves a new message linked to a specific conversation.
    
    Args:
        text: The content of the message.
        sender: The sender of the message ('user' or 'bot').
        conversation_id: The ID of the conversation it belongs to.
        files: Optional list of file attachments.
        
    Returns:
        Message: The created message object.
    """
    # Update conversation's updated_at timestamp implicitly via Prisma if we want,
    # but here we just create the message.
    
    data = {
        "text": text,
        "sender": sender,
        "conversation_id": conversation_id
    }
    
    if files:
        # Convert Pydantic models to serializable dicts for Json field
        data["files"] = Json([file.model_dump() for file in files])

    message = await prisma.message.create(data=data)
    
    # Check if this is the FIRST BOT message to trigger titling (or fallback)
    if sender == "bot":
        # Check if this conversation only has 2 messages so far (User + Bot)
        msg_count = await prisma.message.count(where={"conversation_id": conversation_id})
        if msg_count == 2:
            # We trigger the background task with the bot response
            await trigger_automatic_titling(conversation_id, text)

    # Manually update the conversation's updated_at to bring it to the top of lists
    await prisma.conversation.update(
        where={"id": conversation_id},
        data={"updated_at": datetime.now()}
    )
    
    return message

async def get_conversation_messages(conversation_id: int, user_id: int = None):
    """
    Retrieves all messages for a specific conversation.
    If user_id is provided, enforces isolation by checking conversation ownership.
    """
    where_clause = {"conversation_id": conversation_id}

    if user_id:
        # First, check if the conversation exists and belongs to the user
        conversation = await prisma.conversation.find_first(
            where={"id": conversation_id, "user_id": user_id}
        )
        if not conversation:
            return None # Conversation not found or not owned by user
            
    # If user_id is not provided (e.g., admin access), or if ownership is confirmed,
    # then fetch messages.
    messages = await prisma.message.find_many(
        where=where_clause,
        order={"timestamp": "asc"}
    )
    return messages

async def trigger_automatic_titling(conversation_id: int, bot_text: str):
    """
    Triggers the automatic conversation titling in a non-blocking background task.
    """
    import asyncio
    asyncio.create_task(run_titling_task(conversation_id, bot_text))

async def run_titling_task(conversation_id: int, bot_text: str):
    """
    Background task that calls the LLM to generate a title and updates the DB.
    
    If bot_text is too short or invalid, falls back to the first user message.
    """
    try:
        # 1. Get Settings
        settings_service = SettingsService(prisma)
        settings = await settings_service.get_settings()
        
        if not settings.is_titling_enabled:
            return

        # 2. Determine text to use for titling
        text_for_titling = bot_text
        if not bot_text or len(bot_text.strip()) < 10:
            # Fallback: Find the first user message for this conversation
            first_user_msg = await prisma.message.find_first(
                where={"conversation_id": conversation_id, "sender": "user"},
                order={"timestamp": "asc"}
            )
            if first_user_msg:
                text_for_titling = first_user_msg.text
            else:
                logger.warning(f"No text available for titling conversation {conversation_id}")
                return

        # 3. Call TitlingService
        titling_service = TitlingService(prisma)
        
        # Priority 1: Check if there are centralized credentials
        has_centralized = await prisma.aicredentials.find_first(where={"is_active": True})
        
        if has_centralized:
            # We need the user message for a better title, but for now we use what we have
            # Let's find the first user message if possible
            first_user_msg = await prisma.message.find_first(
                where={"conversation_id": conversation_id, "sender": "user"},
                order={"timestamp": "asc"}
            )
            user_text = first_user_msg.text if first_user_msg else ""
            
            new_title = await titling_service.generate_title_centralized(
                user_message=user_text,
                agent_response=bot_text,
                custom_prompt=settings.titling_prompt
            )
        else:
            # Fallback to Legacy Settings
            # Decrypt API Key
            api_key = security.decrypt_secret(settings.llm_api_key)
            if not api_key:
                logger.warning(f"Titling enabled but API Key is missing for conversation {conversation_id}")
                return

            new_title = await titling_service.generate_title(
                provider=settings.llm_provider,
                model=settings.llm_model,
                api_key=api_key,
                prompt=settings.titling_prompt,
                message=text_for_titling
            )

        if new_title:
            # 4. Update DB
            await prisma.conversation.update(
                where={"id": conversation_id},
                data={"title": new_title}
            )
            logger.info(f"Auto-updated title for conversation {conversation_id}: {new_title}")
            
            # 5. Broadcast via WebSockets
            try:
                from main import manager
                # Fetch user_id for the conversation to broadcast correctly
                conv = await prisma.conversation.find_unique(where={"id": conversation_id})
                if conv:
                    await manager.broadcast_to_user(conv.user_id, {
                        "type": "title_update",
                        "conversation_id": conversation_id,
                        "title": new_title
                    })
            except Exception as e:
                logger.error(f"Error broadcasting title update for conversation {conversation_id}: {e}")

    except Exception as e:
        logger.error(f"Error in background titling task for conversation {conversation_id}: {e}")
