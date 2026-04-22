# Copyright (c) 2026 Gustavo Alejandro Medde.
# Licensed under the Apache License, Version 2.0.
# See LICENSE.md in the project root for more information.

import asyncio
import httpx
import time

async def call_health():
    async with httpx.AsyncClient() as client:
        try:
            # Internal port for FastAPI
            resp = await client.get("http://localhost:8000/health", timeout=10)
            return resp.status_code
        except Exception as e:
            return str(e)

async def stress_test():
    print("Starting PgBouncer Stress Test (Concurrent Requests to FastAPI)...")
    start_time = time.time()
    
    tasks = [call_health() for _ in range(50)]
    results = await asyncio.gather(*tasks)
    
    end_time = time.time()
    success_count = sum(1 for r in results if r == 200)
    
    print(f"Completed 50 requests in {end_time - start_time:.2f} seconds.")
    print(f"Success: {success_count}/50")
    
    if success_count == 50:
        print("✅ Stress test passed! PgBouncer handled concurrent traffic correctly.")
    else:
        # Debug why it failed
        print(f"Sample error: {results[0] if results else 'None'}")
        print("❌ Stress test failed.")

if __name__ == "__main__":
    asyncio.run(stress_test())
