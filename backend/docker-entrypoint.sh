#!/bin/sh
# docker-entrypoint.sh simplified

# If the first argument is a command we want to run directly without waiting for DB (like ls, sh, bash)
# we can skip the wait. However, for simplicity and robustness:
if [ "$1" = "uvicorn" ] || [ "$1" = "python" ]; then
    # Wait for PostgreSQL to be ready
    echo "Waiting for PostgreSQL at ${DB_HOST:-postgres}..."
    while ! pg_isready -h ${DB_HOST:-postgres} -p 5432 -U postgres > /dev/null 2>&1; do
      sleep 1
    done
    echo "PostgreSQL is ready!"

    # Execute Prisma migrations if they exist
    echo "Applying database migrations..."
    prisma migrate deploy --schema /app/prisma/schema.prisma
    if [ $? -ne 0 ]; then
      echo "Prisma migration failed!"
      exit 1
    fi
    echo "Migrations applied successfully!"
fi

# Execute the main command from the Dockerfile
exec "$@"
