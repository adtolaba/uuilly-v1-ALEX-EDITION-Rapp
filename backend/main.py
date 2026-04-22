# Copyright (c) 2026 Gustavo Alejandro Medde.
# Licensed under the Apache License, Version 2.0.
# See LICENSE.md in the project root for more information.

"""Main entry point for the UUilly Backend API.

This module initializes the FastAPI application, sets up WebSocket connections,
and handles basic routing and database initialization.
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, Response, Query, UploadFile, File, Form, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from prisma import Prisma, Json
import os
import json
import logging
from typing import List, Optional, Dict, Any, Union
from contextlib import asynccontextmanager
from datetime import timedelta # Added for token expiration
from dotenv import load_dotenv # Import load_dotenv

# Load environment variables from .env file
load_dotenv()

import schemas
from services import ExternalService
from database import init_db, save_message, get_db, prisma
import auth
import security
import asyncio
from bootstrap import bootstrap_users
from prisma import errors as prisma_errors
from fastapi_sso.sso.google import GoogleSSO
from starlette.requests import Request

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Filter to suppress health check logs and internal worker traffic from uvicorn/httpx
class HealthCheckFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        # Suppress standard health checks
        if msg.find("/health") != -1:
            return False
        # Suppress mysterious internal POSTs to port 56599 (likely benign worker/health traffic)
        if msg.find(":56599") != -1:
            return False
        return True

# Apply filter to uvicorn access logger and httpx
logging.getLogger("uvicorn.access").addFilter(HealthCheckFilter())
logging.getLogger("httpx").addFilter(HealthCheckFilter())

async def periodic_cleanup():
    """Background task to clean up orphaned temporary files and folders periodically."""
    # Run once at startup, then every 24 hours
    while True:
        try:
            logger.info("Running scheduled deep cleanup of storage...")
            
            # 1. Cleanup internal /tmp/ files older than 24h
            storage_service.cleanup_temporary_files()
            
            # 2. Cleanup ORPHANED folders (folders on disk not in DB)
            if not prisma.is_connected():
                await prisma.connect()
            
            # Some versions of prisma-client-py might have issues with 'select' in find_many
            # Fetching all fields to be safe
            conversations = await prisma.conversation.find_many()
            valid_ids = [c.id for c in conversations]
            
            storage_service.cleanup_orphaned_folders(valid_ids)
            
            logger.info(f"Storage cleanup finished. Verified {len(valid_ids)} active conversations.")
            
        except Exception as e:
            logger.error(f"Error in periodic cleanup task: {e}")
        
        # Wait for 24 hours (86400 seconds)
        await asyncio.sleep(86400)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    
    # Run user bootstrap
    await bootstrap_users(prisma)
    
    # Start periodic cleanup task
    cleanup_task = asyncio.create_task(periodic_cleanup())
    
    yield
    # Shutdown
    # Cancel the cleanup task on shutdown
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass

    # Only disconnect if not in test environment to avoid event loop issues in pytest
    if not os.getenv("PYTEST_CURRENT_TEST") and prisma.is_connected():
        await prisma.disconnect()

app = FastAPI(title="UUilly API", lifespan=lifespan)

# Mount the storage directory to serve static files (attachments)
# Create directory if not exists to avoid mount error
if not os.path.exists("storage"):
    os.makedirs("storage", exist_ok=True)
app.mount("/storage", StaticFiles(directory="storage"), name="storage")

class ConnectionManager:
    """Manages active WebSocket connections."""

    def __init__(self):
        """Initializes the manager with an empty list of active connections."""
        self.active_connections: List[Dict[str, Union[WebSocket, int]]] = []
        self.unauthenticated_connections: List[WebSocket] = []

    async def connect_unauthenticated(self, websocket: WebSocket):
        """Accepts a new connection before authentication."""
        self.unauthenticated_connections.append(websocket)

    async def connect(self, websocket: WebSocket, user_id: int):
        """Accepts a new connection and adds it to the active list.
        
        Args:
            websocket: The WebSocket instance to connect.
            user_id: The ID of the user owning the connection.
        """
        # If it was unauthenticated, move it to active
        if websocket in self.unauthenticated_connections:
            self.unauthenticated_connections.remove(websocket)
            
        self.active_connections.append({"websocket": websocket, "user_id": user_id})

    def disconnect(self, websocket: WebSocket):
        """Removes a connection from the active list.
        
        Args:
            websocket: The WebSocket instance to disconnect.
        """
        if websocket in self.unauthenticated_connections:
            self.unauthenticated_connections.remove(websocket)
            
        self.active_connections = [conn for conn in self.active_connections if conn["websocket"] != websocket]

    async def broadcast_to_user(self, user_id: int, message: dict):
        """Sends a message to all active WebSockets for a specific user.
        
        Args:
            user_id: The ID of the target user.
            message: The message dictionary to send.
        """
        message_json = json.dumps(message)
        for connection in self.active_connections:
            if connection["user_id"] == user_id:
                try:
                    await connection["websocket"].send_text(message_json)
                except Exception as e:
                    logger.error(f"Error broadcasting to user {user_id}: {e}")

manager = ConnectionManager()

from services import ExternalService, SettingsService
external_service = ExternalService(prisma)
from backup_router import router as backup_router
app.include_router(backup_router)
from storage_service import StorageService
storage_service = StorageService()

# Phase 3: titling services
from titling_service import TitlingService
titling_service_instance = TitlingService(prisma)


# Google OAuth Configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
PUBLIC_SERVER_URL = os.getenv("PUBLIC_SERVER_URL", "http://localhost:8080")

google_sso = None
if GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET:
    google_sso = GoogleSSO(
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        redirect_uri=f"{PUBLIC_SERVER_URL}/api/auth/google/callback",
        allow_insecure_http=True if "localhost" in PUBLIC_SERVER_URL else False
    )

@app.get("/health")
async def health_check():
    """Health check endpoint to verify API and DB connectivity.
    
    Returns:
        dict: Status of the API and the database connection.
    """
    db_status = "ok"
    try:
        await init_db()
        # Simple query to check connectivity
        await prisma.execute_raw("SELECT 1")
    except Exception as e:
        db_status = f"error: {str(e)}"
    
    return {"status": "ok", "database": db_status}

async def run_agent_in_background(
    user_id: int,
    agent: schemas.Agent,
    text_input: str,
    conversation_id: int,
    files: List[schemas.FileAttachment] = []
):
    """Executes the agent call in the background and broadcasts results to the user."""
    try:
        # Flowise and n8n expect conversation_id as a string (Session ID)
        session_id = str(conversation_id)
        
        response_data = await external_service.call_agent(agent, text_input, conversation_id=conversation_id, user_id=user_id, files=files)
        
        import inspect
        if inspect.isasyncgen(response_data):
            full_response = ""
            async for chunk in response_data:
                full_response += chunk
                await manager.broadcast_to_user(user_id, {
                    "response": chunk,
                    "is_streaming": True,
                    "conversation_id": conversation_id
                })
            
            saved_msg = await save_message(full_response, "bot", conversation_id)
            await manager.broadcast_to_user(user_id, {
                "id": saved_msg.id,
                "response": "",
                "is_streaming": False,
                "done": True,
                "conversation_id": conversation_id
            })
        else:
            bot_text = ""
            if isinstance(response_data, dict):
                bot_text = response_data.get("text", response_data.get("output", response_data.get("answer", str(response_data))))
            else:
                bot_text = str(response_data)

            saved_msg = await save_message(bot_text, "bot", conversation_id)
            await manager.broadcast_to_user(user_id, {
                "id": saved_msg.id,
                "response": bot_text,
                "done": True,
                "conversation_id": conversation_id
            })
    except Exception as e:
        logger.error(f"Error in background agent task for user {user_id}: {e}")
        await manager.broadcast_to_user(user_id, {
            "error": f"Agent error: {str(e)}", 
            "conversation_id": conversation_id
        })

from intelligence_service import IntelligenceService
from memory_service import MemoryService

async def run_memory_extraction_task(agent_id: int, user_id: int, text: str):
    """Background task to extract facts and store them."""
    try:
        intel = IntelligenceService(prisma)
        mem = MemoryService(prisma)
        
        # 1. Extract commands (fact, update, delete)
        commands = await intel.extract_facts(text, agent_id, user_id)
        
        if commands:
            # 2. Execute commands
            executed_count = 0
            for cmd in commands:
                result = None
                if cmd["type"] == "fact":
                    result = await mem.store_fact(agent_id, user_id, cmd["content"])
                elif cmd["type"] == "update":
                    # Now we use direct update by ID for 100% reliability
                    result = await mem.prisma.agentmemory.update(
                        where={"id": cmd["fact_id"]},
                        data={"fact": cmd["content"]}
                    )
                elif cmd["type"] == "delete":
                    # Now we use direct delete by ID
                    result = await mem.prisma.agentmemory.delete(
                        where={"id": cmd["fact_id"]}
                    )
                
                if result:
                    executed_count += 1
            
            if executed_count > 0:
                # 3. Inform user via WebSocket for Sonner toast
                await manager.broadcast_to_user(user_id, {
                    "type": "memory_update",
                    "agent_id": agent_id,
                    "count": executed_count,
                    "message": "Uuilly has consolidated your memories"
                })
                logger.info(f"Executed {executed_count} memory commands for agent {agent_id}, user {user_id}")
            else:
                await manager.broadcast_to_user(user_id, {"type": "memory_extraction_finished"})
        else:
            # Notify finished if no commands generated
            await manager.broadcast_to_user(user_id, {"type": "memory_extraction_finished"})
            
    except Exception as e:
        logger.error(f"Error in memory extraction task: {e}")
        # Ensure we clear state on error
        try:
            await manager.broadcast_to_user(user_id, {"type": "memory_extraction_finished"})
        except: pass

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Secure WebSocket endpoint with first-message authentication."""
    await websocket.accept()
    await manager.connect_unauthenticated(websocket)
    
    current_user: Optional[schemas.User] = None
    user_id: Optional[int] = None
    
    try:
        # 1. Wait for Auth Message with timeout
        try:
            auth_payload_raw = await asyncio.wait_for(websocket.receive_text(), timeout=5.0)
            auth_payload = json.loads(auth_payload_raw)
            
            if auth_payload.get("type") != "auth" or "token" not in auth_payload:
                logger.warning("First WS message was not an auth message.")
                await websocket.close(code=1008, reason="First message must be authentication.")
                return
            
            # Authenticate token
            current_user = await auth.get_current_user_from_token(auth_payload["token"])
            user_id = current_user.id
            
            # Transition to authenticated connection
            await manager.connect(websocket, user_id)
            logger.info(f"WebSocket authenticated for user {user_id}.")
            
            # Send confirmation
            await websocket.send_text(json.dumps({"type": "auth_success", "user_id": user_id}))
            
        except asyncio.TimeoutError:
            logger.warning("WebSocket authentication timeout.")
            await websocket.close(code=1008, reason="Authentication timeout.")
            return
        except Exception as e:
            logger.error(f"WebSocket authentication failed: {e}")
            await websocket.close(code=1008, reason="Invalid authentication token.")
            return

        # 2. Main loop for authenticated connection
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            # Handle Heartbeat
            if message_data.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
                continue

            logger.info(f"Raw WS data received from user {user_id}: {data}")
            
            text_input = message_data.get('text', '')
            agent_id = message_data.get('agent_id')
            conversation_id = message_data.get('conversation_id')
            files_data = message_data.get('files', [])
            
            if not conversation_id:
                logger.warning(f"User {user_id} sent WS message without conversation_id.")
                continue

            # Convert files_data to list of FileAttachment models
            files = []
            if files_data:
                files = [schemas.FileAttachment(**f) for f in files_data]

            if agent_id is not None:
                agent_id = int(agent_id)

            conversation_id = int(conversation_id)
            is_correction = message_data.get('is_correction', False)
            
            if not is_correction:
                # 2. Save normal user message
                user_msg = await save_message(text_input, "user", conversation_id, files=files)
                logger.info(f"User message saved to conversation {conversation_id}.")

                # Broadcast user message back with ID
                await manager.broadcast_to_user(user_id, {
                    "id": user_msg.id,
                    "conversation_id": conversation_id,
                    "response": text_input,
                    "sender": "user",
                    "done": True
                })
            else:
                logger.info(f"Received correction for conversation {conversation_id}. Not saving to DB.")

            # 3. Get agent and trigger background task
            if agent_id:
                agent = await prisma.agent.find_unique(where={"id": agent_id})
            else:
                agent = await prisma.agent.find_first(where={"is_active": True})

            if not agent:
                await manager.broadcast_to_user(user_id, {"error": "No active agent found", "conversation_id": conversation_id})
            else:
                if agent.config and isinstance(agent.config, str):
                    agent.config = json.loads(agent.config)

                # TRIGGER BACKGROUND TASK
                asyncio.create_task(run_agent_in_background(
                    user_id=user_id,
                    agent=agent,
                    text_input=text_input,
                    conversation_id=conversation_id,
                    files=files
                ))

                # --- Memory Extraction Task (ONLY IF EXPLICITLY REQUESTED) ---
                # Check both string and boolean keys for robustness
                is_memory_flag = message_data.get("is_memory") == True or message_data.get("is_memory") == "true"
                
                if agent.memory_enabled and is_memory_flag:
                    # Notify UI that extraction is starting
                    asyncio.create_task(manager.broadcast_to_user(user_id, {"type": "memory_extraction_started"}))
                    
                    asyncio.create_task(run_memory_extraction_task(
                        agent_id=agent.id,
                        user_id=user_id,
                        text=text_input
                    ))
                logger.info(f"Background task triggered for agent {agent.name}, user {user_id}, conversation {conversation_id}")

    except WebSocketDisconnect:
        if user_id:
            logger.warning(f"WebSocket disconnected for user {user_id}.")
        else:
            logger.warning("Unauthenticated WebSocket disconnected.")
    except Exception as e:
        if user_id:
            logger.error(f"Error in websocket for user {user_id}: {e}", exc_info=True)
        else:
            logger.error(f"Error in unauthenticated websocket: {e}", exc_info=True)
        try:
            await websocket.close()
        except:
            pass
    finally:
        manager.disconnect(websocket)
        if user_id:
            logger.info(f"WebSocket cleanup completed for user {user_id}.")
        else:
            logger.info("Unauthenticated WebSocket cleanup completed.")

