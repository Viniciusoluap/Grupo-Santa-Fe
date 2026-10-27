-- Lote 2, correções 06, 08 e 11 (AD-03, AD-04). Aditiva e idempotente.
--
-- 06: estudo sem KML (flag + lotes avulsos em JSON).
-- 08: responsável do estudo salvo por ID de usuário (o texto legado "responsavel"
--     continua preenchido com o nome para exibição e estudos antigos).
-- 11: estudos de massa salvos em tabela própria; massaCenariosJson,
--     cenarioEscolhidoId e mixJson seguem como espelho do estudo principal.

ALTER TABLE "estudos_incorporacao" ADD COLUMN IF NOT EXISTS "semKml" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "estudos_incorporacao" ADD COLUMN IF NOT EXISTS "lotesAvulsosJson" TEXT;
ALTER TABLE "estudos_incorporacao" ADD COLUMN IF NOT EXISTS "responsavelId" TEXT;

CREATE TABLE IF NOT EXISTS "estudos_massa_salvos" (
  "id" TEXT NOT NULL,
  "estudoId" TEXT NOT NULL,
  "nome" VARCHAR(120) NOT NULL,
  "versao" INTEGER NOT NULL DEFAULT 1,
  "origemId" TEXT,
  "parametrosJson" TEXT,
  "cenariosJson" TEXT NOT NULL,
  "poligonalReferencia" TEXT,
  "cenarioEscolhidoId" VARCHAR(120),
  "indicadoresJson" TEXT,
  "quadroAreasJson" TEXT,
  "principal" BOOLEAN NOT NULL DEFAULT false,
  "criadoPorId" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  -- exclusão lógica: a linha (e a geometria) é preservada
  "excluidoEm" TIMESTAMP(3),
  "excluidoPorId" TEXT,
  CONSTRAINT "estudos_massa_salvos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "estudos_massa_salvos_versao_check" CHECK ("versao" >= 1)
);

CREATE INDEX IF NOT EXISTS "estudos_massa_salvos_estudoId_idx" ON "estudos_massa_salvos"("estudoId");
-- O principal é trocado numa transação (desmarca os demais e marca o alvo).
-- Nome + versão únicos entre os ativos.
CREATE UNIQUE INDEX IF NOT EXISTS "estudos_massa_salvos_nome_versao_ativos_key"
  ON "estudos_massa_salvos"("estudoId", lower("nome"), "versao") WHERE "excluidoEm" IS NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'estudos_incorporacao_responsavelId_fkey') THEN
    ALTER TABLE "estudos_incorporacao" ADD CONSTRAINT "estudos_incorporacao_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'estudos_massa_salvos_estudoId_fkey') THEN
    ALTER TABLE "estudos_massa_salvos" ADD CONSTRAINT "estudos_massa_salvos_estudoId_fkey" FOREIGN KEY ("estudoId") REFERENCES "estudos_incorporacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'estudos_massa_salvos_origemId_fkey') THEN
    ALTER TABLE "estudos_massa_salvos" ADD CONSTRAINT "estudos_massa_salvos_origemId_fkey" FOREIGN KEY ("origemId") REFERENCES "estudos_massa_salvos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'estudos_massa_salvos_criadoPorId_fkey') THEN
    ALTER TABLE "estudos_massa_salvos" ADD CONSTRAINT "estudos_massa_salvos_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'estudos_massa_salvos_excluidoPorId_fkey') THEN
    ALTER TABLE "estudos_massa_salvos" ADD CONSTRAINT "estudos_massa_salvos_excluidoPorId_fkey" FOREIGN KEY ("excluidoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "estudos_massa_salvos" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "estudos_massa_salvos" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "estudos_massa_salvos" FROM authenticated;
  END IF;
END $$;
