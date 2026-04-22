# Copyright (c) 2026 Gustavo Alejandro Medde.
# Licensed under the Apache License, Version 2.0.
# See LICENSE.md in the project root for more information.

"""Database reset utility using Prisma."""
import subprocess
import os

def reset_database():
    """Resets the database using Prisma CLI."""
    print("Resetting database using Prisma...")
    try:
        # Run prisma db push --force-reset
        subprocess.run(["prisma", "db", "push", "--force-reset", "--accept-data-loss"], check=True)
        print("Database reset complete.")
    except subprocess.CalledProcessError as e:
        print(f"Error resetting database: {e}")

if __name__ == "__main__":
    reset_database()
