# Copyright (c) 2026 Gustavo Alejandro Medde.
# Licensed under the Apache License, Version 2.0.
# See LICENSE.md in the project root for more information.

"""External services integration (n8n, Flowise).

This module provides a service class to handle asynchronous HTTP calls
to configured external automation and AI flow engines.
"""

import httpx
import os
import logging
import json
import base64
from prisma.models import Agent
import uuid
from typing import Optional
from prisma import Prisma
from storage_service import StorageService
from memory_service import MemoryService
from intelligence_service import IntelligenceService
import security

logger = logging.getLogger(__name__)

class ExternalService:
    """Service to handle communication with n8n and Flowise."""

    def __init__(self, prisma: Optional[Prisma] = None):
        """Initializes URLs from environment variables."""
        # Base URL for public access to files, default to localhost:8080
        self.base_url = os.getenv("PUBLIC_SERVER_URL", "http://localhost:8080").rstrip("/")
        self.storage_service = StorageService()
        self.storage_base_path = "storage" # Matches StorageService default
        self.prisma = prisma
        self.memory_service = MemoryService(prisma) if prisma else None
        self.intelligence_service = IntelligenceService(prisma) if prisma else None

    def _get_auth_headers(self, agent: Agent) -> dict:
        """Decrypts and prepares authentication headers based on agent strategy."""
        headers = {}
        strategy = agent.agent_auth_strategy
        secret = security.decrypt_secret(agent.agent_auth_secret)

        if not secret or strategy == "NONE":
            return headers

        if strategy == "BEARER":
            headers["Authorization"] = f"Bearer {secret}"
        elif strategy == "HEADER" and agent.agent_auth_header_name:
            headers[agent.agent_auth_header_name] = secret
        
        return headers

    async def notify_agent_edit(self, agent: Agent, conversation_id: int, new_text: str):
        """
        Notifies the external agent (n8n/Flowise) that a previous message was edited.
        Requests a short 'Message saved!' confirmation.
        """
        notification_prompt = (
            f"SYSTEM NOTIFICATION: The user has corrected your previous response. "
            f"The new corrected content is: \"{new_text}\". "
            f"Please acknowledge this update by responding ONLY with the following exact text: 'Message updated!'. "
            "Do not add any other words, emojis, or explanations."
        )
        
        # We call the agent with this hidden prompt
        # We don't want to store this prompt as a message in our DB, 
        # but the agent's response ("Message saved!") WILL be stored by the caller if desired.
        try:
            # We use call_agent logic but with the hidden prompt
            # Note: call_agent handles n8n/flowise distinction internally via agent.type (if implemented there)
            # For now, let's assume we reuse the same communication logic.
            response = await self.call_agent(agent, notification_prompt, conversation_id=conversation_id)
            return response
        except Exception as e:
            logger.error(f"Failed to notify agent of edit: {e}")
            return None

    async def call_agent(self, agent: Agent, text: str, conversation_id: int = None, user_id: int = None, files: list = None):
        """Calls a dynamic agent with the provided text and optional files.
        
        Args:
            agent: The Agent model instance from the database.
            text: The user message.
            conversation_id: Optional ID to maintain session memory.
            user_id: Optional ID for memory retrieval.
            files: Optional list of file attachments (schemas.FileAttachment or dict).
            
        Returns:
            dict or AsyncGenerator: The response from the external agent.
        """
        # --- Injection Logic (ONLY UNTIL FIRST BOT RESPONSE) ---
        modified_text = text
        try:
            if self.prisma and conversation_id:
                # Check if the bot has already responded in this conversation
                bot_msg_count = await self.prisma.message.count(where={
                    "conversation_id": conversation_id,
                    "sender": "bot"
                })
                
                # If bot has never responded, we inject context (Memory Facts)
                if bot_msg_count == 0:
                    # 1. Persistent Memory Injection
                    if agent.memory_enabled and self.memory_service and self.intelligence_service and user_id:
                        memories = await self.memory_service.get_relevant_facts(agent.id, user_id)
                        if memories:
                            # Apply relevance filtering to avoid context saturation and noise
                            relevant_memories = await self.intelligence_service.filter_relevance(text, memories, top_n=8)
                            
                            if relevant_memories:
                                memory_prompt = "\n--- BACKGROUND CONTEXT (STRICTLY CONFIDENTIAL) ---\n"
                                memory_prompt += "The following are atomic facts or instructions previously learned about the user. \n"
                                memory_prompt += "STRICT RULES FOR THIS CONTEXT:\n"
                                memory_prompt += "1. NEVER mention that you have access to this background information.\n"
                                memory_prompt += "2. ONLY use this data to inform your response IF it is DIRECTLY relevant to the current user query.\n"
                                memory_prompt += "3. DO NOT use this information to initiate new topics, ask proactive questions about these facts, or force them into the conversation.\n"
                                memory_prompt += "4. Prioritize your core identity and system instructions if any conflict arises.\n"
                                memory_prompt += "\n".join([f"- {m.fact}" for m in relevant_memories])
                                memory_prompt += "\n--- END OF BACKGROUND CONTEXT ---\n\n"
                                
                                # Prepend facts
                                modified_text = memory_prompt + (modified_text or "")
                                logger.info(f"Injected {len(relevant_memories)} relevant facts for agent {agent.id}")
        except Exception as e:
            logger.error(f"SILENT ERROR in injection logic: {e}. Proceeding with original text.")
            # We don't change modified_text, just continue

        # Inject placeholder if text is empty/whitespace and files are present
        if (not modified_text or not modified_text.strip()) and files and len(files) > 0:
            modified_text = "[Attachment]"

        # Prepare auth headers
        auth_headers = self._get_auth_headers(agent)

        # Convert schemas to dicts if necessary
        processed_files = []
        if files:
            for f in files:
                if hasattr(f, "model_dump"):
                    processed_files.append(f.model_dump())
                else:
                    processed_files.append(f)

        if agent.type == "flowise":
            return await self.call_flowise(modified_text, override_url=agent.url, streaming=agent.is_streaming_enabled, conversation_id=conversation_id, files=processed_files, auth_headers=auth_headers, user_id=user_id)
        else:
            return await self.call_n8n(modified_text, override_url=agent.url, streaming=agent.is_streaming_enabled, conversation_id=conversation_id, files=processed_files, auth_headers=auth_headers)

    async def call_n8n(self, text: str, override_url: str = None, streaming: bool = False, conversation_id: int = None, files: list = None, auth_headers: dict = None):
        """Calls an n8n webhook with the provided text and files.
        
        Args:
            text: The user message to send to n8n.
            override_url: The URL to use from the agent.
            streaming: Whether to request a streaming response.
            conversation_id: Optional ID to maintain session memory.
            files: Optional list of file attachments.
            auth_headers: Optional dict of authentication headers.
            
        Returns:
            dict: The JSON response from n8n or an error dict.
        """
        url = override_url
        if not url:
            logger.error("n8n URL not provided from agent")
            return {"error": "n8n URL not provided"}
        
        # Use conversation_id as sessionId if provided, otherwise generate a random one
        session_id = f"uuilly-{conversation_id}" if conversation_id else f"n8n-{uuid.uuid4().hex}"
        
        # Prepare file objects for n8n
        n8n_files = []
        if files:
            for f in files:
                file_name = f.get("name", "")
                file_type = f.get("type", "")
                file_url = f.get("url", "")
                
                # Ensure we have an absolute URL for reference using internal network
                absolute_url = self.storage_service.get_internal_url(file_url)
                
                file_item = {
                    "fileName": file_name,
                    "mimeType": file_type,
                    "fileUrl": absolute_url
                }

                # Add base64 data for local/offline robustness
                rel_path = file_url.lstrip("/")
                if os.path.exists(rel_path):
                    try:
                        with open(rel_path, "rb") as file_bytes:
                            encoded_string = base64.b64encode(file_bytes.read()).decode("utf-8")
                        file_item["data"] = encoded_string
                    except Exception as e:
                        logger.error(f"Error encoding file for n8n {file_name}: {e}")

                n8n_files.append(file_item)

        payload = [{"sessionId": session_id, "action": "sendMessage", "chatInput": text, "files": n8n_files}]

        if streaming:
            return self._handle_n8n_streaming(url, payload, auth_headers)

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, json=payload, headers=auth_headers, timeout=10.0)
                response.raise_for_status()
                response_json = response.json()
                
                # Check for n8n specific error response
                if isinstance(response_json, dict) and response_json.get("type") == "error":
                    # If n8n returns an error, format it consistently
                    return {"error": response_json.get("content", "Unknown n8n error")}
                
                return response_json
            except Exception as e:
                logger.error(f"Error calling n8n: {e}")
                return {"error": str(e)}
            
    async def _extract_text_with_flowise(self, file_path: str, file_name: str, file_type: str, attachment_url: str, auth_headers: dict = None) -> Optional[str]:
        """Extracts text from a document using Flowise's internal extraction API."""
        try:
            if not os.path.exists(file_path):
                logger.warning(f"File not found for extraction: {file_path}")
                return None

            async with httpx.AsyncClient() as client:
                with open(file_path, "rb") as f:
                    files = {"files": (file_name, f, file_type)}
                    logger.info(f"Extracting text from {file_name} via {attachment_url}")
                    response = await client.post(attachment_url, files=files, headers=auth_headers, timeout=60.0)
                    response.raise_for_status()
                    data = response.json()
                    
                    # Flowise returns a list of extracted blocks/files
                    if isinstance(data, list):
                        content_parts = [item.get("content", "") for item in data if isinstance(item, dict)]
                        return "\n".join(content_parts).strip()
                    elif isinstance(data, dict):
                        return data.get("content")
                    return None
        except Exception as e:
            logger.error(f"Error extracting text from {file_name} via Flowise: {e}")
            return None           

    async def call_flowise(self, text: str, override_url: str = None, streaming: bool = False, conversation_id: int = None, files: list = None, auth_headers: dict = None, user_id: int = None):
        """Calls a Flowise prediction endpoint with the provided text and files.
        
        Args:
            text: The user message (question) to send to Flowise.
            override_url: The URL to use from the agent.
            streaming: Whether to request a streaming response.
            conversation_id: Optional ID to maintain session memory.
            files: Optional list of file attachments.
            auth_headers: Optional dict of authentication headers.
            user_id: Optional user ID for UI notifications.
            
        Returns:
            dict or AsyncGenerator: The response from Flowise or an error dict.
        """
        logger.info(f"call_flowise called: streaming={streaming}, url={override_url}, conv_id={conversation_id}, files={len(files) if files else 0}")
        url = override_url
        if not url:
            logger.error("Flowise URL not provided from agent")
            return {"error": "Flowise URL not provided"}

        # Use conversation_id as sessionId if provided
        session_id = f"uuilly-{conversation_id}" if conversation_id else f"flowise-{uuid.uuid4().hex}"
        
        # Parse chatflow_id and base URL for Double Step (Extraction)
        # Example URL: http://flowise:3001/api/v1/prediction/123-abc
        chatflow_id = url.split("/")[-1]
        base_flowise_url = url.split("/api/v1/")[0]
        attachment_url = f"{base_flowise_url}/api/v1/attachments/{chatflow_id}/{session_id}"

        final_user_message = text or ""
        uploads = []
        extracted_texts = []

        # Check if we have documents to extract (to notify UI)
        has_documents = any(not f.get("type", "").startswith("image/") and not ("text" in f.get("type", "") or f.get("name", "").endswith((".md", ".txt", ".json"))) for f in (files or []))
        
        if has_documents and user_id:
            try:
                from main import manager
                await manager.broadcast_to_user(user_id, {"type": "extraction_started"})
                logger.info(f"Notification 'extraction_started' sent for user {user_id}")
            except Exception as e:
                logger.error(f"Failed to send extraction_started notification: {e}")

        if files:
            for file_info in files:
                file_name = file_info.get("name", "")
                file_type = file_info.get("type", "")
                file_url = file_info.get("url", "")
                
                # relative path from backend root is storage/users/1/attachments/tmp/file.png
                rel_path = file_url.lstrip("/")
                
                # 🖼️ IMÁGENES: Enviar como Base64 (Estrategia Sinapsys v2)
                if file_type.startswith('image/'):
                    try:
                        if os.path.exists(rel_path):
                            with open(rel_path, 'rb') as f:
                                encoded = base64.b64encode(f.read()).decode('utf-8')
                            
                            uploads.append({
                                "data": f"data:{file_type};base64,{encoded}",
                                "type": "file",
                                "name": file_name,
                                "mime": file_type
                            })
                        else:
                            logger.warning(f"Image file not found for Base64 encoding: {rel_path}")
                    except Exception as e:
                        logger.error(f"Error encoding image to Base64: {e}")
                
                # 📄 DOCUMENTOS Y TEXTO
                else:
                    is_plain_text = "text" in file_type or file_name.endswith((".md", ".txt", ".json"))
                    
                    if os.path.exists(rel_path):
                        # Case A: Plain text files (Read directly for efficiency)
                        if is_plain_text:
                            try:
                                with open(rel_path, "r", encoding="utf-8") as f:
                                    content = f.read()
                                if content:
                                    extracted_texts.append({"name": file_name, "content": content})
                            except Exception as e:
                                logger.error(f"Error reading text file {file_name}: {e}")
                        
                        # Case B: Binary Documents (PDF, DOCX, etc.) -> Double Step Extraction
                        else:
                            content = await self._extract_text_with_flowise(rel_path, file_name, file_type, attachment_url, auth_headers)
                            if content:
                                extracted_texts.append({"name": file_name, "content": content})

                    # Always include as URL for Flowise documents in 'uploads' to maintain UI consistency and RAG nodes if present
                    public_url = self.storage_service.get_internal_url(file_url)
                    uploads.append({
                        "data": public_url,
                        "type": "url",
                        "name": file_name,
                        "mime": file_type
                    })

        # Enrich prompt with extracted texts (Doble Paso)
        if extracted_texts:
            enrichment = "\n\n=== ARCHIVOS ADJUNTOS ===\n"
            for item in extracted_texts:
                enrichment += f"[Archivo: {item['name']}]\n{item['content']}\n\n"
            
            final_user_message = f"{enrichment}Pregunta del usuario: {final_user_message}"

        payload = {
            "question": final_user_message,
            "overrideConfig": {
                "sessionId": session_id
            }
        }

        if uploads:
            payload["uploads"] = uploads
        
        if streaming:
            payload["streaming"] = True
            return self._handle_flowise_streaming(url, payload, auth_headers)
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, json=payload, headers=auth_headers, timeout=30.0) # Increased timeout for large uploads
                response.raise_for_status()
                return response.json()
            except Exception as e:
                logger.error(f"Error calling Flowise: {e}")
                return {"error": str(e)}

    async def _handle_flowise_streaming(self, url: str, payload: dict, auth_headers: dict = None):
        """Internal generator for Flowise streaming.
        
        Args:
            url: The endpoint URL.
            payload: The request payload.
            auth_headers: Optional dict of authentication headers.
            
        Yields:
            str: Chunks of text from the stream.
        """
        async with httpx.AsyncClient() as client:
            try:
                async with client.stream("POST", url, json=payload, headers=auth_headers, timeout=30.0) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        if line.startswith("data:"):
                            data_content = line[5:].strip()
                            if data_content == "[DONE]":
                                break
                            try:
                                data_json = json.loads(data_content)
                                # Filter specifically for token events to ensure we only yield strings
                                if data_json.get("event") == "token":
                                    token = data_json.get("data")
                                    if isinstance(token, str):
                                        yield token
                            except json.JSONDecodeError:
                                # Not JSON, skip
                                pass
            except Exception as e:
                logger.error(f"Error in Flowise streaming: {e}")
                yield f"Error: {str(e)}"

    async def _handle_n8n_streaming(self, url: str, payload: list, auth_headers: dict = None):
        """Internal generator for n8n streaming.
        
        Args:
            url: The endpoint URL.
            payload: The request payload.
            auth_headers: Optional dict of authentication headers.
            
        Yields:
            str: Chunks of text from the stream.
        """
        async with httpx.AsyncClient() as client:
            try:
                async with client.stream("POST", url, json=payload, headers=auth_headers, timeout=30.0) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        
                        processed_line = line.strip()
                        if processed_line == "[DONE]": # Check for DONE signal
                            break

                        try: # Inner try block for JSON parsing
                            data_json = json.loads(processed_line) # Try to parse as JSON
                            
                            extracted_content = None
                            
                            if isinstance(data_json, dict):
                                if data_json.get("type") == "item": # Only yield content for "item" type
                                    extracted_content = data_json.get("content")
                                elif data_json.get("type") == "error":
                                    logger.error(f"Error chunk from n8n: {data_json.get('content')}")
                                    yield f"Error: {data_json.get('content', 'Unknown streaming error from n8n')}"
                                    return
                            
                            if extracted_content and len(extracted_content) > 0:
                                yield extracted_content
                            elif extracted_content is None and isinstance(data_json, dict) and data_json.get("type") not in ["begin", "end", "error"]:
                                # If no specific content (not item, not error, not begin/end) but valid JSON, yield raw JSON
                                yield json.dumps(data_json, ensure_ascii=False)
                            else:
                                pass # No yield for begin/end/unhandled
                        except json.JSONDecodeError: # Inner except block for JSON parsing
                            # If not JSON, just yield the raw data content
                            yield processed_line
            except Exception as e: # Outer except block for httpx streaming errors
                logger.error(f"Error in n8n streaming: {e}", exc_info=True)
                yield f"Error: {str(e)}"

