-- CreateTable
CREATE TABLE "system_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "is_titling_enabled" BOOLEAN NOT NULL DEFAULT false,
    "llm_provider" VARCHAR(50) NOT NULL DEFAULT 'openai',
    "llm_model" VARCHAR(100),
    "llm_api_key" TEXT,
    "titling_prompt" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);
