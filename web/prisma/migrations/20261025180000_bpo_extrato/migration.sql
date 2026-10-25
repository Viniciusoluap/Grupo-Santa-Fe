-- LOTE C (25/10, paridade Prospecta): o extrato bancário alimenta todo o BPO Financeiro.
-- Cada movimentação bancária gera um lançamento pago em bpo_lancamentos (vínculo 1:1),
-- com categoria padrão; a conta guarda o saldo informado pelo próprio extrato. Aditiva.
ALTER TABLE "bpo_lancamentos" ADD COLUMN IF NOT EXISTS "categoria" TEXT;
ALTER TABLE "bpo_lancamentos" ADD COLUMN IF NOT EXISTS "transacaoId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "bpo_lancamentos_transacaoId_key" ON "bpo_lancamentos"("transacaoId");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bpo_lancamentos_transacaoId_fkey') THEN
    ALTER TABLE "bpo_lancamentos" ADD CONSTRAINT "bpo_lancamentos_transacaoId_fkey"
      FOREIGN KEY ("transacaoId") REFERENCES "transacoes_bancarias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "contas_bancarias" ADD COLUMN IF NOT EXISTS "saldoExtrato" DOUBLE PRECISION;
ALTER TABLE "contas_bancarias" ADD COLUMN IF NOT EXISTS "saldoExtratoData" DATE;
