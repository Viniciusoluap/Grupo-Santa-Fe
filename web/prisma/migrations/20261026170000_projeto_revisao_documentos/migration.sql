-- Correção 16: revisão prioritária e documentos de projeto normalizados/versionados.
ALTER TABLE "projeto_revisoes"
  ADD COLUMN IF NOT EXISTS "statusAnteriorProjeto" TEXT;

CREATE TABLE IF NOT EXISTS "projeto_documentos" (
  "id" TEXT NOT NULL,
  "projetoId" TEXT NOT NULL,
  "revisaoId" TEXT,
  "itemId" TEXT NOT NULL,
  "tipo" TEXT NOT NULL CHECK ("tipo" IN ('pdf', 'editable')),
  "nomeOriginal" TEXT NOT NULL,
  "nomeCanonico" TEXT NOT NULL,
  "mime" TEXT NOT NULL,
  "tamanho" INTEGER NOT NULL CHECK ("tamanho" > 0),
  "versao" INTEGER NOT NULL CHECK ("versao" > 0),
  "driveFileId" TEXT,
  "url" TEXT,
  "status" TEXT NOT NULL DEFAULT 'uploading' CHECK ("status" IN ('uploading', 'active', 'substituted', 'deleted', 'failed')),
  "substituidoPorId" TEXT,
  "enviadoPorId" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  "excluidoEm" TIMESTAMP(3),
  CONSTRAINT "projeto_documentos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "projeto_documentos_projetoId_itemId_tipo_versao_key"
  ON "projeto_documentos" ("projetoId", "itemId", "tipo", "versao");
CREATE INDEX IF NOT EXISTS "projeto_documentos_projetoId_itemId_tipo_status_idx"
  ON "projeto_documentos" ("projetoId", "itemId", "tipo", "status");
ALTER TABLE "projeto_documentos" ENABLE ROW LEVEL SECURITY;
