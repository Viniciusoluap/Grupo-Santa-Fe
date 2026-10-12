-- EPIC-020 Lote 2 — Motor financeiro da Obra (Valores da Operação e Custos).
-- Grupo Santa Fé. Somente aditiva e idempotente: nada existente é apagado.
-- `obras.valorTotal`/`valorPago` (legados) permanecem intactos e NÃO são
-- migrados automaticamente: o significado de "Valor Total" é ambíguo
-- (orçamento × VGV) e fica no relatório de divergências para o dono decidir.
-- PRÉ-REQUISITO DE DEPLOY: aplicar antes de publicar o código.
BEGIN;
SET LOCAL lock_timeout = '10s';

ALTER TABLE "obras"
  ADD COLUMN IF NOT EXISTS "vgv" DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS "financiamentoCef" DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS "fgts" DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS "subsidio" DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS "custoTerreno" DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS "comissaoValor" DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS "orcamentoPrevisto" DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS "taxaMensalPct" DECIMAL(7,4),
  ADD COLUMN IF NOT EXISTS "qtdeParcelas" INTEGER,
  ADD COLUMN IF NOT EXISTS "escritorioCef" TEXT,
  ADD COLUMN IF NOT EXISTS "empreiteiroId" TEXT,
  ADD COLUMN IF NOT EXISTS "percentualEmpreiteiro" DECIMAL(9,6);

DO $$ BEGIN
  ALTER TABLE "obras" ADD CONSTRAINT "obras_empreiteiroId_fkey" FOREIGN KEY ("empreiteiroId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "obras" ADD CONSTRAINT "obras_percentualEmpreiteiro_range" CHECK ("percentualEmpreiteiro" IS NULL OR ("percentualEmpreiteiro" >= 0 AND "percentualEmpreiteiro" <= 100));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "investidores" (
  "id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "documento" TEXT,
  "telefone" TEXT,
  "email" TEXT,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "investidores_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "obra_investidores" (
  "id" TEXT NOT NULL,
  "obraId" TEXT NOT NULL REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "investidorId" TEXT NOT NULL REFERENCES "investidores"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "percentual" DECIMAL(9,6) NOT NULL CHECK ("percentual" >= 0 AND "percentual" <= 100),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "obra_investidores_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "obra_investidores_obraId_investidorId_key" ON "obra_investidores"("obraId", "investidorId");

CREATE TABLE IF NOT EXISTS "obra_movimentos" (
  "id" TEXT NOT NULL,
  "obraId" TEXT NOT NULL REFERENCES "obras"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "natureza" TEXT NOT NULL CHECK ("natureza" IN ('entrada', 'recebimento_cef', 'pagamento')),
  "categoria" TEXT CHECK ("categoria" IS NULL OR "categoria" IN ('terreno', 'comissao', 'empreiteiro', 'fornecedor', 'outros', 'nao_detalhado')),
  "descricao" TEXT NOT NULL,
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
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "obra_movimentos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "obra_movimentos_origem_bpo" CHECK (("origem" = 'bpo') = ("bpoLancamentoId" IS NOT NULL)),
  CONSTRAINT "obra_movimentos_categoria_pagamento" CHECK (("natureza" = 'pagamento') = ("categoria" IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS "obra_movimentos_obraId_idx" ON "obra_movimentos"("obraId");
CREATE INDEX IF NOT EXISTS "obra_movimentos_bpoLancamentoId_idx" ON "obra_movimentos"("bpoLancamentoId");

CREATE TABLE IF NOT EXISTS "obra_movimentos_historico" (
  "id" TEXT NOT NULL,
  "movimentoId" TEXT NOT NULL REFERENCES "obra_movimentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "acao" TEXT NOT NULL,
  "antes" JSONB,
  "depois" JSONB NOT NULL,
  "usuarioId" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "obra_movimentos_historico_pkey" PRIMARY KEY ("id")
);

-- Mesmas garantias da Prospecta, no próprio banco: movimento nunca é apagado,
-- toda inclusão/alteração vira histórico e uma transação do BPO não pode ser
-- alocada além do próprio valor, sem estar paga ou com natureza incompatível.
CREATE OR REPLACE FUNCTION obra_movimentos_guarda() RETURNS trigger AS $$
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
    SELECT COALESCE(SUM("valor"), 0) INTO alocado FROM "obra_movimentos"
      WHERE "bpoLancamentoId" = NEW."bpoLancamentoId" AND "status" = 'confirmado' AND "id" <> NEW."id";
    IF alocado + NEW."valor" > lanc.valor THEN
      RAISE EXCEPTION 'BPO_ALOCACAO_EXCEDIDA: disponível R$ %', lanc.valor - alocado;
    END IF;
  END IF;
  NEW."atualizadoEm" := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION obra_movimentos_historico_registrar() RETURNS trigger AS $$
BEGIN
  INSERT INTO "obra_movimentos_historico" ("id", "movimentoId", "acao", "antes", "depois", "usuarioId")
  VALUES (
    gen_random_uuid()::text,
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS obra_movimentos_guarda_trg ON "obra_movimentos";
CREATE TRIGGER obra_movimentos_guarda_trg BEFORE INSERT OR UPDATE OR DELETE ON "obra_movimentos"
  FOR EACH ROW EXECUTE FUNCTION obra_movimentos_guarda();
DROP TRIGGER IF EXISTS obra_movimentos_historico_trg ON "obra_movimentos";
CREATE TRIGGER obra_movimentos_historico_trg AFTER INSERT OR UPDATE ON "obra_movimentos"
  FOR EACH ROW EXECUTE FUNCTION obra_movimentos_historico_registrar();

COMMIT;
