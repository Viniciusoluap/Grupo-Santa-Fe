-- Aditiva: preserva medições e fotos existentes; não associa PCI a legado por suposição.
CREATE TABLE "obra_pci_versoes" (
 "id" TEXT PRIMARY KEY, "obraId" TEXT NOT NULL REFERENCES "obras"("id") ON DELETE CASCADE,
 "hash" VARCHAR(64) NOT NULL, "nome" VARCHAR(255) NOT NULL, "dados" BYTEA NOT NULL,
 "tamanho" INTEGER NOT NULL, "parsed" JSONB NOT NULL, "enviadoPorId" TEXT,
 "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "obra_pci_versoes_obraId_hash_key" UNIQUE ("obraId", "hash")
);
CREATE TABLE "obra_pci" (
 "obraId" TEXT PRIMARY KEY REFERENCES "obras"("id") ON DELETE CASCADE,
 "versaoId" TEXT NOT NULL REFERENCES "obra_pci_versoes"("id") ON DELETE NO ACTION,
 "enviadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "vinculadaEm" TIMESTAMP(3), "vinculadaPorId" TEXT
);
ALTER TABLE "obra_progresso_itens" ALTER COLUMN "incidencia" TYPE DECIMAL(20,15);
ALTER TABLE "obra_progresso_historico" ALTER COLUMN "somaIncidencia" TYPE DECIMAL(20,15);
ALTER TABLE "obra_progresso_historico" ADD COLUMN "tipo" VARCHAR(20) NOT NULL DEFAULT 'pls',
 ADD COLUMN "dadosCaixa" JSONB, ADD COLUMN "pciVersaoId" TEXT REFERENCES "obra_pci_versoes"("id") ON DELETE NO ACTION;
ALTER TABLE "obra_fotos" ADD COLUMN "medicaoId" TEXT REFERENCES "obra_progresso_historico"("id") ON DELETE SET NULL;
CREATE INDEX "obra_fotos_medicaoId_idx" ON "obra_fotos"("medicaoId");
ALTER TABLE "obra_pci" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "obra_pci_versoes" ENABLE ROW LEVEL SECURITY;
-- Rollback operacional: reverter o código; manter tabelas/colunas para preservar histórico.
