# Copyright (c) 2026 Gustavo Alejandro Medde.
# Licensed under the Apache License, Version 2.0.
# See LICENSE.md in the project root for more information.

import httpx
import logging
import json
from typing import Optional, List, Dict, Any
from prisma import Prisma
import security

logger = logging.getLogger(__name__)

class IntelligenceService:
    """
    Centralized service for AI-powered operations (titling, memory extraction, etc.).
    Uses credentials stored in the database.
    """

    def __init__(self, prisma: Prisma):
        self.prisma = prisma

    async def get_active_credential(self, task: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves the specified active credential from settings or falls back to first active.
        """
        try:
            from services import SettingsService
            settings_service = SettingsService(self.prisma)
            settings = await settings_service.get_settings()

            selected_cred = None
            
            # Map task to specific setting field
            cred_id = None
            if task == "titling":
                cred_id = settings.active_titling_cred_id
            elif task in ["extraction", "atomization"]:
                cred_id = settings.active_extraction_cred_id
            
            if cred_id:
                selected_cred = await self.prisma.aicredentials.find_unique(where={"id": cred_id})
                if not (selected_cred and selected_cred.is_active):
                    selected_cred = None

            if not selected_cred:
                # Fallback to previous logic: fetch all and find first that matches task
                creds = await self.prisma.aicredentials.find_many(
                    where={"is_active": True}
                )

                if not creds:
                    logger.warning(f"No active AI credentials found in database.")
                    return None

                for c in creds:
                    try:
                        tasks = json.loads(c.tasks) if isinstance(c.tasks, str) else c.tasks
                        if task in tasks:
                            selected_cred = c
                            break
                    except: continue

                # Last fallback: get the first active credential
                if not selected_cred:
                    selected_cred = creds[0]

            # 3. Build Result
            decrypted_key = security.decrypt_secret(selected_cred.api_key)
            provider = selected_cred.provider # Enum from Prisma (OPENAI, GEMINI, MISTRAL)
            
            # --- Correct Logic: Model Selection per Task ---
            # We ONLY use the settings model IF the settings provider matches the credential provider.
            # This prevents hybrids like (MISTRAL + gpt-4o).
            
            model = None
            settings_model = None
            settings_provider_str = None
            
            if task == "titling":
                settings_model = settings.titling_llm_model
                settings_provider_str = settings.titling_llm_provider # e.g. "openai"
            elif task in ["extraction", "atomization"]:
                settings_model = settings.memory_extraction_model
                settings_provider_str = settings.memory_extraction_provider
            
            # Normalize for comparison
            if settings_model and settings_provider_str and settings_provider_str.upper() == str(provider).upper():
                model = settings_model
            
            # If no match or model empty, use the legacy fields (last resort fallback) or None
            # The individual provider methods (_call_openai, etc) handle None by using a safe default.
            if not model and settings.llm_model and settings.llm_provider and settings.llm_provider.upper() == str(provider).upper():
                model = settings.llm_model

            return {
                "provider": provider,
                "api_key": decrypted_key,
                "model": model
            }
        except Exception as e:
            logger.error(f"Error retrieving active credential for {task}: {e}")
            return None

    async def generate_title(self, user_message: str, agent_response: str, custom_prompt: Optional[str] = None) -> Optional[str]:
        """Generates a title using centralized credentials."""
        cred = await self.get_active_credential("titling")
        if not cred:
            return None

        # Logic for prompt construction (Parity with previous implementation)
        combined_text = f"User: {user_message}\nAgent: {agent_response}"
        truncated = (combined_text[:500] + '...') if len(combined_text) > 500 else combined_text

        if custom_prompt:
            # If custom prompt has placeholder {message}, use it, otherwise append content
            if "{message}" in custom_prompt:
                full_prompt = custom_prompt.replace("{message}", truncated)
            else:
                full_prompt = f"{custom_prompt}\n\nContent to summarize: {truncated}"
        else:
            # Default internal prompt
            default_instr = "Create a very short, concise title (max 5 words) for this conversation based on the content. No quotes."
            full_prompt = f"{default_instr}\n\nContent:\n{truncated}"

        try:
            result = await self._call_llm(cred, full_prompt, model=cred.get("model"), max_tokens=20)
            
            if result:
                # Rigorous stripping of quotes
                return result.strip().strip('"').strip("'").strip('`')
        except Exception as e:
            logger.error(f"Error generating title in IntelligenceService: {e}")
            
        return None

    async def filter_relevance(self, user_message: str, memories: List[Any], top_n: int = 10) -> List[Any]:
        """
        Uses an LLM to select the most relevant memories for the current user message.
        Returns a filtered list of AgentMemory objects.
        """
        if not memories:
            return []
        
        # If very few memories, skip LLM filtering and just return them all
        if len(memories) <= 5:
            return memories

        cred = await self.get_active_credential("filtering")
        if not cred:
            # Fallback to returning top-N by recency if LLM fails
            return memories[:top_n]

        # Prepare a numbered list of facts for the LLM
        facts_list = "\n".join([f"[{i}] {m.fact}" for i, m in enumerate(memories)])
        
        prompt = f"""You are a relevance filter. Given a list of 'MEMORIES' and a 'USER MESSAGE', your task is to identify the IDs of the most relevant memories that would help an AI agent provide a better response.

USER MESSAGE: "{user_message}"

MEMORIES:
{facts_list}

INSTRUCTIONS:
- Select up to {top_n} most relevant memory IDs.
- Relevance means the memory contains information directly related to the user's query or provides necessary context.
- Output ONLY a comma-separated list of IDs (e.g., 0, 3, 7).
- If no memories are relevant, output an empty string.
"""

        try:
            response = await self._call_llm(cred, prompt, max_tokens=50)
            if not response or not response.strip():
                return []

            # Parse IDs from comma-separated response
            import re
            ids = [int(i.strip()) for i in re.split(r'[,\s]+', response) if i.strip().isdigit()]
            
            # Reconstruct filtered list based on selected indices
            filtered = []
            for i in ids:
                if 0 <= i < len(memories):
                    filtered.append(memories[i])
            
            return filtered[:top_n]
        except Exception as e:
            logger.error(f"Error filtering relevance in IntelligenceService: {e}")
            return memories[:top_n]

    async def atomize_content(self, content: str, provider: str, api_key: str, model: Optional[str] = None) -> List[str]:
        """
        Takes a long text and breaks it down into atomic facts/instructions for memory storage.
        """
        cred = {"provider": provider, "api_key": api_key}
        
        # We split long content into chunks to avoid context window issues
        # Using a larger window for chunking to keep context
        import re
        # Split by sections (numbers followed by dot or double newlines)
        chunks = re.split(r'\n\s*\n', content)
        chunks = [c.strip() for c in chunks if c.strip()]
        
        all_facts = []
        for chunk in chunks:
            if len(chunk) < 10: continue
            
            prompt = f"""You are a knowledge atomization engine. Your task is to extract clear and self-contained atomic facts or instructions from the provided TEXT.

TEXT:
\"\"\"
{chunk}
\"\"\"

CRITICAL INSTRUCTIONS:
- Each fact must contain ALL necessary context to be understood independently.
- GROUP RELATED POINTS: If the text describes a multi-step process, a list of sub-rules, or a set of related constraints (e.g., "Rule 1: A, B and C"), you MUST group them into a single coherent FACT instead of breaking them into tiny fragments.
- DO NOT simply copy-paste lines. Synthesize them into a complete instruction.
- Maintain the original language of the text.
- Output format: FACT:: [The complete consolidated fact or rule]
- Output ONLY the FACT:: lines, one per entry.
"""
            try:
                response = await self._call_llm(cred, prompt, model=model, max_tokens=500)
                if response:
                    import re
                    for line in response.split("\n"):
                        line = line.strip()
                        if not line: continue
                        
                        # 1. Look for explicit FACT:: prefix (robust regex)
                        fact_match = re.search(r"FACT::\s*(.+)", line, re.IGNORECASE)
                        if fact_match:
                            all_facts.append(fact_match.group(1).strip())
                            continue
                            
                        # 2. Legacy support (single colon)
                        fact_legacy = re.search(r"FACT:\s*(.+)", line, re.IGNORECASE)
                        if fact_legacy:
                            all_facts.append(fact_legacy.group(1).strip())
                            continue
                        
                        # 3. Fallback: If no prefix but line looks like a sentence and doesn't look like chat/pithy response
                        # (This helps when LLMs ignore 'Output ONLY FACT:: lines')
                        if len(line) > 10 and not any(line.upper().startswith(x) for x in ["SURE", "HERE ARE", "I HAVE", "OK"]):
                            # Clean up common markdown bullets if present at start
                            clean_line = re.sub(r"^[\-\*\d\.\s]+", "", line).strip()
                            if clean_line:
                                all_facts.append(clean_line)
            except Exception as e:
                logger.error(f"Error atomizing chunk: {e}")
                
        return all_facts

    async def extract_facts(self, message_content: str, agent_id: int, user_id: int, context: str = "") -> List[Dict[str, Any]]:
        """
        Extracts and consolidates atomic facts from message content.
        Returns a list of command dicts: {"type": "fact|update|delete", "content": ..., "old_content": ...}
        """
        # 1. Get Settings
        from services import SettingsService
        settings_service = SettingsService(self.prisma)
        settings = await settings_service.get_settings()

        # 2. Get Existing Facts for context
        from memory_service import MemoryService
        memory_service = MemoryService(self.prisma)
        memories = await memory_service.get_relevant_facts(agent_id, user_id)
        
        facts_context = "EXISTING FACTS:\n" + "\n".join([f"- [{m.id}] {m.fact}" for m in memories[:30]]) if memories else "EXISTING FACTS: None."

        # 3. Get Credential
        cred = await self.get_active_credential("extraction")
        if not cred: return []

        prompt = settings.memory_extraction_prompt or "You are a memory consolidation engine..."
        
        full_input = f"{facts_context}\n\nNEW MESSAGE:\n{message_content}"
        
        # If custom prompt has placeholder {message}, use it
        if "{message}" in prompt:
            full_prompt = prompt.replace("{message}", full_input)
        else:
            full_prompt = f"{prompt}\n\n{full_input}"

        try:
            response_text = await self._call_llm(cred, full_prompt, model=cred.get("model"), max_tokens=1000)
            if not response_text: 
                logger.warning(f"Empty response from {cred.get('provider')} in extract_facts")
                return []

            import re
            commands = []
            for line in response_text.split("\n"):
                line = line.strip()
                if not line: continue
                
                # Robust parsing using regex to find commands even if they have prefixes (like bullets)
                # FACT:: [content]
                fact_match = re.search(r"FACT::\s*(.+)", line, re.IGNORECASE)
                if fact_match:
                    commands.append({"type": "fact", "content": fact_match.group(1).strip()})
                    continue

                # UPDATE:: [ID] TO:: [New]
                update_match = re.search(r"UPDATE::\s*\[?(\d+)\]?\s*TO::\s*(.+)", line, re.IGNORECASE)
                if update_match:
                    commands.append({
                        "type": "update", 
                        "fact_id": int(update_match.group(1)), 
                        "content": update_match.group(2).strip()
                    })
                    continue
                
                # Fallback UPDATE format (without TO::)
                update_fallback = re.search(r"UPDATE::\s*\[?(\d+)\]?\s*TO\s+(.+)", line, re.IGNORECASE)
                if update_fallback:
                    commands.append({
                        "type": "update", 
                        "fact_id": int(update_fallback.group(1)), 
                        "content": update_fallback.group(2).strip()
                    })
                    continue

                # DELETE:: [ID]
                delete_match = re.search(r"DELETE::\s*\[?(\d+)\]?", line, re.IGNORECASE)
                if delete_match:
                    commands.append({"type": "delete", "fact_id": int(delete_match.group(1))})
                    continue
                
                # Legacy support (single colon)
                fact_legacy = re.search(r"FACT:\s*(.+)", line, re.IGNORECASE)
                if fact_legacy:
                    commands.append({"type": "fact", "content": fact_legacy.group(1).strip()})
                    continue
                
                update_legacy = re.search(r"UPDATE:\s*\[?(\d+)\]?\s*TO\s+(.+)", line, re.IGNORECASE)
                if update_legacy:
                    commands.append({
                        "type": "update", 
                        "fact_id": int(update_legacy.group(1)), 
                        "content": update_legacy.group(2).strip()
                    })
                    continue
            
            return commands
        except Exception as e:
            logger.error(f"Error in extract_facts: {e}")
            return []

    async def _call_llm(self, cred: Dict[str, Any], prompt: str, model: Optional[str] = None, **kwargs) -> Optional[str]:
        """Generic LLM call wrapper."""
        provider = cred["provider"].lower()
        api_key = cred["api_key"]
        
        if provider == "openai":
            return await self._call_openai(model, api_key, prompt, **kwargs)
        elif provider in ["google", "gemini"]:
            return await self._call_google(model, api_key, prompt, **kwargs)
        elif provider == "mistral":
            return await self._call_mistral(model, api_key, prompt, **kwargs)
        return None

    async def _call_openai(self, model: str, api_key: str, prompt: str, max_tokens: int = 100) -> Optional[str]:
        url = "https://api.openai.com/v1/chat/completions"
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        payload = {
            "model": model or "gpt-4o-mini",
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
            "temperature": 0.1
        }
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers, timeout=30.0)
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"].strip()

    async def _call_google(self, model: str, api_key: str, prompt: str, max_tokens: int = 100) -> Optional[str]:
        model_name = model or "gemini-1.5-flash"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        headers = {"Content-Type": "application/json"}
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"maxOutputTokens": max_tokens, "temperature": 0.1}
        }
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers, timeout=30.0)
            response.raise_for_status()
            data = response.json()
            return data["candidates"][0]["content"]["parts"][0]["text"].strip()

    async def _call_mistral(self, model: str, api_key: str, prompt: str, max_tokens: int = 100) -> Optional[str]:
        url = "https://api.mistral.ai/v1/chat/completions"
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        payload = {
            "model": model or "mistral-small-latest",
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
            "temperature": 0.1
        }
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers, timeout=30.0)
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"].strip()