# --- Agent Endpoints ---

@app.get("/api/v1/agents", response_model=List[schemas.Agent])
async def list_agents(db=Depends(get_db), current_user: schemas.User = Depends(auth.get_current_user)):
    """List all agents, filtered by user tags."""
    if current_user.role == "ADMIN":
        agents = await db.agent.find_many(
            order={"name": "asc"},
            include={"agent_tags": {"include": {"tag": True}}}
        )
    else:
        # Get tags associated with the current user
        user_tags = [tag.name for tag in current_user.tags]
        
        if not user_tags:
            # If user has no tags, they should see no agents
            return []

        # Find agents that have at least one tag matching the user's tags
        agents = await db.agent.find_many(
            where={
                "agent_tags": {
                    "some": {
                        "tag": {
                            "name": {"in": user_tags}
                        }
                    }
                }
            },
            order={"name": "asc"},
            include={"agent_tags": {"include": {"tag": True}}}
        )
        
    response_agents = []
    for agent in agents:
        response_agents.append(schemas.Agent(
            id=agent.id,
            name=agent.name,
            description=agent.description,
            type=agent.type,
            url=agent.url,
            config=json.loads(agent.config) if agent.config and isinstance(agent.config, str) else agent.config,
            is_active=agent.is_active,
            is_streaming_enabled=agent.is_streaming_enabled,
            icon=agent.icon,
            agent_auth_strategy=agent.agent_auth_strategy,
            agent_auth_header_name=agent.agent_auth_header_name,
            agent_auth_secret="********" if agent.agent_auth_secret else None,
            memory_enabled=agent.memory_enabled,
            memory_scope=agent.memory_scope,
            tags=[agt.tag.name for agt in agent.agent_tags]

        ))
    return response_agents

