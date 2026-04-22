# Copyright (c) 2026 Gustavo Alejandro Medde.
# Licensed under the Apache License, Version 2.0.
# See LICENSE.md in the project root for more information.

from datetime import datetime, timedelta, timezone
from typing import Optional

import logging
logger = logging.getLogger(__name__)

import schemas 
import os

from jose import JWTError, jwt
from fastapi import HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer
from pydantic import ValidationError # Import ValidationError

from database import prisma, get_db # Import prisma and get_db
import security

# Configuration for JWT
# Rely on Docker/Environment to provide JWT_SECRET_KEY
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "super-secret-jwt-key").strip()
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/login/password") # Use the password login endpoint

def verify_password(plain_password, hashed_password):
    return security.verify_password(plain_password, hashed_password)

def get_password_hash(password):
    return security.get_password_hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY.encode('utf-8'), algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db=Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    return await get_current_user_from_token(token, db) # Delegate to the new function

async def get_current_user_from_token(token: str, db=None) -> schemas.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY.encode('utf-8'), algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        user_id: int = payload.get("user_id")
        user_role: str = payload.get("role")
        if email is None or user_id is None or user_role is None:
            logger.warning(f"Invalid payload in token: email={email}, user_id={user_id}, user_role={user_role}")
            raise credentials_exception
        
        # Use the provided 'db' if available, fallback to global 'prisma'
        db_instance = db if db is not None else prisma
        db_user = await db_instance.user.find_unique(where={"id": user_id}, include={"tags": True})
        if not db_user:
            logger.warning(f"User with ID {user_id} not found in DB from token.")
            raise credentials_exception
        
        try:
            # Pydantic's from_attributes=True (in schemas.User) handles the conversion from Prisma object automatically
            return schemas.User.model_validate(db_user)
        except ValidationError as e:
            # If validation fails, we return the raw object instead of 422ing
            # This allows the app to work while keeping the data
            logger.error(f"Pydantic validation error for user {user_id}: {e.json()}")
            return db_user
            
    except JWTError as e:
        logger.error(f"JWT decoding error: {e}")
        raise credentials_exception

async def get_current_admin_user(current_user: schemas.User = Depends(get_current_user)):
    if current_user.role != schemas.UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
    return current_user

async def get_current_active_supervisor_or_admin(current_user: schemas.User = Depends(get_current_user)):
    if current_user.role not in [schemas.UserRole.ADMIN, schemas.UserRole.SUPERVISOR]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
    return current_user
