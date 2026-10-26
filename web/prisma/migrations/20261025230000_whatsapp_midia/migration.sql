ALTER TABLE "mensagens_whatsapp" ADD COLUMN IF NOT EXISTS "midiaTipo" TEXT;
ALTER TABLE "mensagens_whatsapp" ADD COLUMN IF NOT EXISTS "midiaMime" TEXT;
ALTER TABLE "mensagens_whatsapp" ADD COLUMN IF NOT EXISTS "midiaNome" TEXT;
ALTER TABLE "mensagens_whatsapp" ADD COLUMN IF NOT EXISTS "midiaTamanho" INTEGER;

CREATE TABLE IF NOT EXISTS "whatsapp_midias" (
  "mensagemId" TEXT PRIMARY KEY REFERENCES "mensagens_whatsapp"("id") ON DELETE CASCADE,
  "conteudo" BYTEA NOT NULL
);

-- Conteúdo privado servido somente pela rota autenticada do aplicativo.
ALTER TABLE "whatsapp_midias" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "whatsapp_midias" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "whatsapp_midias" FROM authenticated;
  END IF;
END $$;
