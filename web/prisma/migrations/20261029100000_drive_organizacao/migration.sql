-- Pedido de 29/10 (SPEC-DRIVE-ORGANIZACAO.md): cópia organizada de todos os
-- arquivos no Google Drive. Migração aditiva: só colunas anuláveis e uma tabela nova.
ALTER TABLE "documentos_usuario" ADD COLUMN IF NOT EXISTS "driveFileId" TEXT;
ALTER TABLE "pci_modelos" ADD COLUMN IF NOT EXISTS "driveFileId" TEXT;
ALTER TABLE "pci_geradas" ADD COLUMN IF NOT EXISTS "planilhaDriveFileId" TEXT,
  ADD COLUMN IF NOT EXISTS "pdfDriveFileId" TEXT;
ALTER TABLE "obra_pci_versoes" ADD COLUMN IF NOT EXISTS "driveFileId" TEXT;
ALTER TABLE "whatsapp_midias" ADD COLUMN IF NOT EXISTS "driveFileId" TEXT;

CREATE TABLE IF NOT EXISTS "estudo_orcamento_planilhas" (
  "id" TEXT PRIMARY KEY,
  "estudoId" TEXT NOT NULL REFERENCES "estudos_incorporacao"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "arquivoId" TEXT NOT NULL REFERENCES "arquivos"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "enviadoPorId" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "estudo_orcamento_planilhas_arquivoId_key" ON "estudo_orcamento_planilhas"("arquivoId");
CREATE INDEX IF NOT EXISTS "estudo_orcamento_planilhas_estudoId_criadoEm_idx" ON "estudo_orcamento_planilhas"("estudoId", "criadoEm");
ALTER TABLE "estudo_orcamento_planilhas" ENABLE ROW LEVEL SECURITY;
-- Rollback operacional: reverter o código; colunas/tabela podem ficar (anuláveis).
