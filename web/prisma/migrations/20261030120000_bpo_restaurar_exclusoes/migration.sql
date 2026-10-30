-- Lote 4 (30/10/2026) — BPO: "Restaurar" exclusões em lote a partir do backup.
-- Aditiva e idempotente (só colunas novas; a tabela já tem RLS desde 20261029111000_bpo_lote3).
-- Paridade: Prospecta drizzle/0097_bpo_restaurar_exclusoes.sql. Não aplicar em produção sem autorização.
ALTER TABLE "bpo_lancamento_exclusoes_backup" ADD COLUMN IF NOT EXISTS "restauradoEm" TIMESTAMP(3);
ALTER TABLE "bpo_lancamento_exclusoes_backup" ADD COLUMN IF NOT EXISTS "restauradoPorUsuarioId" TEXT;
ALTER TABLE "bpo_lancamento_exclusoes_backup" ADD COLUMN IF NOT EXISTS "restauracaoJson" TEXT;
