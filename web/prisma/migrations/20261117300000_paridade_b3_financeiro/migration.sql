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

-- ── 2. Gerador de PCI — biblioteca de modelos de preenchimento (gêmeo de Prospecta drizzle/0118) ──
-- Um modelo guarda SÓ os dados técnicos de um projeto padrão (lista de permissão em src/lib/pci-gerador.ts,
-- CAMPOS_COPIAVEIS_MODELO_PCI). Salvar sobre um modelo cria nova versão ("versao" + 1, "anteriorId") e mantém a
-- anterior. Não confundir com "pci_modelos" (versões do modelo OFICIAL da CAIXA), que não muda.
-- Reversão: DROP TABLE "pci_modelos_preenchimento" (nenhuma outra tabela depende dela).
CREATE TABLE IF NOT EXISTS "pci_modelos_preenchimento" (
    "id" TEXT NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1 CHECK ("versao" >= 1),
    "anteriorId" TEXT,
    "dados" JSONB NOT NULL,
    "observacao" TEXT,
    "obraOrigemId" TEXT,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "excluidoEm" TIMESTAMP(3),
    "excluidoPorId" TEXT,
    -- true = já tem versão mais nova (marcado na mesma transação que grava a sucessora).
    "substituido" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "pci_modelos_preenchimento_pkey" PRIMARY KEY ("id")
);
-- Uma versão só tem uma sucessora (a lista mostra a última de cada modelo).
CREATE UNIQUE INDEX IF NOT EXISTS "pci_modelos_preenchimento_anteriorId_key" ON "pci_modelos_preenchimento"("anteriorId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pci_modelos_preenchimento_anteriorId_fkey') THEN
    ALTER TABLE "pci_modelos_preenchimento" ADD CONSTRAINT "pci_modelos_preenchimento_anteriorId_fkey"
      FOREIGN KEY ("anteriorId") REFERENCES "pci_modelos_preenchimento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
-- Nome único (sem diferença de maiúsculas) entre os modelos em uso: só a versão atual (não substituída) e não
-- excluída. O servidor confere antes de gravar; o índice fecha a corrida de dois salvamentos ao mesmo tempo.
CREATE UNIQUE INDEX IF NOT EXISTS "pci_modelos_preenchimento_nome_atual_uidx" ON "pci_modelos_preenchimento" (lower("nome"))
  WHERE "excluidoEm" IS NULL AND NOT "substituido";

ALTER TABLE "pci_modelos_preenchimento" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "pci_modelos_preenchimento" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "pci_modelos_preenchimento" FROM authenticated;
  END IF;
END $$;
