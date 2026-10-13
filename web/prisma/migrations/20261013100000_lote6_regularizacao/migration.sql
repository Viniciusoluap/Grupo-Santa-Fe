-- EPIC-020 Lote 6 — Regularização (itens 30 e 31). Mesmas regras da migration
-- 0046 da Prospecta.
-- 30: Status do Processo (em_analise, em_andamento, concluido) + Etapas livres.
--     "aguardando_configuracao" (fila do CRM) e "cancelado" (exclusão) seguem
--     existindo, mas não são escolhidos no seletor de status.
-- 31: tabela financeira por processo (17 itens iniciais) com recebimentos
--     manuais ou do BPO, parciais e com histórico.
-- Somente aditiva: "valorPago" e "reg_documentos" ficam no banco; o status
-- antigo fica preservado em "statusLegado". Idempotente.

ALTER TABLE "regularizacoes" ADD COLUMN IF NOT EXISTS "statusLegado" TEXT;
UPDATE "regularizacoes" SET "statusLegado" = "status"
  WHERE "statusLegado" IS NULL
    AND "status" NOT IN ('em_analise', 'em_andamento', 'concluido', 'cancelado', 'aguardando_configuracao');
UPDATE "regularizacoes" SET "status" = CASE "status"
    WHEN 'analise' THEN 'em_analise'
    WHEN 'analise_inicial' THEN 'em_analise'
    WHEN 'documentacao' THEN 'em_andamento'
    WHEN 'protocolo' THEN 'em_andamento'
    WHEN 'em_analise_orgao' THEN 'em_andamento'
    WHEN 'pendencias' THEN 'em_andamento'
    WHEN 'aprovado' THEN 'em_andamento'
    WHEN 'registrado' THEN 'em_andamento'
    ELSE 'em_analise'
  END
  WHERE "status" NOT IN ('em_analise', 'em_andamento', 'concluido', 'cancelado', 'aguardando_configuracao');
