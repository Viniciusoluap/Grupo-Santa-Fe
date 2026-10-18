-- Pedido de 18/10: cada medição do histórico pode ser solicitada e ter o
-- recebimento confirmado; edição registra quem alterou. Só acrescenta colunas.
ALTER TABLE "obra_progresso_historico" ADD COLUMN IF NOT EXISTS "solicitadaEm" TIMESTAMP(3);
ALTER TABLE "obra_progresso_historico" ADD COLUMN IF NOT EXISTS "solicitadaPorId" TEXT;
ALTER TABLE "obra_progresso_historico" ADD COLUMN IF NOT EXISTS "recebidaEm" TIMESTAMP(3);
ALTER TABLE "obra_progresso_historico" ADD COLUMN IF NOT EXISTS "recebidaPorId" TEXT;
ALTER TABLE "obra_progresso_historico" ADD COLUMN IF NOT EXISTS "editadaEm" TIMESTAMP(3);
ALTER TABLE "obra_progresso_historico" ADD COLUMN IF NOT EXISTS "editadaPorId" TEXT;
