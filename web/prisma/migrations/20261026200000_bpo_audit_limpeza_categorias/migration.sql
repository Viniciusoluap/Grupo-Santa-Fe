-- BPO: auditoria otimista, limpeza recuperável e separação de categorias. Aditiva.
ALTER TABLE "bpo_lancamentos" ADD COLUMN IF NOT EXISTS "categoriaOperacional" TEXT;
ALTER TABLE "bpo_lancamentos" ADD COLUMN IF NOT EXISTS "categoriaContabil" TEXT;
ALTER TABLE "bpo_lancamentos" ADD COLUMN IF NOT EXISTS "etapa" TEXT;
ALTER TABLE "bpo_lancamentos" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "bpo_lancamentos" ADD COLUMN IF NOT EXISTS "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "bpo_conta_limpeza_backups" (
  "id" TEXT NOT NULL,
  "contaReferencia" TEXT NOT NULL,
  "contaRotulo" TEXT NOT NULL,
  "snapshotJson" TEXT NOT NULL,
  "transacoes" INTEGER NOT NULL,
  "lancamentosRemovidos" INTEGER NOT NULL,
  "lancamentosPreservados" INTEGER NOT NULL,
  "criadoPorUsuarioId" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bpo_conta_limpeza_backups_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "bpo_conta_limpeza_backups_contaReferencia_criadoEm_idx" ON "bpo_conta_limpeza_backups"("contaReferencia", "criadoEm");

CREATE TABLE IF NOT EXISTS "bpo_lancamento_historico" (
  "id" TEXT NOT NULL,
  "lancamentoId" TEXT NOT NULL,
  "lancamentoReferencia" TEXT NOT NULL,
  "versaoAnterior" INTEGER NOT NULL,
  "alteradoPorUsuarioId" TEXT,
  "motivo" TEXT NOT NULL,
  "antesJson" TEXT NOT NULL,
  "depoisJson" TEXT NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bpo_lancamento_historico_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "bpo_lancamento_historico_lancamentoReferencia_criadoEm_idx" ON "bpo_lancamento_historico"("lancamentoReferencia", "criadoEm");

ALTER TABLE "bpo_conta_limpeza_backups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bpo_conta_limpeza_backups" FORCE ROW LEVEL SECURITY;
ALTER TABLE "bpo_lancamento_historico" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bpo_lancamento_historico" FORCE ROW LEVEL SECURITY;