ALTER TABLE "regularizacoes" ALTER COLUMN "status" SET DEFAULT 'em_analise';
DO $fn$ BEGIN
  ALTER TABLE "regularizacoes" ADD CONSTRAINT "regularizacoes_status_chk"
    CHECK ("status" IN ('em_analise', 'em_andamento', 'concluido', 'cancelado', 'aguardando_configuracao'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $fn$;

CREATE TABLE IF NOT EXISTS "regularizacao_etapas" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "regularizacaoId" TEXT NOT NULL REFERENCES "regularizacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "nome" VARCHAR(120) NOT NULL,
  "ordem" INTEGER NOT NULL,
  "progresso" INTEGER NOT NULL DEFAULT 0 CHECK ("progresso" BETWEEN 0 AND 100),
  "observacoes" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "regularizacao_etapas_reg_idx" ON "regularizacao_etapas"("regularizacaoId", "ordem");

CREATE TABLE IF NOT EXISTS "regularizacao_itens_financeiros" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "regularizacaoId" TEXT NOT NULL REFERENCES "regularizacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "chavePadrao" VARCHAR(40),
  "nome" VARCHAR(120) NOT NULL,
  "grupo" VARCHAR(20) NOT NULL CHECK ("grupo" IN ('durante_obra', 'casa_pronta')),
  "ordem" INTEGER NOT NULL,
  "previsto" DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK ("previsto" >= 0),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "regularizacao_itens_id_reg_unique" UNIQUE ("id", "regularizacaoId")
);
CREATE UNIQUE INDEX IF NOT EXISTS "regularizacao_itens_padrao_idx" ON "regularizacao_itens_financeiros"("regularizacaoId", "chavePadrao") WHERE "chavePadrao" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "regularizacao_recebimentos" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "regularizacaoId" TEXT NOT NULL REFERENCES "regularizacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "itemId" TEXT NOT NULL,
  "valor" DECIMAL(15,2) NOT NULL CHECK ("valor" > 0),
  "data" DATE NOT NULL,
  "observacao" TEXT,
  "origem" TEXT NOT NULL CHECK ("origem" IN ('manual', 'bpo', 'migracao')),
  "bpoLancamentoId" TEXT REFERENCES "bpo_lancamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'confirmado' CHECK ("status" IN ('confirmado', 'cancelado')),
  "motivoCancelamento" TEXT,
  "criadoPorId" TEXT,
  "atualizadoPorId" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "regularizacao_recebimentos_item_fk" FOREIGN KEY ("itemId", "regularizacaoId")
    REFERENCES "regularizacao_itens_financeiros"("id", "regularizacaoId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "regularizacao_recebimentos_origem_bpo" CHECK (("origem" = 'bpo') = ("bpoLancamentoId" IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS "regularizacao_recebimentos_reg_idx" ON "regularizacao_recebimentos"("regularizacaoId");
CREATE INDEX IF NOT EXISTS "regularizacao_recebimentos_bpo_idx" ON "regularizacao_recebimentos"("bpoLancamentoId");

CREATE TABLE IF NOT EXISTS "regularizacao_recebimentos_historico" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "recebimentoId" TEXT NOT NULL REFERENCES "regularizacao_recebimentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "acao" TEXT NOT NULL,
  "antes" JSONB,
  "depois" JSONB NOT NULL,
  "usuarioId" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "regularizacao_etapas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "regularizacao_itens_financeiros" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "regularizacao_recebimentos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "regularizacao_recebimentos_historico" ENABLE ROW LEVEL SECURITY;

-- Uma transação do BPO é uma só: obras + regularizações somadas, mesmo lock.
CREATE OR REPLACE FUNCTION bpo_valor_alocado(lancamento TEXT, mov_excluido TEXT, rec_excluido TEXT) RETURNS numeric AS $fn$
  SELECT COALESCE((SELECT SUM("valor") FROM "obra_movimentos"
      WHERE "bpoLancamentoId" = lancamento AND "status" = 'confirmado' AND "id" IS DISTINCT FROM mov_excluido), 0)
    + COALESCE((SELECT SUM("valor") FROM "regularizacao_recebimentos"
      WHERE "bpoLancamentoId" = lancamento AND "status" = 'confirmado' AND "id" IS DISTINCT FROM rec_excluido), 0);
$fn$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION obra_movimentos_guarda() RETURNS trigger AS $fn$
DECLARE
  lanc record;
  alocado numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'MOVIMENTO_NAO_PODE_SER_APAGADO: cancele o movimento para preservar o histórico';
  END IF;
  IF NEW."bpoLancamentoId" IS NOT NULL AND NEW."status" = 'confirmado' THEN
    PERFORM pg_advisory_xact_lock(hashtext('bpo_lancamento:' || NEW."bpoLancamentoId"));
    SELECT "id", "valor"::numeric(15,2) AS valor, "pago", "tipo" INTO lanc FROM "bpo_lancamentos" WHERE "id" = NEW."bpoLancamentoId";
    IF NOT FOUND THEN RAISE EXCEPTION 'BPO_LANCAMENTO_INEXISTENTE'; END IF;
    IF NOT lanc.pago THEN RAISE EXCEPTION 'BPO_LANCAMENTO_NAO_PAGO: só lançamentos pagos/recebidos podem ser vinculados'; END IF;
    IF (NEW."natureza" = 'pagamento') <> (lanc.tipo = 'despesa') THEN
      RAISE EXCEPTION 'BPO_NATUREZA_INCOMPATIVEL: pagamentos usam despesas do BPO; recebimentos usam receitas';
    END IF;
    alocado := bpo_valor_alocado(NEW."bpoLancamentoId", NEW."id", NULL);
    IF alocado + NEW."valor" > lanc.valor THEN
      RAISE EXCEPTION 'BPO_ALOCACAO_EXCEDIDA: disponível R$ %', lanc.valor - alocado;
    END IF;
  END IF;
  NEW."atualizadoEm" := now();
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION regularizacao_recebimentos_guarda() RETURNS trigger AS $fn$
DECLARE
  lanc record;
  alocado numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'RECEBIMENTO_NAO_PODE_SER_APAGADO: cancele o recebimento para preservar o histórico';
  END IF;
  IF NEW."bpoLancamentoId" IS NOT NULL AND NEW."status" = 'confirmado' THEN
    PERFORM pg_advisory_xact_lock(hashtext('bpo_lancamento:' || NEW."bpoLancamentoId"));
    SELECT "id", "valor"::numeric(15,2) AS valor, "pago", "tipo" INTO lanc FROM "bpo_lancamentos" WHERE "id" = NEW."bpoLancamentoId";
    IF NOT FOUND THEN RAISE EXCEPTION 'BPO_LANCAMENTO_INEXISTENTE'; END IF;
    IF NOT lanc.pago THEN RAISE EXCEPTION 'BPO_LANCAMENTO_NAO_PAGO: só lançamentos pagos/recebidos podem ser vinculados'; END IF;
    IF lanc.tipo = 'despesa' THEN
      RAISE EXCEPTION 'BPO_NATUREZA_INCOMPATIVEL: recebimentos usam receitas do BPO';
    END IF;
    alocado := bpo_valor_alocado(NEW."bpoLancamentoId", NULL, NEW."id");
    IF alocado + NEW."valor" > lanc.valor THEN
      RAISE EXCEPTION 'BPO_ALOCACAO_EXCEDIDA: disponível R$ %', lanc.valor - alocado;
    END IF;
  END IF;
  NEW."atualizadoEm" := now();
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION regularizacao_recebimentos_historico_registrar() RETURNS trigger AS $fn$
BEGIN
  INSERT INTO "regularizacao_recebimentos_historico" ("recebimentoId", "acao", "antes", "depois", "usuarioId")
  VALUES (
    NEW."id",
    CASE
      WHEN TG_OP = 'INSERT' THEN 'criado'
      WHEN OLD."status" <> NEW."status" AND NEW."status" = 'cancelado' THEN 'cancelado'
      WHEN OLD."status" <> NEW."status" THEN 'reativado'
      ELSE 'editado'
    END,
    CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) END,
    to_jsonb(NEW),
    COALESCE(NEW."atualizadoPorId", NEW."criadoPorId")
  );
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS regularizacao_recebimentos_guarda_trg ON "regularizacao_recebimentos";
CREATE TRIGGER regularizacao_recebimentos_guarda_trg BEFORE INSERT OR UPDATE OR DELETE ON "regularizacao_recebimentos"
  FOR EACH ROW EXECUTE FUNCTION regularizacao_recebimentos_guarda();
DROP TRIGGER IF EXISTS regularizacao_recebimentos_historico_trg ON "regularizacao_recebimentos";
CREATE TRIGGER regularizacao_recebimentos_historico_trg AFTER INSERT OR UPDATE ON "regularizacao_recebimentos"
  FOR EACH ROW EXECUTE FUNCTION regularizacao_recebimentos_historico_registrar();

-- Item com recebimento (mesmo cancelado) não é excluído: o histórico fica.
CREATE OR REPLACE FUNCTION regularizacao_itens_guarda() RETURNS trigger AS $fn$
BEGIN
  IF EXISTS (SELECT 1 FROM "regularizacao_recebimentos" WHERE "itemId" = OLD."id") THEN
    RAISE EXCEPTION 'ITEM_COM_RECEBIMENTOS';
  END IF;
  RETURN OLD;
END;
$fn$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS regularizacao_itens_guarda_trg ON "regularizacao_itens_financeiros";
CREATE TRIGGER regularizacao_itens_guarda_trg BEFORE DELETE ON "regularizacao_itens_financeiros"
  FOR EACH ROW EXECUTE FUNCTION regularizacao_itens_guarda();

-- Os 17 itens iniciais (mesma lista de lib/financeiro/regularizacao.ts),
-- criados para todo processo — existente ou novo, venha de onde vier.
CREATE OR REPLACE FUNCTION regularizacao_semear_itens(reg TEXT) RETURNS void AS $fn$
  INSERT INTO "regularizacao_itens_financeiros" ("regularizacaoId", "chavePadrao", "nome", "grupo", "ordem")
  SELECT reg, v.chave, v.nome, v.grupo, v.ordem FROM (VALUES
    ('projetos', 'Projetos', 'durante_obra', 1),
    ('pci', 'PCI', 'durante_obra', 2),
    ('impressoes', 'Impressões', 'durante_obra', 3),
    ('agua', 'Água', 'durante_obra', 4),
    ('despachante', 'Despachante', 'durante_obra', 5),
    ('cert_inteiro_teor', 'Cert. Inteiro Teor', 'durante_obra', 6),
    ('art', 'ART', 'durante_obra', 7),
    ('alvara', 'Alvará', 'durante_obra', 8),
    ('vistoria_cef', 'Vistoria CEF', 'durante_obra', 9),
    ('tx_ass_cef', 'Tx Ass CEF', 'durante_obra', 10),
    ('seguro_cef', 'Seguro CEF', 'durante_obra', 11),
    ('itbi', 'ITBI', 'durante_obra', 12),
    ('registro_cartorio', 'Registro Cartório', 'durante_obra', 13),
    ('encargos_obra', 'Encargos de Obra', 'durante_obra', 14),
    ('habite_se', 'Habite-se', 'casa_pronta', 15),
    ('cnd_cno', 'CND e CNO', 'casa_pronta', 16),
    ('averbacao', 'Averbação', 'casa_pronta', 17)
  ) AS v(chave, nome, grupo, ordem)
  ON CONFLICT ("regularizacaoId", "chavePadrao") WHERE "chavePadrao" IS NOT NULL DO NOTHING;
$fn$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION regularizacoes_semear_trg_fn() RETURNS trigger AS $fn$
BEGIN
  PERFORM regularizacao_semear_itens(NEW."id");
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS regularizacoes_semear_trg ON "regularizacoes";
CREATE TRIGGER regularizacoes_semear_trg AFTER INSERT ON "regularizacoes"
  FOR EACH ROW EXECUTE FUNCTION regularizacoes_semear_trg_fn();

SELECT regularizacao_semear_itens("id") FROM "regularizacoes";

-- "Valor Pago" antigo (preenchido à mão, sem datas): vira um item próprio com
-- um único recebimento 'migracao', para o valor continuar no total recebido.
INSERT INTO "regularizacao_itens_financeiros" ("regularizacaoId", "chavePadrao", "nome", "grupo", "ordem", "previsto")
SELECT "id", 'valor_pago_anterior', 'Valor pago anteriormente (migrado, sem detalhamento)', 'durante_obra', 99, round("valorPago"::numeric, 2)
FROM "regularizacoes" WHERE "valorPago" > 0
ON CONFLICT ("regularizacaoId", "chavePadrao") WHERE "chavePadrao" IS NOT NULL DO NOTHING;
INSERT INTO "regularizacao_recebimentos" ("regularizacaoId", "itemId", "valor", "data", "observacao", "origem")
SELECT r."id", i."id", round(r."valorPago"::numeric, 2), CURRENT_DATE,
  'Valor pago informado na tela anterior, sem histórico de datas.', 'migracao'
FROM "regularizacoes" r
JOIN "regularizacao_itens_financeiros" i ON i."regularizacaoId" = r."id" AND i."chavePadrao" = 'valor_pago_anterior'
WHERE r."valorPago" > 0
  AND NOT EXISTS (SELECT 1 FROM "regularizacao_recebimentos" x WHERE x."itemId" = i."id" AND x."origem" = 'migracao');
