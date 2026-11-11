-- 11/11/2026 (paridade com a Prospecta): anexos de qualquer tipo até 50 MB, enviados em partes de 2 MiB.
-- Só cria a área temporária das partes; nada existente é alterado ou apagado.
CREATE TABLE IF NOT EXISTS "estudo_documento_partes" (
  "uploadId" VARCHAR(64) NOT NULL,
  "parte" INTEGER NOT NULL,
  "estudoId" TEXT NOT NULL,
  "itemId" VARCHAR(80) NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "dados" BYTEA NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "estudo_documento_partes_pkey" PRIMARY KEY ("uploadId", "parte")
);
CREATE INDEX IF NOT EXISTS "estudo_documento_partes_criadoEm_idx" ON "estudo_documento_partes"("criadoEm");