@app.post("/api/v1/agents", response_model=schemas.Agent, status_code=201)
async def create_agent(agent: schemas.AgentCreate, db=Depends(get_db), current_user: schemas.User = Depends(auth.get_current_admin_user)):
    """Create a new agent."""
    if agent.memory_enabled:
        has_credentials = await check_memory_extraction_credentials(db)
        if not has_credentials:
            raise HTTPException(
                status_code=400, 
                detail="Memory cannot be enabled without an active 'extraction' AI credential. Please configure one in the AI settings first."
            )

    create_data = agent.model_dump()
    tags = create_data.pop("tags", [])
    
    if "config" in create_data and isinstance(create_data["config"], dict):
        create_data["config"] = json.dumps(create_data["config"])

    # Encrypt secret if provided
    if create_data.get("agent_auth_secret"):
        create_data["agent_auth_secret"] = security.encrypt_secret(create_data["agent_auth_secret"])

    db_agent = await db.agent.create(
        data={
            **create_data,
            "agent_tags": {
                "create": [
                    {"tag": {"connectOrCreate": {"where": {"name": t}, "create": {"name": t}}}} for t in tags
                ]
            }
        },
        include={"agent_tags": {"include": {"tag": True}}}
    )
    
    return schemas.Agent(
        id=db_agent.id,
        name=db_agent.name,
        description=db_agent.description,
        type=db_agent.type,
        url=db_agent.url,
        config=json.loads(db_agent.config) if db_agent.config and isinstance(db_agent.config, str) else db_agent.config,
        is_active=db_agent.is_active,
        is_streaming_enabled=db_agent.is_streaming_enabled,
        icon=db_agent.icon,
        agent_auth_strategy=db_agent.agent_auth_strategy,
        agent_auth_header_name=db_agent.agent_auth_header_name,
        agent_auth_secret="********" if db_agent.agent_auth_secret else None,
        memory_enabled=db_agent.memory_enabled,
        memory_scope=db_agent.memory_scope,
        tags=[agt.tag.name for agt in db_agent.agent_tags]
    )

@app.get("/api/v1/agents/{agent_id}", response_model=schemas.Agent)
async def get_agent(agent_id: int, db=Depends(get_db), current_user: schemas.User = Depends(auth.get_current_admin_user)):
    """Get a specific agent."""
    db_agent = await db.agent.find_unique(where={"id": agent_id}, include={"agent_tags": {"include": {"tag": True}}})
    if not db_agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    return schemas.Agent(
        id=db_agent.id,
        name=db_agent.name,
        description=db_agent.description,
        type=db_agent.type,
        url=db_agent.url,
        config=json.loads(db_agent.config) if db_agent.config and isinstance(db_agent.config, str) else db_agent.config,
        is_active=db_agent.is_active,
        is_streaming_enabled=db_agent.is_streaming_enabled,
        icon=db_agent.icon,
        agent_auth_strategy=db_agent.agent_auth_strategy,
        agent_auth_header_name=db_agent.agent_auth_header_name,
        agent_auth_secret="********" if db_agent.agent_auth_secret else None,
        memory_enabled=db_agent.memory_enabled,
        memory_scope=db_agent.memory_scope,
        tags=[agt.tag.name for agt in db_agent.agent_tags]
    )

