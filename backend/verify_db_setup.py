# Copyright (c) 2026 Gustavo Alejandro Medde.
# Licensed under the Apache License, Version 2.0.
# See LICENSE.md in the project root for more information.

import asyncio
import os
import sys
from prisma import Prisma

async def verify_db_setup():
    print("Starting Database Infrastructure Verification...")
    
    # We use the default DATABASE_URL to connect initially, 
    # but we want to check for other databases.
    # Prisma doesn't easily allow switching databases on the fly without changing the URL.
    # So we will try to connect to each database directly.
    
    base_url = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@postgres:5432/uuilly_db")
    # Replace the database name in the URL
    def get_url(db_name):
        # Assumes URL format: postgresql://user:pass@host:port/dbname
        parts = base_url.rsplit('/', 1)
        return f"{parts[0]}/{db_name}"

    dbs_to_check = ["uuilly_db", "n8n_db", "flowise_db"]
    success = True

    for db_name in dbs_to_check:
        url = get_url(db_name)
        print(f"Checking connection to {db_name}...")
        db = Prisma(datasource={'url': url})
        try:
            await db.connect()
            print(f"✅ Successfully connected to {db_name}")
            
            # Check for pgvector extension in n8n and flowise
            if db_name in ["n8n_db", "flowise_db"]:
                print(f"Checking for pgvector extension in {db_name}...")
                result = await db.query_raw("SELECT extname FROM pg_extension WHERE extname = 'vector';")
                if result:
                    print(f"✅ pgvector extension is enabled in {db_name}")
                else:
                    print(f"❌ pgvector extension is MISSING in {db_name}")
                    success = False
            
            await db.disconnect()
        except Exception as e:
            print(f"❌ Failed to connect to {db_name}: {e}")
            success = False

    if success:
        print("\nAll infrastructure checks passed!")
        sys.exit(0)
    else:
        print("\nSome infrastructure checks failed.")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(verify_db_setup())
