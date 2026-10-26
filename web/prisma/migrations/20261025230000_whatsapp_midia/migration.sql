ALTER TABLE "mensagens_whatsapp" ADD COLUMN IF NOT EXISTS "midiaTipo" TEXT;
ALTER TABLE "mensagens_whatsapp" ADD COLUMN IF NOT EXISTS "midiaMime" TEXT;
ALTER TABLE "mensagens_whatsapp" ADD COLUMN IF NOT EXISTS "midiaNome" TEXT;
ALTER TABLE "mensagens_whatsapp" ADD COLUMN IF NOT EXISTS "midiaTamanho" INTEGER;

CREATE TABLE IF NOT EXISTS "whatsapp_midias" (
  "mensagemId" TEXT PRIMARY KEY REFERENCES "mensagens_whatsapp"("id") ON DELETE CASCADE,
  "conteudo" BYTEA NOT NULL
);