DEFAULT_TITLING_PROMPT = """Task: Create a concise title for this chat based on the provided conversation fragment.

Instructions:
- Max 5 words.
- Sentence case (only first letter capitalized).
- No quotes or boilerplate.
- Use the SAME LANGUAGE as the fragment.
- You MAY include one relevant emoji at the start or end.
- Output ONLY the title text.
"""

DEFAULT_MEMORY_PROMPT = """You are a memory consolidation engine. The user is in 'Learning Mode' to teach you facts or instructions about themselves or their preferences.
You will be provided with a list of 'EXISTING FACTS' (each with an [ID]) and the 'NEW MESSAGE'.

Your goal is to extract facts from the NEW MESSAGE while ensuring consistency with EXISTING FACTS.

COMMANDS:
1. FACT:: [description] -> Use this for entirely NEW facts.
2. UPDATE:: [ID] TO:: [New Fact Content] -> Use this if the new message refines or corrects an existing fact.
3. DELETE:: [ID] -> Use this if the user explicitly asks to forget a fact.

CRITICAL RULES:
- REPHRASE everything in the THIRD PERSON (e.g., instead of "I live in Spain", use "The user lives in Spain").
- If a fact is an instruction, phrase it clearly (e.g., "The user prefers concise responses").
- If a new fact is already covered by an existing one, do nothing.
- Output ONLY the commands, one per line. If nothing to change, output nothing.
- ALWAYS use the SAME LANGUAGE as the user message.

Example:
EXISTING: 
- [10] The user's name is Gustavo.
NEW MESSAGE:
"Actually, my name is Alberto and I live in Rome."
OUTPUT:
UPDATE:: 10 TO:: The user's name is Alberto.
FACT:: The user lives in Rome.
"""

