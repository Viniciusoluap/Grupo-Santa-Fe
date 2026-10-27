-- Lote 2, correção 07 (AD-07): processo de Incorporação › Projeto Aprovado ↔ módulo Projetos.
-- Aditiva e idempotente. Projeto vindo da Incorporação não tem lead ("leadId" já é opcional).
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "estudoIncorporacaoId" TEXT;
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "processoAprovacaoId" VARCHAR(100);
-- Situação de aprovação externa (órgão); o andamento técnico interno continua em "status".
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "aprovacaoOrgao" VARCHAR(120);
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "aprovacaoProtocolo" VARCHAR(120);
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "aprovacaoStatus" VARCHAR(30);
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "aprovacaoObservacoes" TEXT;

-- Um projeto por (estudo, processo): salvar/editar/reabrir faz upsert, nunca duplica.
CREATE UNIQUE INDEX IF NOT EXISTS "projetos_estudoIncorporacaoId_processoAprovacaoId_key"
  ON "projetos"("estudoIncorporacaoId", "processoAprovacaoId");

DO $$ BEGIN
  ALTER TABLE "projetos" ADD CONSTRAINT "projetos_estudoIncorporacaoId_fkey"
    FOREIGN KEY ("estudoIncorporacaoId") REFERENCES "estudos_incorporacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
