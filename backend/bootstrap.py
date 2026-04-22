# Copyright (c) 2026 Gustavo Alejandro Medde.
# Licensed under the Apache License, Version 2.0.
# See LICENSE.md in the project root for more information.

import os
import logging
import re
from prisma import Prisma
import security

logger = logging.getLogger(__name__)

async def bootstrap_users(db: Prisma = None):
    """
    Scans environment variables for bootstrap users.
    Format:
    USER_n_EMAIL=...
    USER_n_PASSWORD=...
    USER_n_ROLE=...
    USER_n_FIRST_NAME=...
    USER_n_LAST_NAME=...
    """
    # 1. Collect all users by index
    # We look for USER_{n}_EMAIL as the anchor
    users_to_sync = {}
    
    email_pattern = re.compile(r"^USER_(\d+)_EMAIL$")
    
    for key, value in os.environ.items():
        match = email_pattern.match(key)
        if match:
            index = match.group(1)
            users_to_sync[index] = {
                "email": value,
                "password": os.getenv(f"USER_{index}_PASSWORD"),
                "role": os.getenv(f"USER_{index}_ROLE", "USER"),
                "first_name": os.getenv(f"USER_{index}_FIRST_NAME"),
                "last_name": os.getenv(f"USER_{index}_LAST_NAME")
            }

    if not users_to_sync:
        logger.info("No bootstrap users found in environment variables (USER_n_EMAIL).")
        return

    try:
        # Connect if no db provided
        should_disconnect = False
        if db is None:
            from database import prisma
            db = prisma
            if not db.is_connected():
                await db.connect()
                should_disconnect = True

        for index, user_data in users_to_sync.items():
            email = user_data["email"]
            password = user_data["password"]
            role = user_data["role"]
            first_name = user_data["first_name"]
            last_name = user_data["last_name"]

            if not email or not password:
                logger.warning(f"Skipping incomplete bootstrap user at index {index}: email or password missing.")
                continue

            hashed_password = security.get_password_hash(password)
            
            logger.info(f"Syncing bootstrap user {index}: {email} (Role: {role})")
            
            await db.user.upsert(
                where={"email": email},
                data={
                    "create": {
                        "email": email,
                        "hashed_password": hashed_password,
                        "role": role,
                        "first_name": first_name,
                        "last_name": last_name
                    },
                    "update": {
                        "hashed_password": hashed_password,
                        "role": role,
                        "first_name": first_name,
                        "last_name": last_name
                    }
                }
            )
        
        logger.info(f"User bootstrap completed. Synced {len(users_to_sync)} users.")
        
        if should_disconnect:
            await db.disconnect()

    except Exception as e:
        logger.error(f"Error during user bootstrap: {e}", exc_info=True)

if __name__ == "__main__":
    import asyncio
    logging.basicConfig(level=logging.INFO)
    asyncio.run(bootstrap_users())
