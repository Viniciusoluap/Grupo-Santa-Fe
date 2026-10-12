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

-- Padrão do projeto (20260702000001_enable_rls_security): toda tabela pública
-- com RLS ligado, sem políticas — acesso só pelo servidor (Prisma, dono das
-- tabelas). Inclui as tabelas do Lote 2, que tinham ficado sem RLS.
ALTER TABLE "regras_comissao_corretor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "investidores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "obra_investidores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "obra_movimentos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "obra_movimentos_historico" ENABLE ROW LEVEL SECURITY;