@app.put("/api/v1/agents/{agent_id}", response_model=schemas.Agent)
async def update_agent(agent_id: int, agent: schemas.AgentCreate, db=Depends(get_db), current_user: schemas.User = Depends(auth.get_current_admin_user)):
    """Update an existing agent."""
    if agent.memory_enabled:
        has_credentials = await check_memory_extraction_credentials(db)
        if not has_credentials:
            raise HTTPException(
                status_code=400, 
                detail="Memory cannot be enabled without an active 'extraction' AI credential. Please configure one in the AI settings first."
            )

    try:
        existing_agent = await db.agent.find_unique(where={"id": agent_id})
        if not existing_agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        # Reuse old tag IDs logic from original code if needed, but here we just re-create
        existing_full = await db.agent.find_unique(where={"id": agent_id}, include={"agent_tags": {"include": {"tag": True}}})
        old_tag_ids = [agt.tag.id for agt in existing_full.agent_tags]

        update_data = agent.model_dump()
        tags = update_data.pop("tags", [])
        
        if "config" in update_data and isinstance(update_data["config"], dict):
            update_data["config"] = json.dumps(update_data["config"])

        # Handle secret update logic
        new_secret = update_data.get("agent_auth_secret")
        if new_secret == "********":
            # Keep existing secret (already encrypted in DB)
            update_data["agent_auth_secret"] = existing_agent.agent_auth_secret
        elif new_secret:
            # Encrypt new secret
            update_data["agent_auth_secret"] = security.encrypt_secret(new_secret)
        else:
            # Clear or keep None
            update_data["agent_auth_secret"] = None

        await db.agenttag.delete_many(where={"agent_id": agent_id})
        
        db_agent = await db.agent.update(
            where={"id": agent_id},
            data={
                **update_data,
                "agent_tags": {
                    "create": [
                        {"tag": {"connectOrCreate": {"where": {"name": t}, "create": {"name": t}}}} for t in tags
                    ]
                }
            },
            include={"agent_tags": {"include": {"tag": True}}}
        )
        
        await cleanup_orphaned_tags(old_tag_ids, db)
        
        return schemas.Agent(
            id=db_agent.id,
            name=db_agent.name,
            description=db_agent.description,
            type=db_agent.type,
            url=db_agent.url,
            config=json.loads(db_agent.config) if db_agent.config and isinstance(db_agent.config, str) else db_agent.config,
            is_active=db_agent.is_active,
            is_streaming_enabled=db_agent.is_streaming_enabled,
            icon=db_agent.icon,
            agent_auth_strategy=db_agent.agent_auth_strategy,
            agent_auth_header_name=db_agent.agent_auth_header_name,
            agent_auth_secret="********" if db_agent.agent_auth_secret else None,
            memory_enabled=db_agent.memory_enabled,
            memory_scope=db_agent.memory_scope,
            tags=[agt.tag.name for agt in db_agent.agent_tags]
        )
    except Exception as e:
        logger.error(f"Error updating agent: {e}")
        raise HTTPException(status_code=404, detail="Agent not found")

