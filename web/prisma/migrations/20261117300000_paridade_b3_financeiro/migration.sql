-- Paridade 17/11, bloco 3 (financeiro) com a Prospecta. Somente ADITIVA e IDEMPOTENTE: cria tabelas novas e
-- índices com IF NOT EXISTS; nenhum dado existente é alterado ou apagado. Reaplicar não muda nada.
-- NÃO aplicada em banco real por esta sessão: aplicar no Supabase ANTES do deploy do código.

-- ── 1. Conta Azul — "Liberar reimportação" (gêmeo de Prospecta drizzle/0122_bpo_lancamentos_expurgo.sql) ──
-- Antes de remover em definitivo um lançamento ARQUIVADO do Conta Azul que segura a chave única "requestKey",
-- a linha inteira é copiada para cá (um "loteId" por execução, com quem fez e quando).
-- Reversão: DROP TABLE "bpo_lancamentos_expurgo" (nenhuma outra tabela depende dela). Para devolver um
-- lançamento, reinserir a partir de "dadosJson".
CREATE TABLE IF NOT EXISTS "bpo_lancamentos_expurgo" (
    "id" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "lancamentoId" TEXT NOT NULL,
    "requestKey" TEXT,
    "origemEfetiva" TEXT,
    "exclusaoLoteBackupId" TEXT,
    "motivo" TEXT NOT NULL DEFAULT 'liberar_reimportacao_conta_azul',
    "dadosJson" TEXT NOT NULL,
    "expurgadoPorUsuarioId" TEXT,
    "expurgadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bpo_lancamentos_expurgo_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "bpo_lancamentos_expurgo_loteId_idx" ON "bpo_lancamentos_expurgo"("loteId");
CREATE INDEX IF NOT EXISTS "bpo_lancamentos_expurgo_lancamentoId_idx" ON "bpo_lancamentos_expurgo"("lancamentoId");

-- Dados internos servidos só pelo aplicativo (nunca pela API pública do Supabase), como bpo_centros_custo.
ALTER TABLE "bpo_lancamentos_expurgo" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "bpo_lancamentos_expurgo" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "bpo_lancamentos_expurgo" FROM authenticated;
  END IF;
END $$;
