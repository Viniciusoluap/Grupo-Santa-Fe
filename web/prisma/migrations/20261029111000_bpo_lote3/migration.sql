-- Lote 3 (29/10/2026) — BPO: itens 16 (combinar pagamentos e exclusão em lote com backup).
-- Aditiva. Paridade: Prospecta drizzle/0095_bpo_lote3.sql. Não aplicar em produção sem autorização.

-- Item 16: cobrança original combinada aponta para a nova cobrança (soma); a original não é apagada.
ALTER TABLE "bpo_lancamentos" ADD COLUMN IF NOT EXISTS "combinadaEmId" TEXT;
CREATE INDEX IF NOT EXISTS "bpo_lancamentos_combinadaEmId_idx" ON "bpo_lancamentos"("combinadaEmId");

-- Item 16: backup JSON de cada exclusão em lote (recuperação + auditoria: quem, quando, filtros).
CREATE TABLE IF NOT EXISTS "bpo_lancamento_exclusoes_backup" (
  "id" TEXT NOT NULL,
  "modo" TEXT NOT NULL,
  "aba" TEXT NOT NULL,
  "filtrosJson" TEXT NOT NULL DEFAULT '{}',
  "quantidade" INTEGER NOT NULL,
  "protegidos" INTEGER NOT NULL DEFAULT 0,
  "snapshotJson" TEXT NOT NULL,
  "criadoPorUsuarioId" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bpo_lancamento_exclusoes_backup_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "bpo_lancamento_exclusoes_backup_criadoEm_idx" ON "bpo_lancamento_exclusoes_backup"("criadoEm");
ALTER TABLE "bpo_lancamento_exclusoes_backup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bpo_lancamento_exclusoes_backup" FORCE ROW LEVEL SECURITY;