@app.delete("/api/v1/agents/{agent_id}", status_code=204)
async def delete_agent(agent_id: int, db=Depends(get_db), current_user: schemas.User = Depends(auth.get_current_admin_user)):
    """Delete an agent."""
    try:
        # Fetch existing agent to get old tags before deletion
        existing_agent = await db.agent.find_unique(
            where={"id": agent_id},
            include={"agent_tags": {"include": {"tag": True}}}
        )
        if not existing_agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        old_tag_ids = [agt.tag.id for agt in existing_agent.agent_tags]

        # First, delete all associated AgentTag records
        await db.agenttag.delete_many(where={"agent_id": agent_id})
        # Then, delete the agent
        await db.agent.delete(where={"id": agent_id})

        # Clean up orphaned tags
        await cleanup_orphaned_tags(old_tag_ids, db)

    except prisma_errors.RecordNotFoundError:
        logger.warning(f"Agent with ID {agent_id} not found during deletion attempt.")
        raise HTTPException(status_code=404, detail="Agent not found")
    except Exception as e:
        logger.error(f"Unexpected error deleting agent {agent_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
    return None

# --- Tag Endpoints ---

@app.post("/api/v1/tags", response_model=schemas.Tag, status_code=201)
async def create_tag(tag: schemas.TagCreate, db=Depends(get_db), current_user: schemas.User = Depends(auth.get_current_admin_user)):
    """Create a new tag or return existing if name already exists."""
    # First, try to find an existing tag with the given name
    existing_tag = await db.tag.find_unique(where={"name": tag.name})
    if existing_tag:
        # If tag already exists, return it with 200 OK
        return Response(content=schemas.Tag.model_validate(existing_tag).model_dump_json(), media_type="application/json", status_code=200)
    
    # If not, create a new tag
    db_tag = await db.tag.create(data=tag.model_dump())
    return db_tag

@app.get("/api/v1/tags", response_model=List[schemas.Tag])
async def list_tags(db=Depends(get_db), current_user: schemas.User = Depends(auth.get_current_admin_user)):
    """List all tags."""
    tags = await db.tag.find_many(order={"name": "asc"})
    return tags

@app.get("/api/v1/tags/{tag_id}", response_model=schemas.Tag)
async def get_tag(tag_id: int, db=Depends(get_db), current_user: schemas.User = Depends(auth.get_current_admin_user)):
    """Get a specific tag."""
    db_tag = await db.tag.find_unique(where={"id": tag_id})
    if not db_tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    return db_tag

@app.put("/api/v1/tags/{tag_id}", response_model=schemas.Tag)
async def update_tag(tag_id: int, tag: schemas.TagCreate, db=Depends(get_db), current_user: schemas.User = Depends(auth.get_current_admin_user)):
    """Update an existing tag."""
    try:
        db_tag = await db.tag.update(
            where={"id": tag_id},
            data=tag.model_dump()
        )
        return db_tag
    except Exception:
        raise HTTPException(status_code=404, detail="Tag not found")

@app.delete("/api/v1/tags/{tag_id}", status_code=204)
async def delete_tag(tag_id: int, db=Depends(get_db), current_user: schemas.User = Depends(auth.get_current_admin_user)):
    """Delete a tag."""
    try:
        await db.tag.delete(where={"id": tag_id})
    except Exception:
        raise HTTPException(status_code=404, detail="Tag not found")
    return None

async def cleanup_orphaned_tags(tag_ids: List[int], db=Depends(get_db)):
    """
    Cleans up tags that are no longer associated with any agents or users.
    """
    for tag_id in tag_ids:
        # Check if tag is associated with any AgentTag records
        agent_associations = await db.agenttag.find_first(where={"tag_id": tag_id})
        
        # Check if tag is associated with any User records
        # This implicitly checks the _UserToTag relation
        user_associations = await db.user.find_first(where={"tags": {"some": {"id": tag_id}}})

        if not agent_associations and not user_associations:
            try:
                await db.tag.delete(where={"id": tag_id})
                logger.info(f"Cleaned up orphaned tag with ID: {tag_id}")
            except prisma_errors.RecordNotFoundError:
                logger.warning(f"Attempted to clean up non-existent tag with ID: {tag_id}")
            except Exception as e:
                logger.error(f"Error cleaning up orphaned tag {tag_id}: {e}", exc_info=True)

async def check_memory_extraction_credentials(db):
    """Checks if there is at least one active AI credential with 'extraction' task."""
    creds = await db.aicredentials.find_many(where={"is_active": True})
    for cred in creds:
        try:
            tasks = json.loads(cred.tasks) if isinstance(cred.tasks, str) else cred.tasks
            if "extraction" in tasks:
                return True
        except:
            continue
    return False

# --- User Endpoints ---

@app.post("/api/v1/users", response_model=schemas.User, status_code=201)
async def create_user(user: schemas.UserCreate, db=Depends(get_db), current_user: schemas.User = Depends(auth.get_current_active_supervisor_or_admin)):
    """Create a new user with tags. Supervisors can only create regular users."""
    if current_user.role == schemas.UserRole.SUPERVISOR:
        if user.role != schemas.UserRole.USER:
            raise HTTPException(status_code=403, detail="Supervisors can only create regular users.")

    create_data = user.model_dump(exclude={"tags", "password"}, exclude_unset=True)
    tags = user.tags or []
    
    # Handle optional password
    if user.password:
        create_data["hashed_password"] = security.get_password_hash(user.password)
    else:
        create_data["hashed_password"] = None

    tag_ops = [{"where": {"name": t}, "create": {"name": t}} for t in tags]
    
    try:
        db_user = await db.user.create(
            data={
                **create_data,
                "tags": {"connectOrCreate": tag_ops}
            },
            include={"tags": True}
        )
        return db_user
    except Exception as e:
        # Check specifically for unique constraint violation (email)
        # In prisma-client-py this is usually prisma_errors.UniqueViolationError
        if isinstance(e, prisma_errors.UniqueViolationError):
            raise HTTPException(
                status_code=409, 
                detail="A user with this email address is already registered."
            )
        logger.error(f"Error creating user: {e}")
        raise HTTPException(status_code=500, detail="Error creating user")

@app.get("/api/v1/users", response_model=List[schemas.User])
async def list_users(db=Depends(get_db), current_user: schemas.User = Depends(auth.get_current_active_supervisor_or_admin)):
    """List all users including their tags. Supervisors only see regular users."""
    if current_user.role == schemas.UserRole.ADMIN:
        users = await db.user.find_many(order={"email": "asc"}, include={"tags": True})
    else:
        # Supervisors only see users with role USER
        users = await db.user.find_many(
            where={"role": schemas.UserRole.USER},
            order={"email": "asc"},
            include={"tags": True}
        )
    return users

@app.get("/api/v1/users/me")
async def api_get_current_user(current_user: schemas.User = Depends(auth.get_current_user)):
    """Get current authenticated user details."""
    return current_user

@app.get("/api/v1/users/{user_id}", response_model=schemas.User)
async def get_user(user_id: int, db=Depends(get_db), current_user: schemas.User = Depends(auth.get_current_active_supervisor_or_admin)):
    """Get a specific user including their tags. Supervisors only see regular users."""
    db_user = await db.user.find_unique(where={"id": user_id}, include={"tags": True})
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if current_user.role == schemas.UserRole.SUPERVISOR and db_user.role != schemas.UserRole.USER:
        raise HTTPException(status_code=403, detail="Access denied to this user type.")
        
    return db_user

@app.put("/api/v1/users/{user_id}", response_model=schemas.User)
async def update_user(user_id: int, user: schemas.UserUpdate, db=Depends(get_db), current_user: schemas.User = Depends(auth.get_current_active_supervisor_or_admin)):
    """Update an existing user and their tags. Supervisors only manage regular users."""
    db_user = await db.user.find_unique(where={"id": user_id})
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if current_user.role == schemas.UserRole.SUPERVISOR:
        if db_user.role != schemas.UserRole.USER:
             raise HTTPException(status_code=403, detail="Supervisors can only edit regular users.")
        if user.role is not None and user.role != schemas.UserRole.USER:
             raise HTTPException(status_code=403, detail="Supervisors cannot assign privileged roles.")

    update_data = user.model_dump(exclude={"tags", "password"}, exclude_unset=True)
    
    # Handle optional password update
    if user.password:
        update_data["hashed_password"] = security.get_password_hash(user.password)
        
    tags = user.tags
    
    try:
        if tags is not None:
            db_user = await db.user.update(
                where={"id": user_id},
                data={
                    **update_data,
                    "tags": {"set": []} # Clear existing
                }
            )
            
            tag_ops = [{"where": {"name": t}, "create": {"name": t}} for t in tags]
            db_user = await db.user.update(
                where={"id": user_id},
                data={
                    "tags": {"connectOrCreate": tag_ops}
                },
                include={"tags": True}
            )
        else:
            db_user = await db.user.update(
                where={"id": user_id},
                data=update_data,
                include={"tags": True}
            )
            
        return db_user
    except Exception as e:
        logger.error(f"Error updating user: {e}")
        raise HTTPException(status_code=500, detail="Error updating user")

@app.delete("/api/v1/users/{user_id}", status_code=204)
async def delete_user(user_id: int, db=Depends(get_db), current_user: schemas.User = Depends(auth.get_current_active_supervisor_or_admin)):
    """Delete a user. Supervisors only manage regular users."""
    db_user = await db.user.find_unique(where={"id": user_id})
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if current_user.role == schemas.UserRole.SUPERVISOR and db_user.role != schemas.UserRole.USER:
        raise HTTPException(status_code=403, detail="Supervisors can only delete regular users.")

    try:
        await db.user.delete(where={"id": user_id})
    except Exception:
        raise HTTPException(status_code=404, detail="User not found")
    return None

MAX_UPLOAD_SIZE = 5 * 1024 * 1024 # 5MB

# --- File Endpoints ---

@app.post("/api/v1/files/upload", response_model=schemas.FileAttachment)
async def upload_file(
    file: UploadFile = File(...),
    conversation_id: Optional[int] = Query(None),
    current_user: schemas.User = Depends(auth.get_current_user)
):
    """Upload a file to a specific conversation or user temporary storage."""
    # Check file size
    if file.size and file.size > MAX_UPLOAD_SIZE:
        logger.warning(f"File upload rejected: {file.filename} is {file.size} bytes (limit: {MAX_UPLOAD_SIZE})")
        raise HTTPException(status_code=413, detail="File too large. Maximum allowed size is 5MB.")

    try:
        content = await file.read()
        
        # If no conversation_id, we could fallback to a 'tmp' folder, 
        # but based on requirements we expect one.
        if not conversation_id:
            logger.warning(f"File upload without conversation_id for user {current_user.id}")
            # For now, let's keep it robust by using 0 or a special string if missing,
            # but ideally frontend always sends it.
            conversation_id = 0 

        file_url = storage_service.save_file(current_user.id, file.filename, content, conversation_id)
        
        return schemas.FileAttachment(
            name=file.filename,
            type=file.content_type,
            url=file_url
        )
    except Exception as e:
        logger.error(f"File upload error for user {current_user.id}: {e}")
        raise HTTPException(status_code=500, detail="Could not upload file")

@app.get("/")
def read_root():
    """Root endpoint with a welcome message."""
    return {"message": "Welcome to UUilly API"}

# --- Auth Endpoints ---
@app.post("/api/v1/login/password", response_model=schemas.Token)
async def password_login(form_data: schemas.PasswordLoginRequest, db=Depends(get_db)):
    """Authenticates a user using email and password (bcrypt)."""
    user = await db.user.find_unique(where={"email": form_data.email})
    
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email, "user_id": user.id, "role": str(user.role), "picture": user.profile_photo_url}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

# --- Google OAuth Endpoints ---

@app.get("/api/auth/google/login")
async def google_login():
    """Redirects the user to the Google OAuth login page."""
    if not google_sso:
        raise HTTPException(status_code=501, detail="Google OAuth not configured")
    with google_sso:
        return await google_sso.get_login_redirect()

