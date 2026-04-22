# Copyright (c) 2026 Gustavo Alejandro Medde.
# Licensed under the Apache License, Version 2.0.
# See LICENSE.md in the project root for more information.

import httpx
import logging
from typing import Optional
from intelligence_service import IntelligenceService
from prisma import Prisma

logger = logging.getLogger(__name__)

class TitlingService:
    """
    Service to generate conversation titles.
    Refactored to delegate to IntelligenceService while keeping legacy support.
    """

    def __init__(self, prisma: Optional[Prisma] = None):
        self.prisma = prisma
        self.intelligence = IntelligenceService(prisma) if prisma else None

    async def generate_title_centralized(self, user_message: str, agent_response: str, custom_prompt: Optional[str] = None) -> Optional[str]:
        """Generates a title using the new centralized IntelligenceService."""
        if not self.intelligence:
            logger.error("IntelligenceService not initialized in TitlingService")
            return None
        return await self.intelligence.generate_title(user_message, agent_response, custom_prompt=custom_prompt)

    async def generate_title(
        self, 
        provider: str, 
        model: str, 
        api_key: str, 
        prompt: str, 
        message: str
    ) -> Optional[str]:
        """Generates a title by calling the specified LLM provider's API.
        
        The message is automatically truncated to 500 characters for efficiency.
        """
        if not api_key or not provider:
            return None

        # Efficiency: Truncate message to 500 chars
        truncated_message = (message[:500] + '...') if len(message) > 500 else message
        
        # Format the final combined prompt
        full_prompt = f"{prompt}\n\nContent to summarize: {truncated_message}"

        try:
            if provider == "openai":
                return await self._call_openai(model, api_key, full_prompt)
            elif provider in ["google", "gemini"]:
                return await self._call_google(model, api_key, full_prompt)
            elif provider == "mistral":
                return await self._call_mistral(model, api_key, full_prompt)
            else:
                logger.error(f"Unknown LLM provider for titling: {provider}")
                return None
        except Exception as e:
            logger.error(f"Error generating title with {provider}: {e}")
            return None

    async def _call_openai(self, model: str, api_key: str, prompt: str) -> Optional[str]:
        """Calls OpenAI Chat Completion API."""
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": model or "gpt-4o-mini",
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 20,
            "temperature": 0.3
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers, timeout=10.0)
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"].strip().strip('"')

    async def _call_google(self, model: str, api_key: str, prompt: str) -> Optional[str]:
        """Calls Google Gemini API."""
        # Note: Gemini uses API key in URL
        model_name = model or "gemini-1.5-flash"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        headers = {"Content-Type": "application/json"}
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "maxOutputTokens": 20,
                "temperature": 0.3
            }
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers, timeout=10.0)
            response.raise_for_status()
            data = response.json()
            return data["candidates"][0]["content"]["parts"][0]["text"].strip().strip('"')

    async def _call_mistral(self, model: str, api_key: str, prompt: str) -> Optional[str]:
        """Calls Mistral AI API."""
        url = "https://api.mistral.ai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": model or "open-mistral-7b",
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 20,
            "temperature": 0.3
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers, timeout=10.0)
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"].strip().strip('"')

    async def fetch_available_models(self, provider: str, api_key: str) -> list:
        """Queries the provider's API for available chat models.
        Useful for the Admin UI dynamic dropdown.
        """
        if not api_key:
            return []
            
        try:
            if provider == "openai":
                return await self._fetch_openai_models(api_key)
            elif provider == "mistral":
                return await self._fetch_mistral_models(api_key)
            elif provider in ["google", "gemini"]:
                return await self._fetch_google_models(api_key)
            return []
        except Exception as e:
            logger.error(f"Error fetching models for {provider}: {e}")
            return []

    async def _fetch_google_models(self, api_key: str) -> list:
        url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=10.0)
            if response.status_code != 200:
                logger.error(f"Google API Error {response.status_code}: {response.text}")
                return []
            
            data = response.json()
            all_models = data.get("models", [])
            logger.debug(f"Google returned {len(all_models)} total models")
            
            models = []
            for m in all_models:
                methods = m.get("supportedGenerationMethods", [])
                name = m["name"].replace("models/", "")
                
                # Check for content generation support
                if "generateContent" in methods:
                    models.append(name)
            
            logger.debug(f"Filtered {len(models)} Gemini chat models: {models}")
            return sorted(models)

    async def _fetch_openai_models(self, api_key: str) -> list:
        url = "https://api.openai.com/v1/models"
        headers = {"Authorization": f"Bearer {api_key}"}
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, timeout=5.0)
            response.raise_for_status()
            data = response.json()
            # Filter for common chat models
            return sorted([m["id"] for m in data["data"] if "gpt" in m["id"]])

    async def _fetch_mistral_models(self, api_key: str) -> list:
        url = "https://api.mistral.ai/v1/models"
        headers = {"Authorization": f"Bearer {api_key}"}
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, timeout=5.0)
            response.raise_for_status()
            data = response.json()
            return sorted([m["id"] for m in data["data"] if "mistral" in m["id"] or "pixtral" in m["id"]])