from prisma import Prisma

class SettingsService:
    """Service to handle global system settings."""

    def __init__(self, db: Prisma):
        self.db = db

    async def get_settings(self):
        """Retrieves the global settings (ID=1). Creates default if missing."""
        settings = await self.db.systemsettings.find_unique(where={"id": 1})
        if not settings:
            settings = await self.db.systemsettings.create(
                data={
                    "id": 1,
                    "is_titling_enabled": False,
                    "titling_llm_provider": "openai",
                    "memory_extraction_provider": "openai",
                    "titling_prompt": DEFAULT_TITLING_PROMPT,
                    "memory_extraction_prompt": DEFAULT_MEMORY_PROMPT
                }
            )
        else:
            # Migration check: if fields are null or EMPTY in an existing record, update them
            updates = {}
            if not settings.titling_prompt or not settings.titling_prompt.strip():
                updates["titling_prompt"] = DEFAULT_TITLING_PROMPT
            if not settings.memory_extraction_prompt or not settings.memory_extraction_prompt.strip():
                updates["memory_extraction_prompt"] = DEFAULT_MEMORY_PROMPT

            # Sync legacy fields if new ones are empty (initial migration helper)
            if not settings.titling_llm_provider:
                updates["titling_llm_provider"] = settings.llm_provider or "openai"
            if not settings.titling_llm_model:
                updates["titling_llm_model"] = settings.llm_model
            if not settings.memory_extraction_provider:
                updates["memory_extraction_provider"] = settings.llm_provider or "openai"

            if updates:
                settings = await self.db.systemsettings.update(
                    where={"id": 1},
                    data=updates
                )
        return settings
    async def update_settings(self, **kwargs):
        """Updates the global settings. Encrypts API key if provided."""
        if "llm_api_key" in kwargs and kwargs["llm_api_key"]:
            kwargs["llm_api_key"] = security.encrypt_secret(kwargs["llm_api_key"])
        
        # Ensure we are updating record with ID 1
        return await self.db.systemsettings.upsert(
            where={"id": 1},
            data={
                "create": {**kwargs, "id": 1},
                "update": kwargs
            }
        )

    async def reset_titling_prompt(self):
        """Resets the titling prompt to the default system value."""
        return await self.update_settings(titling_prompt=DEFAULT_TITLING_PROMPT)

    async def reset_memory_extraction_prompt(self):
        """Resets the memory extraction prompt to the default system value."""
        return await self.update_settings(memory_extraction_prompt=DEFAULT_MEMORY_PROMPT)