@app.get("/api/auth/google/callback")
async def google_callback(request: Request, db=Depends(get_db)):
    """Handles the Google OAuth callback and redirects to the application root with the JWT token."""
    if not google_sso:
        raise HTTPException(status_code=501, detail="Google OAuth not configured")
    
    with google_sso:
        google_user = await google_sso.verify_and_process(request)
    
    if not google_user or not google_user.email:
        raise HTTPException(status_code=400, detail="Failed to retrieve user information from Google")

    # Whitelist check: user MUST exist in our database
    user = await db.user.find_unique(where={"email": google_user.email})
    
    if not user:
        logger.warning(f"Google login attempt denied: {google_user.email} not in whitelist.")
        frontend_url = os.getenv("FRONTEND_URL", PUBLIC_SERVER_URL)
        error_msg = "User not authorized. Please contact the administrator."
        import urllib.parse
        encoded_error = urllib.parse.quote(error_msg)
        from starlette.responses import RedirectResponse
        return RedirectResponse(url=f"{frontend_url}/login?error={encoded_error}")
    
    # Update user info from Google (photo always synced, names if missing)
    update_data = {}
    if not user.first_name and google_user.first_name:
        update_data["first_name"] = google_user.first_name
    if not user.last_name and google_user.last_name:
        update_data["last_name"] = google_user.last_name
    if google_user.picture:
        update_data["profile_photo_url"] = google_user.picture

    if update_data:
        user = await db.user.update(where={"id": user.id}, data=update_data)
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email, "user_id": user.id, "role": str(user.role), "picture": user.profile_photo_url}, expires_delta=access_token_expires
    )
    
    # Redirect back to frontend with the token
    frontend_url = os.getenv("FRONTEND_URL", PUBLIC_SERVER_URL)
    from starlette.responses import RedirectResponse
    return RedirectResponse(url=f"{frontend_url}/?token={access_token}")
@app.post("/api/v1/conversations", response_model=schemas.Conversation, status_code=201)
async def api_create_conversation(conv_data: schemas.ConversationCreate, db=Depends(get_db), current_user: schemas.User = Depends(auth.get_current_user)):
    """Create a new conversation record."""
    if current_user.role != "ADMIN" and conv_data.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to create conversation for another user")
    
    import database as db_methods
    db_conv = await db_methods.create_conversation(conv_data.user_id, conv_data.agent_id, conv_data.title)
    
    # Notify user's active WebSockets about the new conversation
    try:
        # Prisma models in python are pydantic models
        conv_payload = json.loads(json.dumps(db_conv.model_dump(), default=str))
        await manager.broadcast_to_user(current_user.id, {
            "type": "new_conversation",
            "conversation": conv_payload
        })
    except Exception as e:
        logger.error(f"Failed to broadcast new_conversation event: {e}")

    return db_conv

@app.get("/api/v1/conversations", response_model=List[schemas.Conversation])
async def api_list_conversations(agent_id: Optional[int] = Query(None), db=Depends(get_db), current_user: schemas.User = Depends(auth.get_current_user)):
    """List all conversations for the authenticated user, optionally filtered by agent."""
    import database as db_methods
    conversations = await db_methods.get_user_conversations(current_user.id, agent_id=agent_id)
    return conversations

@app.get("/api/v1/conversations/{conversation_id}", response_model=schemas.Conversation)
async def api_get_conversation(conversation_id: int, db=Depends(get_db), current_user: schemas.User = Depends(auth.get_current_user)):
    """Get a specific conversation and its messages."""
    import database as db_methods
    user_id_filter = None if current_user.role == "ADMIN" else current_user.id
    
    conversation = await db_methods.get_conversation(conversation_id, user_id_filter)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation

@app.delete("/api/v1/conversations/{conversation_id}", status_code=204)
async def api_delete_conversation(conversation_id: int, db=Depends(get_db), current_user: schemas.User = Depends(auth.get_current_user)):
    """Delete a conversation."""
    import database as db_methods
    user_id_filter = None if current_user.role == "ADMIN" else current_user.id
    
    result = await db_methods.delete_conversation(conversation_id, user_id_filter)
    if result is None:
         raise HTTPException(status_code=404, detail="Conversation not found or not owned by user")
    return None

@app.put("/api/v1/conversations/{conversation_id}", response_model=schemas.Conversation)
async def api_update_conversation_title(conversation_id: int, title_data: schemas.ConversationBase, db=Depends(get_db), current_user: schemas.User = Depends(auth.get_current_user)):
    """Update a conversation's title."""
    import database as db_methods
    db_conv = await db_methods.update_conversation_title(conversation_id, current_user.id, title_data.title)
    if not db_conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return db_conv

@app.get("/api/v1/conversations/{conversation_id}/messages", response_model=List[schemas.Message])
async def api_get_conversation_messages(conversation_id: int, db=Depends(get_db), current_user: schemas.User = Depends(auth.get_current_user)):
    """Get all messages for a specific conversation."""
    import database as db_methods
    user_id_filter = None if current_user.role == "ADMIN" else current_user.id
    
    messages = await db_methods.get_conversation_messages(conversation_id, user_id_filter)
    if not messages:
        raise HTTPException(status_code=404, detail="Messages not found for this conversation or conversation not owned by user")
    return messages

@app.put("/api/v1/conversations/{conversation_id}/messages/{message_id}", response_model=schemas.Message)
async def api_update_message(conversation_id: int, message_id: int, msg_data: schemas.MessageUpdate, background_tasks: BackgroundTasks, db=Depends(get_db), current_user: schemas.User = Depends(auth.get_current_user)):
    """Update an agent message's text and trigger a streaming acknowledgement from the agent."""
    import database as db_methods
    user_id_filter = None if current_user.role == "ADMIN" else current_user.id
    
    try:
        updated_msg = await db_methods.update_message(message_id, conversation_id, user_id_filter, msg_data.text)
        if not updated_msg:
             raise HTTPException(status_code=404, detail="Message not found or conversation not owned by user")
        
        # 1. Get agent info to trigger response
        conv = await db_methods.get_conversation(conversation_id, user_id_filter)
        if conv and conv.agent:
            # 2. Construct notification prompt
            notification_prompt = (
                f"SYSTEM NOTIFICATION: The user has corrected your previous response. "
                f"The new corrected content is: \"{msg_data.text}\". "
                f"Please acknowledge this update by responding ONLY with the following exact text: 'Message updated!'. "
                "Do not add any other words, emojis, or explanations."
            )
            
            # 3. Trigger standard background agent task (this handles streaming via WS)
            background_tasks.add_task(
                run_agent_in_background,
                current_user.id,
                conv.agent,
                notification_prompt,
                conversation_id
            )

        return updated_msg
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))

