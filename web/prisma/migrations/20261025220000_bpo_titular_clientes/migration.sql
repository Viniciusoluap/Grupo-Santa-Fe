-- Porte do lote BPO/Regularização da Prospecta para o Grupo Santa Fé.
-- Migração aditiva e idempotente: não remove nem reescreve dados existentes.
ALTER TABLE "transacoes_bancarias" ADD COLUMN IF NOT EXISTS "titular" TEXT;
ALTER TABLE "transacoes_bancarias" ADD COLUMN IF NOT EXISTS "descricaoOriginal" TEXT;
ALTER TABLE "transacoes_bancarias" ADD COLUMN IF NOT EXISTS "bpoClienteId" TEXT;
ALTER TABLE "transacoes_bancarias" ADD COLUMN IF NOT EXISTS "asaasPaymentId" TEXT;

ALTER TABLE "bpo_clientes" ADD COLUMN IF NOT EXISTS "leadId" TEXT;
ALTER TABLE "bpo_lancamentos" ADD COLUMN IF NOT EXISTS "asaasPaymentId" TEXT;

CREATE TABLE IF NOT EXISTS "bpo_regras_titular" (
  "id" TEXT NOT NULL,
  "titularNormalizado" TEXT NOT NULL,
  "categoria" TEXT,
  "bpoClienteId" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bpo_regras_titular_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "bpo_regras_titular_titularNormalizado_key" ON "bpo_regras_titular"("titularNormalizado");
CREATE UNIQUE INDEX IF NOT EXISTS "bpo_lancamentos_asaasPaymentId_key" ON "bpo_lancamentos"("asaasPaymentId");
CREATE INDEX IF NOT EXISTS "transacoes_bancarias_titular_idx" ON "transacoes_bancarias"("titular");
CREATE INDEX IF NOT EXISTS "transacoes_bancarias_asaasPaymentId_idx" ON "transacoes_bancarias"("asaasPaymentId");
CREATE INDEX IF NOT EXISTS "bpo_clientes_leadId_idx" ON "bpo_clientes"("leadId");

DO $$ BEGIN
  ALTER TABLE "bpo_clientes" ADD CONSTRAINT "bpo_clientes_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "transacoes_bancarias" ADD CONSTRAINT "transacoes_bancarias_bpoClienteId_fkey"
    FOREIGN KEY ("bpoClienteId") REFERENCES "bpo_clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "bpo_regras_titular" ADD CONSTRAINT "bpo_regras_titular_bpoClienteId_fkey"
    FOREIGN KEY ("bpoClienteId") REFERENCES "bpo_clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
