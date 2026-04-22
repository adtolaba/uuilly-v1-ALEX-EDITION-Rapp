-- Create additional databases
SELECT 'CREATE DATABASE uuilly_db' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'uuilly_db')\gexec
SELECT 'CREATE DATABASE n8n_db' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'n8n_db')\gexec
SELECT 'CREATE DATABASE flowise_db' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'flowise_db')\gexec

-- Enable pgvector ONLY on n8n and flowise
\c n8n_db
CREATE EXTENSION IF NOT EXISTS vector;

\c flowise_db
CREATE EXTENSION IF NOT EXISTS vector;