@app.delete("/api/v1/conversations/{conversation_id}/messages/{message_id}", status_code=204)
async def api_delete_message(conversation_id: int, message_id: int, db=Depends(get_db), current_user: schemas.User = Depends(auth.get_current_user)):
    """Delete a specific message."""
    import database as db_methods
    user_id_filter = None if current_user.role == "ADMIN" else current_user.id
    
    deleted = await db_methods.delete_message(message_id, conversation_id, user_id_filter)
    if not deleted:
        raise HTTPException(status_code=404, detail="Message not found or conversation not owned by user")
    return None

# --- System Settings Endpoints ---

@app.get("/api/v1/settings", response_model=schemas.SystemSettings)
async def get_system_settings(db=Depends(get_db), current_user: schemas.User = Depends(auth.get_current_admin_user)):
    """Get global system settings."""
    settings_service = SettingsService(db)
    settings = await settings_service.get_settings()
    # Mask API key in response
    settings_dict = settings.model_dump()
    if settings_dict.get("llm_api_key"):
        settings_dict["llm_api_key"] = "********"
    return settings_dict

@app.put("/api/v1/settings", response_model=schemas.SystemSettings)
async def update_system_settings(settings_data: schemas.SystemSettingsUpdate, db=Depends(get_db), current_user: schemas.User = Depends(auth.get_current_admin_user)):
    """Update global system settings."""
    settings_service = SettingsService(db)
    
    # If the provided key is masked, we don't update it (keep existing)
    update_dict = settings_data.model_dump(exclude_unset=True)
    if update_dict.get("llm_api_key") == "********":
        del update_dict["llm_api_key"]
        
    settings = await settings_service.update_settings(**update_dict)
    
    # Mask API key in response
    settings_dict = settings.model_dump()
    if settings_dict.get("llm_api_key"):
        settings_dict["llm_api_key"] = "********"
    return settings_dict

@app.post("/api/v1/settings/reset-prompt", response_model=schemas.SystemSettings)
async def reset_titling_prompt(db=Depends(get_db), current_user: schemas.User = Depends(auth.get_current_admin_user)):
    """Reset titling prompt to default."""
    settings_service = SettingsService(db)
    return await settings_service.reset_titling_prompt()

@app.post("/api/v1/settings/reset-memory-prompt", response_model=schemas.SystemSettings)
async def reset_memory_prompt(db=Depends(get_db), current_user: schemas.User = Depends(auth.get_current_admin_user)):
    """Reset memory extraction prompt to default."""
    settings_service = SettingsService(db)
    return await settings_service.reset_memory_extraction_prompt()

    
    # Mask API key in response
    settings_dict = settings.model_dump()
    if settings_dict.get("llm_api_key"):
        settings_dict["llm_api_key"] = "********"
    return settings_dict

@app.get("/api/v1/settings/models")
async def fetch_available_llm_models(
    provider: str = Query(...), 
    credential_id: Optional[int] = Query(None),
    db=Depends(get_db), 
    current_user: schemas.User = Depends(auth.get_current_admin_user)
):
    """Fetch available models for a specific LLM provider or credential."""
    api_key = None
    
    # 1. Map frontend provider name to DB Enum (uppercase)
    # google/gemini -> GEMINI, openai -> OPENAI, mistral -> MISTRAL
    provider_map = {
        "google": "GEMINI",
        "gemini": "GEMINI",
        "openai": "OPENAI",
        "mistral": "MISTRAL"
    }
    db_provider = provider_map.get(provider.lower(), provider.upper())
    
    if credential_id:
        # 2. Use specific centralized credential
        cred = await db.aicredentials.find_unique(where={"id": credential_id})
        if cred:
            api_key = security.decrypt_secret(cred.api_key)
    
    if not api_key:
        # 3. Try to find ANY active credential for this provider as first choice
        cred = await db.aicredentials.find_first(
            where={"provider": db_provider, "is_active": True}
        )
        if cred:
            api_key = security.decrypt_secret(cred.api_key)

    if not api_key:
        # 4. Fallback to legacy global settings ONLY if provider matches
        settings_service = SettingsService(db)
        settings = await settings_service.get_settings()
        if settings.llm_provider.lower() == provider.lower():
            if settings.llm_api_key:
                api_key = security.decrypt_secret(settings.llm_api_key)

    if not api_key:
        return []
        
    # titling_service_instance.fetch_available_models handles provider normalization internally now
    return await titling_service_instance.fetch_available_models(provider.lower(), api_key)


# --- AI Credentials Endpoints ---

@app.get("/api/v1/ai-credentials", response_model=List[schemas.AICredentials])
async def list_ai_credentials(db=Depends(get_db), current_user: schemas.User = Depends(auth.get_current_admin_user)):
    """List all AI credentials (Admin only)."""
    return await db.aicredentials.find_many(order={"updated_at": "desc"})

@app.post("/api/v1/ai-credentials", response_model=schemas.AICredentials, status_code=201)
async def create_ai_credential(payload: schemas.AICredentialsCreate, db=Depends(get_db), current_user: schemas.User = Depends(auth.get_current_admin_user)):
    """Create new AI credentials (Admin only)."""
    # Encrypt API Key
    encrypted_key = security.encrypt_secret(payload.api_key)
    
    return await db.aicredentials.create(
        data={
            "name": payload.name,
            "provider": payload.provider,
            "api_key": encrypted_key,
            "is_active": payload.is_active,
            "tasks": Json(payload.tasks)
        }
    )

