-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "agent_auth_header_name" VARCHAR(100),
ADD COLUMN     "agent_auth_secret" TEXT,
ADD COLUMN     "agent_auth_strategy" VARCHAR(50) NOT NULL DEFAULT 'NONE';
