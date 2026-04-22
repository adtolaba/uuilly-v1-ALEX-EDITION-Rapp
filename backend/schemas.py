# Copyright (c) 2026 Gustavo Alejandro Medde.
# Licensed under the Apache License, Version 2.0.
# See LICENSE.md in the project root for more information.

from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from enum import Enum

class TagBase(BaseModel):
    name: str

class TagCreate(TagBase):
    pass

class Tag(TagBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class AgentBase(BaseModel):
    name: str
    description: Optional[str] = None
    type: str
    url: str
    config: Optional[Union[Dict[str, Any], str]] = {}
    is_active: bool = True
    is_streaming_enabled: bool = False
    icon: Optional[str] = None
    agent_auth_strategy: str = "NONE"
    agent_auth_header_name: Optional[str] = None
    agent_auth_secret: Optional[str] = None
    memory_enabled: bool = False
    memory_scope: str = "INDIVIDUAL"

class AgentCreate(AgentBase):
    tags: List[str] = []
    icon: Optional[str] = None

class Agent(AgentBase):
    id: int
    description: Optional[str] = None
    tags: List[str] = []
    agent_auth_secret: Optional[str] = Field(None, exclude=False) # Will be masked in actual responses if needed
    model_config = ConfigDict(from_attributes=True)

class UserRole(str, Enum):
    USER = "USER"
    SUPERVISOR = "SUPERVISOR"
    ADMIN = "ADMIN"

class UserBase(BaseModel):
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    profile_photo_url: Optional[str] = None
    role: UserRole = UserRole.USER

class UserCreate(UserBase):
    password: Optional[str] = None
    tags: List[str] = []

class UserUpdate(BaseModel):
    email: Optional[str] = None
    password: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    profile_photo_url: Optional[str] = None
    role: Optional[UserRole] = None
    tags: Optional[List[str]] = None

class User(UserBase):
    id: int
    tags: Optional[List[Any]] = None
    model_config = ConfigDict(from_attributes=True)

class FileAttachment(BaseModel):
    name: str
    type: str
    url: str

class MessageBase(BaseModel):
    text: str
    sender: str # 'user' or 'bot'
    files: Optional[List[FileAttachment]] = None

class MessageCreate(MessageBase):
    conversation_id: int

class MessageUpdate(MessageBase):
    text: str

class Message(MessageBase):
    id: int
    conversation_id: int
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True)

class ConversationBase(BaseModel):
    title: str

class ConversationCreate(ConversationBase):
    user_id: int
    agent_id: int

class Conversation(ConversationBase):
    id: int
    user_id: int
    agent_id: int
    created_at: datetime
    updated_at: datetime
    messages: Optional[List[Message]] = Field(default_factory=list)
    agent: Optional[Agent] = None
    model_config = ConfigDict(from_attributes=True)


class DevLoginRequest(BaseModel):
    email: str
    password: str

class PasswordLoginRequest(DevLoginRequest):
    pass

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

# --- AI Credentials Schemas ---

class AIProvider(str, Enum):
    OPENAI = "OPENAI"
    GEMINI = "GEMINI"
    MISTRAL = "MISTRAL"

class AICredentialsBase(BaseModel):
    name: str
    provider: AIProvider
    is_active: bool = True
    tasks: List[str] = []

class AICredentialsCreate(AICredentialsBase):
    api_key: str

class AICredentialsUpdate(BaseModel):
    name: Optional[str] = None
    provider: Optional[AIProvider] = None
    api_key: Optional[str] = None
    is_active: Optional[bool] = None
    tasks: Optional[List[str]] = None

class AICredentials(AICredentialsBase):
    id: int
    created_at: datetime
    updated_at: datetime
    # We don't include api_key in the public schema for listing
    model_config = ConfigDict(from_attributes=True)

# --- System Settings Schemas ---
class SystemSettingsBase(BaseModel):
    is_titling_enabled: bool = False
    llm_provider: str = "openai"
    llm_model: Optional[str] = None
    llm_api_key: Optional[str] = None
    titling_prompt: Optional[str] = None
    active_cred_id: Optional[int] = None
    memory_extraction_model: Optional[str] = None
    memory_extraction_prompt: Optional[str] = None
    active_extraction_cred_id: Optional[int] = None

class SystemSettingsUpdate(BaseModel):
    is_titling_enabled: Optional[bool] = None
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None
    llm_api_key: Optional[str] = None
    titling_prompt: Optional[str] = None
    active_cred_id: Optional[int] = None
    memory_extraction_model: Optional[str] = None
    memory_extraction_prompt: Optional[str] = None
    active_extraction_cred_id: Optional[int] = None

class SystemSettings(SystemSettingsBase):
    id: int
    active_cred_id: Optional[int] = None
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

# --- Backup, Restore & Reset Schemas ---

class AgentMemoryBase(BaseModel):
    fact: str
    agent_id: Optional[int] = None # Will be linked by name/alias during import
    user_id: Optional[int] = None # Will be linked by email during import

class AgentMemoryExport(AgentMemoryBase):
    agent_name: str
    user_email: Optional[str] = None

class BackupMetadata(BaseModel):
    version: str = "1.0"
    timestamp: datetime = Field(default_factory=datetime.now)
    created_by: str
    description: Optional[str] = None

class BackupData(BaseModel):
    agents: List[Dict[str, Any]] = []
    ai_credentials: List[Dict[str, Any]] = []
    users: List[Dict[str, Any]] = []
    tags: List[Dict[str, Any]] = []
    system_settings: Optional[Dict[str, Any]] = None
    memories: List[Dict[str, Any]] = []

class BackupFile(BaseModel):
    metadata: BackupMetadata
    data: BackupData

class BackupLogBase(BaseModel):
    action_type: str # "EXPORT", "IMPORT", "RESET"
    entities_affected: Dict[str, Any]
    strategy_used: Optional[str] = None # "OVERWRITE", "SKIP"
    status: str # "SUCCESS", "FAILURE"
    details: Optional[str] = None

class BackupLog(BackupLogBase):
    id: int
    timestamp: datetime
    user_id: int
    user: Optional[User] = None
    model_config = ConfigDict(from_attributes=True)

class BackupExportRequest(BaseModel):
    categories: List[str] # ["agents", "credentials", "users", "memory"]
    description: Optional[str] = None

class BackupImportRequest(BaseModel):
    categories: List[str]
    overwrite: bool = False
    # The file is handled via UploadFile in FastAPI