@app.put("/api/v1/ai-credentials/{cred_id}", response_model=schemas.AICredentials)
async def update_ai_credential(cred_id: int, payload: schemas.AICredentialsUpdate, db=Depends(get_db), current_user: schemas.User = Depends(auth.get_current_admin_user)):
    """Update existing AI credentials (Admin only)."""
    data = payload.model_dump(exclude_unset=True)
    
    if "api_key" in data and data["api_key"]:
        data["api_key"] = security.encrypt_secret(data["api_key"])
    
    if "tasks" in data:
        data["tasks"] = Json(data["tasks"])

    try:
        return await db.aicredentials.update(
            where={"id": cred_id},
            data=data
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Credential not found")

@app.delete("/api/v1/ai-credentials/{cred_id}", status_code=204)
async def delete_ai_credential(cred_id: int, db=Depends(get_db), current_user: schemas.User = Depends(auth.get_current_admin_user)):
    """Delete AI credentials (Admin only)."""
    try:
        await db.aicredentials.delete(where={"id": cred_id})
        return Response(status_code=204)
    except Exception:
        raise HTTPException(status_code=404, detail="Credential not found")

# --- Agent Memory Endpoints ---

@app.get("/api/v1/memories")
async def list_memories(
    agent_id: Optional[int] = None,
    user_id: Optional[int] = None,
    memory_type: Optional[str] = "all", # all, global, private
    db=Depends(get_db),
    current_user: schemas.User = Depends(auth.get_current_active_supervisor_or_admin)
):
    """List all memories, optionally filtered (Supervisor/Admin)."""
    where = {}
    if agent_id:
        where["agent_id"] = agent_id
    if user_id:
        where["user_id"] = user_id
    
    if memory_type == "global":
        where["user_id"] = None
    elif memory_type == "private":
        where["user_id"] = {"not": None}

    # Supervisor RBAC: Exclude memories of Admin users
    if current_user.role == schemas.UserRole.SUPERVISOR:
        # We need to filter by the associated user's role
        # Prisma doesn't support direct filtering on relation's relation in where easily for nested roles,
        # but we can use 'user': {'is_not': {'role': 'ADMIN'}} or similar if supported.
        # Alternatively, find all admins first, or use a complex where.
        
        # A more performant way in Prisma:
        # where["user"] = {"is_not": {"role": schemas.UserRole.ADMIN}}
        # But wait, global memories have user_id = None. We MUST include them.
        
        # Correct logic: (user_id is None) OR (user.role != ADMIN)
        original_where = where.copy()
        where = {
            "AND": [
                original_where,
                {
                    "OR": [
                        {"user_id": None},
                        {"user": {"is_not": {"role": schemas.UserRole.ADMIN}}}
                    ]
                }
            ]
        }

    return await db.agentmemory.find_many(
        where=where,
        include={"agent": True, "user": True},
        order={"updated_at": "desc"}
    )

@app.post("/api/v1/memories", status_code=201)
async def create_memory(
    payload: dict, # simple dict for flexibility: {agent_id, user_id, fact}
    db=Depends(get_db),
    current_user: schemas.User = Depends(auth.get_current_active_supervisor_or_admin)
):
    """Create a memory fact manually (Supervisor/Admin)."""
    return await db.agentmemory.create(
        data={
            "fact": payload["fact"],
            "agent_id": payload["agent_id"],
            "user_id": payload.get("user_id") # Can be null for GLOBAL
        }
    )
async def process_bulk_upload(content: str, agent_id: int, user_id: int, provider: str, api_key: str, model: Optional[str] = None):
    """Background task to atomize and store facts from a file."""
    try:
        from intelligence_service import IntelligenceService
        from memory_service import MemoryService
        from database import prisma, init_db
        
        # Ensure connected
        await init_db()
        
        intel = IntelligenceService(prisma)
        mem_service = MemoryService(prisma)
        
        # 1. Atomize content
        facts = await intel.atomize_content(content, provider, api_key, model)
        
        # 2. Store facts
        stored_count = 0
        for fact in facts:
            await mem_service.store_fact(agent_id, user_id, fact)
            stored_count += 1
            
        # 3. Notify user via WebSocket
        await manager.broadcast_to_user(user_id, {
            "type": "bulk_upload_finished",
            "agent_id": agent_id,
            "count": stored_count,
            "message": f"Bulk upload complete: {stored_count} facts learned."
        })
        logger.info(f"Bulk upload finished for agent {agent_id}: {stored_count} facts stored.")
    except Exception as e:
        logger.error(f"Error in process_bulk_upload: {e}", exc_info=True)
        await manager.broadcast_to_user(user_id, {
            "type": "bulk_upload_error",
            "message": f"Error during bulk upload: {str(e)}"
        })

@app.post("/api/v1/memories/bulk-upload")
async def bulk_upload_memory(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    agent_id: int = Form(...),
    provider: str = Form(...),
    model: Optional[str] = Form(None),
    db=Depends(get_db),
    current_user: schemas.User = Depends(auth.get_current_active_supervisor_or_admin)
):
    """Bulk upload a file for atomization and memory storage (Supervisor/Admin)."""
    # 1. Validate file extension
    if not file.filename.endswith(('.txt', '.md')):
        raise HTTPException(status_code=400, detail="Only .txt and .md files are supported.")
    
    # 2. Read content
    try:
        content = (await file.read()).decode("utf-8")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read file. Ensure it is UTF-8 encoded.")

    # 3. Get API Key for the provider
    from intelligence_service import IntelligenceService
    intel = IntelligenceService(db)
    # We look for a credential that supports 'extraction' for this provider
    creds = await db.aicredentials.find_many(where={"provider": provider.upper(), "is_active": True})
    if not creds:
        raise HTTPException(status_code=400, detail=f"No active credentials found for {provider}")
    
    # Decrypt key
    import security
    api_key = security.decrypt_secret(creds[0].api_key)

    # 4. Queue background task
    background_tasks.add_task(
        process_bulk_upload, 
        content, 
        agent_id, 
        current_user.id, 
        provider, 
        api_key, 
        model
    )

    return {"message": "Bulk upload started in background."}

@app.put("/api/v1/memories/{memory_id}")
async def update_memory(
    memory_id: int,
    payload: dict, # simple dict: {fact: "new fact"}
    db=Depends(get_db),
    current_user: schemas.User = Depends(auth.get_current_active_supervisor_or_admin)
):
    """Update a memory fact (Supervisor/Admin)."""
    try:
        from memory_service import MemoryService
        memory_service = MemoryService(db)
        updated = await memory_service.update_fact(memory_id, payload["fact"])
        if not updated:
            raise HTTPException(status_code=404, detail="Memory not found")
        return updated
    except Exception as e:
        logger.error(f"Error updating memory {memory_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/v1/memories/{memory_id}", status_code=204)
async def delete_memory(memory_id: int, db=Depends(get_db), current_user: schemas.User = Depends(auth.get_current_active_supervisor_or_admin)):
    """Delete a memory fact (Supervisor/Admin)."""
    try:
        where = {"id": memory_id}
        
        # Supervisor RBAC: Cannot delete Admin memories
        if current_user.role == schemas.UserRole.SUPERVISOR:
            where["OR"] = [
                {"user_id": None},
                {"user": {"is_not": {"role": schemas.UserRole.ADMIN}}}
            ]

        # Use delete_many with filtered where to handle RBAC in one query
        # since delete() only takes unique where.
        deleted = await db.agentmemory.delete_many(where=where)
        if deleted == 0:
             raise HTTPException(status_code=404, detail="Memory not found or access denied")
             
        return Response(status_code=204)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting memory {memory_id}: {e}")
        raise HTTPException(status_code=404, detail="Memory not found")

@app.post("/api/v1/memories/bulk-delete", status_code=204)
async def bulk_delete_memories(
    payload: dict, # {ids: [1, 2, 3]}
    db=Depends(get_db),
    current_user: schemas.User = Depends(auth.get_current_active_supervisor_or_admin)
):
    """Delete multiple memory facts at once (Supervisor/Admin)."""

    try:
        ids = payload.get("ids", [])
        if not ids:
            return Response(status_code=204)
            
        where = {"id": {"in": ids}}
        
        # Supervisor RBAC: Cannot delete Admin memories
        if current_user.role == schemas.UserRole.SUPERVISOR:
            where["AND"] = [
                {"id": {"in": ids}},
                {
                    "OR": [
                        {"user_id": None},
                        {"user": {"is_not": {"role": schemas.UserRole.ADMIN}}}
                    ]
                }
            ]

        await db.agentmemory.delete_many(where=where)
        return Response(status_code=204)
    except Exception as e:
        logger.error(f"Error in bulk delete: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete memories")
