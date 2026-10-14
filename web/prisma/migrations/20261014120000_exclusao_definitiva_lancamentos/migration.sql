-- Pedido A6 (14/10/2026, paridade com a Prospecta 0051): excluir é excluir, em
-- todo o sistema. Lançamentos financeiros (movimentos da obra e recebimentos da
-- regularização) deixam de ser "cancelados" e passam a ser apagados de verdade,
-- junto com o próprio histórico. Os que já estavam cancelados são apagados aqui.
DROP TRIGGER IF EXISTS obra_movimentos_guarda_trg ON "obra_movimentos";
CREATE TRIGGER obra_movimentos_guarda_trg BEFORE INSERT OR UPDATE ON "obra_movimentos"
  FOR EACH ROW EXECUTE FUNCTION obra_movimentos_guarda();
DROP TRIGGER IF EXISTS regularizacao_recebimentos_guarda_trg ON "regularizacao_recebimentos";
CREATE TRIGGER regularizacao_recebimentos_guarda_trg BEFORE INSERT OR UPDATE ON "regularizacao_recebimentos"
  FOR EACH ROW EXECUTE FUNCTION regularizacao_recebimentos_guarda();
ALTER TABLE "obra_movimentos_historico" DROP CONSTRAINT IF EXISTS "obra_movimentos_historico_movimentoId_fkey";
ALTER TABLE "obra_movimentos_historico" ADD CONSTRAINT "obra_movimentos_historico_movimentoId_fkey"
  FOREIGN KEY ("movimentoId") REFERENCES "obra_movimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "regularizacao_recebimentos_historico" DROP CONSTRAINT IF EXISTS "regularizacao_recebimentos_historico_recebimentoId_fkey";
ALTER TABLE "regularizacao_recebimentos_historico" ADD CONSTRAINT "regularizacao_recebimentos_historico_recebimentoId_fkey"
  FOREIGN KEY ("recebimentoId") REFERENCES "regularizacao_recebimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
DELETE FROM "obra_movimentos" WHERE "status" = 'cancelado';
DELETE FROM "regularizacao_recebimentos" WHERE "status" = 'cancelado';
