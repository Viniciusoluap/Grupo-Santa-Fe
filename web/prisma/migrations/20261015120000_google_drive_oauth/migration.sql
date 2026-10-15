-- Google Drive com a conta Google do dono (OAuth, escopo drive.file). Paridade com a
-- Prospecta (drizzle/0052). Uma única linha; segredos sempre criptografados (AES-GCM).
CREATE TABLE IF NOT EXISTS "google_drive_oauth" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "client_id" TEXT NOT NULL,
  "client_secret_encrypted" TEXT NOT NULL,
  "refresh_token_encrypted" TEXT,
  "account_email" VARCHAR(320),
  "root_folder_id" TEXT,
  "connected_at" TIMESTAMP(3),
  "updated_by_usuario_id" TEXT,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "google_drive_oauth_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "google_drive_oauth_linha_unica" CHECK ("id" = 1)
);

-- Bloqueia a API pública do Supabase (PostgREST), como nas demais tabelas; o Prisma acessa como dono.
ALTER TABLE "google_drive_oauth" ENABLE ROW LEVEL SECURITY;
