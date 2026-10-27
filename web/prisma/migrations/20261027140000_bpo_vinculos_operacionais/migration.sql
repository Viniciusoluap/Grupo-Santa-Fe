ALTER TABLE "bpo_lancamentos" ADD COLUMN IF NOT EXISTS "vinculoOperacionalId" TEXT;
ALTER TABLE "bpo_lancamentos" ADD COLUMN IF NOT EXISTS "vinculoOperacionalRotulo" TEXT;
ALTER TABLE "bpo_lancamentos" ADD COLUMN IF NOT EXISTS "tipoDespesaObra" TEXT;
ALTER TABLE "bpo_lancamentos" ADD COLUMN IF NOT EXISTS "requestKey" TEXT;
ALTER TABLE "bpo_lancamentos" ADD COLUMN IF NOT EXISTS "origemEfetiva" TEXT NOT NULL DEFAULT 'legado';
ALTER TABLE "bpo_lancamentos" ALTER COLUMN "origemEfetiva" SET DEFAULT 'manual';
ALTER TABLE "bpo_lancamentos" ADD COLUMN IF NOT EXISTS "origemTransacaoKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "bpo_lancamentos_origemTransacaoKey_key" ON "bpo_lancamentos"("origemTransacaoKey");
UPDATE "bpo_lancamentos" l SET "origemTransacaoKey" = t."externalId" FROM "transacoes_bancarias" t WHERE l."transacaoId" = t.id AND t."externalId" IS NOT NULL AND l."origemTransacaoKey" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "bpo_lancamentos_requestKey_key" ON "bpo_lancamentos"("requestKey");
CREATE INDEX IF NOT EXISTS "bpo_lancamentos_operacional_idx" ON "bpo_lancamentos"("categoriaOperacional", "vinculoOperacionalId");
-- Preserve the stage saved by the previous implementation; it was not a module category.
UPDATE "bpo_lancamentos" SET "etapa" = COALESCE("etapa", "categoriaOperacional"), "categoriaOperacional" = NULL
WHERE "categoriaOperacional" IS NOT NULL AND "categoriaOperacional" NOT IN ('obras','tarefas_agenda','regularizacoes','comissoes','projetos','avaliacoes','imoveis','incorporacao','financiamentos');
