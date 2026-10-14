-- Pedido A6 (14/10/2026, paridade com a Prospecta 0051): excluir é excluir, em
-- todo o sistema. Lançamentos financeiros (movimentos da obra e recebimentos da
-- regularização) deixam de ser "cancelados" e passam a ser apagados de verdade,
-- junto com o próprio histórico. Os que já estavam cancelados são apagados aqui.
-- As funções de guarda passam a aceitar DELETE e removem o histórico antes do
-- lançamento (as FKs do histórico continuam RESTRICT; o gatilho limpa antes).
CREATE OR REPLACE FUNCTION public.obra_movimentos_guarda()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$ DECLARE lanc record; alocado numeric; BEGIN
  -- Pedido A6: excluir apaga de verdade, junto com o histórico do movimento.
  IF TG_OP = 'DELETE' THEN DELETE FROM "obra_movimentos_historico" WHERE "movimentoId" = OLD."id"; RETURN OLD; END IF;
  IF NEW."bpoLancamentoId" IS NOT NULL AND NEW."status" = 'confirmado' THEN PERFORM pg_advisory_xact_lock(hashtext('bpo_lancamento:' || NEW."bpoLancamentoId")); SELECT "id", "valor"::numeric(15,2) AS valor, "pago", "tipo" INTO lanc FROM "bpo_lancamentos" WHERE "id" = NEW."bpoLancamentoId"; IF NOT FOUND THEN RAISE EXCEPTION 'BPO_LANCAMENTO_INEXISTENTE'; END IF; IF NOT lanc.pago THEN RAISE EXCEPTION 'BPO_LANCAMENTO_NAO_PAGO: só lançamentos pagos/recebidos podem ser vinculados'; END IF; IF (NEW."natureza" = 'pagamento') <> (lanc.tipo = 'despesa') THEN RAISE EXCEPTION 'BPO_NATUREZA_INCOMPATIVEL: pagamentos usam despesas do BPO; recebimentos usam receitas'; END IF; alocado := bpo_valor_alocado(NEW."bpoLancamentoId", NEW."id", NULL); IF alocado + NEW."valor" > lanc.valor THEN RAISE EXCEPTION 'BPO_ALOCACAO_EXCEDIDA: disponível R$ %', lanc.valor - alocado; END IF; END IF; NEW."atualizadoEm" := now(); RETURN NEW; END; $function$;

CREATE OR REPLACE FUNCTION public.regularizacao_recebimentos_guarda()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$ DECLARE lanc record; alocado numeric; BEGIN
  -- Pedido A6: excluir apaga de verdade, junto com o histórico do recebimento.
  IF TG_OP = 'DELETE' THEN DELETE FROM "regularizacao_recebimentos_historico" WHERE "recebimentoId" = OLD."id"; RETURN OLD; END IF;
  IF NEW."bpoLancamentoId" IS NOT NULL AND NEW."status" = 'confirmado' THEN PERFORM pg_advisory_xact_lock(hashtext('bpo_lancamento:' || NEW."bpoLancamentoId")); SELECT "id", "valor"::numeric(15,2) AS valor, "pago", "tipo" INTO lanc FROM "bpo_lancamentos" WHERE "id" = NEW."bpoLancamentoId"; IF NOT FOUND THEN RAISE EXCEPTION 'BPO_LANCAMENTO_INEXISTENTE'; END IF; IF NOT lanc.pago THEN RAISE EXCEPTION 'BPO_LANCAMENTO_NAO_PAGO: só lançamentos pagos/recebidos podem ser vinculados'; END IF; IF lanc.tipo = 'despesa' THEN RAISE EXCEPTION 'BPO_NATUREZA_INCOMPATIVEL: recebimentos usam receitas do BPO'; END IF; alocado := bpo_valor_alocado(NEW."bpoLancamentoId", NULL, NEW."id"); IF alocado + NEW."valor" > lanc.valor THEN RAISE EXCEPTION 'BPO_ALOCACAO_EXCEDIDA: disponível R$ %', lanc.valor - alocado; END IF; END IF; NEW."atualizadoEm" := now(); RETURN NEW; END; $function$;

DELETE FROM "obra_movimentos" WHERE "status" = 'cancelado';
DELETE FROM "regularizacao_recebimentos" WHERE "status" = 'cancelado';
