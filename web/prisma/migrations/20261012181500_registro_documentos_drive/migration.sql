-- Referências privadas de arquivos do checklist da incorporação.
-- Dados binários permanecem exclusivamente no Drive configurado para Santa Fé.
CREATE TABLE "estudo_documentos_registro" (
  "id" TEXT NOT NULL,
  "estudoId" TEXT NOT NULL,
  "itemId" VARCHAR(80) NOT NULL,
  "driveFileId" TEXT NOT NULL,
  "nome" VARCHAR(255) NOT NULL,
  "mime" VARCHAR(100) NOT NULL,
  "tamanho" INTEGER NOT NULL,
  "sha256" VARCHAR(64) NOT NULL,
  "enviadoPorId" TEXT NOT NULL,
  "enviadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "desvinculadoEm" TIMESTAMP(3),
  "desvinculadoPorId" TEXT,
  CONSTRAINT "estudo_documentos_registro_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "estudo_documentos_registro_estudoId_fkey" FOREIGN KEY ("estudoId") REFERENCES "estudos_incorporacao"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "estudo_documentos_registro_driveFileId_key" ON "estudo_documentos_registro"("driveFileId");
CREATE INDEX "estudo_documentos_registro_estudoId_itemId_ativo_idx" ON "estudo_documentos_registro"("estudoId", "itemId", "ativo");
CREATE UNIQUE INDEX "estudo_documentos_registro_um_ativo_idx" ON "estudo_documentos_registro"("estudoId", "itemId") WHERE "ativo" = true;
