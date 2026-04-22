# Copyright (c) 2026 Gustavo Alejandro Medde.
# Licensed under the Apache License, Version 2.0.
# See LICENSE.md in the project root for more information.

import os
import bcrypt
from cryptography.fernet import Fernet

# Load key from environment
# If not set, it will raise an error when trying to encrypt/decrypt
ENCRYPTION_KEY = os.getenv("AGENT_AUTH_ENCRYPTION_KEY")

def encrypt_secret(plain_text: str) -> str:
    """Encrypts a plain text string using Fernet (AES)."""
    if not plain_text:
        return None
    if not ENCRYPTION_KEY:
        raise ValueError("AGENT_AUTH_ENCRYPTION_KEY not set in environment")
    
    f = Fernet(ENCRYPTION_KEY.encode())
    encrypted_data = f.encrypt(plain_text.encode())
    return encrypted_data.decode()

def decrypt_secret(encrypted_text: str) -> str:
    """Decrypts a Fernet-encrypted string."""
    if not encrypted_text:
        return None
    if not ENCRYPTION_KEY:
        raise ValueError("AGENT_AUTH_ENCRYPTION_KEY not set in environment")
    
    f = Fernet(ENCRYPTION_KEY.encode())
    decrypted_data = f.decrypt(encrypted_text.encode())
    return decrypted_data.decode()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain-text password against a bcrypt hash."""
    if not hashed_password or not plain_password:
        return False
    try:
        # bcrypt.checkpw expects bytes
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    """Generates a bcrypt hash from a plain-text password."""
    # salt = bcrypt.gensalt() returns bytes
    # hashpw returns bytes
    hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    return hashed.decode('utf-8')
