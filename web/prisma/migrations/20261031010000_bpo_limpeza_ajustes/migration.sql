-- Arquivamento local reversível; nenhum lançamento existente é alterado.
ALTER TABLE "bpo_lancamentos" ADD COLUMN IF NOT EXISTS "exclusaoLoteBackupId" TEXT;

-- Protege somente vínculos novos/alterados; os vínculos operacionais antigos continuam íntegros.
CREATE OR REPLACE FUNCTION bpo_impedir_vinculo_arquivado() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE removido text;
BEGIN
  IF NEW."bpoLancamentoId" IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW."bpoLancamentoId" IS NOT DISTINCT FROM OLD."bpoLancamentoId" THEN
    IF NOT (NEW.status = 'confirmado' AND (OLD.status IS DISTINCT FROM 'confirmado' OR NEW.valor > OLD.valor)) THEN RETURN NEW; END IF;
  END IF;
  SELECT "exclusaoLoteBackupId" INTO removido FROM bpo_lancamentos WHERE id = NEW."bpoLancamentoId" FOR UPDATE;
  IF removido IS NOT NULL THEN RAISE EXCEPTION 'Lançamento excluído na limpeza de ajustes: restaure o lote antes de vincular.'; END IF;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE TRIGGER obra_bpo_nao_arquivado BEFORE INSERT OR UPDATE OF "bpoLancamentoId", status, valor ON obra_movimentos FOR EACH ROW EXECUTE FUNCTION bpo_impedir_vinculo_arquivado();
CREATE OR REPLACE TRIGGER regularizacao_bpo_nao_arquivado BEFORE INSERT OR UPDATE OF "bpoLancamentoId", status, valor ON regularizacao_recebimentos FOR EACH ROW EXECUTE FUNCTION bpo_impedir_vinculo_arquivado();
