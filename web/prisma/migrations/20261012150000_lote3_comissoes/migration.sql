-- EPIC-020 Lote 3 (item 32) — comissões automáticas pelo CRM.
-- Somente aditiva e idempotente. Regra de comissão: percentual da obra ou,
-- na falta dele, o percentual padrão do corretor. Nenhum percentual é
-- preenchido aqui: a regra é cadastrada pela empresa (nunca inventada).
ALTER TABLE "obras" ADD COLUMN IF NOT EXISTS "comissaoPercentual" DECIMAL(7,4);
DO $fn$ BEGIN
  ALTER TABLE "obras" ADD CONSTRAINT "obras_comissaoPercentual_range" CHECK ("comissaoPercentual" IS NULL OR ("comissaoPercentual" >= 0 AND "comissaoPercentual" <= 100));
EXCEPTION WHEN duplicate_object THEN NULL; END $fn$;

CREATE TABLE IF NOT EXISTS "regras_comissao_corretor" (
  "corretorId" TEXT NOT NULL,
  "percentual" DECIMAL(7,4) NOT NULL CHECK ("percentual" >= 0 AND "percentual" <= 100),
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "regras_comissao_corretor_pkey" PRIMARY KEY ("corretorId"),
  CONSTRAINT "regras_comissao_corretor_corretorId_fkey" FOREIGN KEY ("corretorId") REFERENCES "corretores"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
