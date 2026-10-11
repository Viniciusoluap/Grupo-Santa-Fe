-- Grupo Santa Fé somente. Revisar/aprovar antes de produção.
-- Migração transacional: nenhuma tabela, lead ou operação é apagada.
BEGIN;
SET LOCAL lock_timeout = '10s';

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "arquivadoEm" TIMESTAMP(3),
ADD COLUMN     "creationRequestKey" TEXT,
ADD COLUMN     "etapaOperacional" TEXT,
ADD COLUMN     "excluidoEm" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "financiamentos" ADD COLUMN     "servicoLeadId" TEXT,
ALTER COLUMN "imovel" DROP NOT NULL,
ALTER COLUMN "banco" DROP NOT NULL,
ALTER COLUMN "valorImovel" DROP NOT NULL,
ALTER COLUMN "valorFinanciado" DROP NOT NULL,
ALTER COLUMN "entrada" DROP NOT NULL,
ALTER COLUMN "taxa" DROP NOT NULL,
ALTER COLUMN "prazo" DROP NOT NULL;

-- AlterTable
ALTER TABLE "obras" ADD COLUMN     "servicoLeadId" TEXT,
ALTER COLUMN "tipo" DROP NOT NULL,
ALTER COLUMN "endereco" DROP NOT NULL,
ALTER COLUMN "area" DROP NOT NULL,
ALTER COLUMN "valorTotal" DROP NOT NULL,
ALTER COLUMN "engenheiroResp" DROP NOT NULL;

-- AlterTable
ALTER TABLE "projetos" ADD COLUMN     "servicoLeadId" TEXT,
ALTER COLUMN "tipo" DROP NOT NULL,
ALTER COLUMN "engenheiro" DROP NOT NULL,
ALTER COLUMN "valorProjeto" DROP NOT NULL;

-- AlterTable
ALTER TABLE "regularizacoes" ADD COLUMN     "servicoLeadId" TEXT,
ALTER COLUMN "tipo" DROP NOT NULL,
ALTER COLUMN "endereco" DROP NOT NULL,
ALTER COLUMN "responsavel" DROP NOT NULL,
ALTER COLUMN "valorServico" DROP NOT NULL;

-- AlterTable
ALTER TABLE "avaliacoes" ADD COLUMN     "servicoLeadId" TEXT;

-- Retenção deliberada e reversível: recursos exclusivos saem do esquema
-- operacional, mas os históricos permanecem íntegros e privados.
CREATE SCHEMA IF NOT EXISTS "arquivo_modulos_removidos";
REVOKE ALL ON SCHEMA "arquivo_modulos_removidos" FROM PUBLIC;
ALTER TABLE "public"."agregador_imoveis" SET SCHEMA "arquivo_modulos_removidos";
ALTER TABLE "public"."lancamentos" SET SCHEMA "arquivo_modulos_removidos";

-- CreateTable
CREATE TABLE "servicos_lead" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "servico" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "servicos_lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "servicos_lead_requestKey_key" ON "servicos_lead"("requestKey");

-- CreateIndex
CREATE INDEX "servicos_lead_leadId_modulo_idx" ON "servicos_lead"("leadId", "modulo");

-- CreateIndex
CREATE UNIQUE INDEX "servicos_lead_id_leadId_key" ON "servicos_lead"("id", "leadId");

-- CreateIndex
CREATE UNIQUE INDEX "leads_creationRequestKey_key" ON "leads"("creationRequestKey");

-- CreateIndex
CREATE UNIQUE INDEX "financiamentos_servicoLeadId_key" ON "financiamentos"("servicoLeadId");

-- CreateIndex
CREATE UNIQUE INDEX "financiamentos_servicoLeadId_leadId_key" ON "financiamentos"("servicoLeadId", "leadId");

-- CreateIndex
CREATE UNIQUE INDEX "obras_servicoLeadId_key" ON "obras"("servicoLeadId");

-- CreateIndex
CREATE UNIQUE INDEX "obras_servicoLeadId_leadId_key" ON "obras"("servicoLeadId", "leadId");

-- CreateIndex
CREATE UNIQUE INDEX "projetos_servicoLeadId_key" ON "projetos"("servicoLeadId");

-- CreateIndex
CREATE UNIQUE INDEX "projetos_servicoLeadId_leadId_key" ON "projetos"("servicoLeadId", "leadId");

-- CreateIndex
CREATE UNIQUE INDEX "regularizacoes_servicoLeadId_key" ON "regularizacoes"("servicoLeadId");

-- CreateIndex
CREATE UNIQUE INDEX "regularizacoes_servicoLeadId_leadId_key" ON "regularizacoes"("servicoLeadId", "leadId");

-- CreateIndex
CREATE UNIQUE INDEX "avaliacoes_servicoLeadId_key" ON "avaliacoes"("servicoLeadId");

-- CreateIndex
CREATE UNIQUE INDEX "avaliacoes_servicoLeadId_leadId_key" ON "avaliacoes"("servicoLeadId", "leadId");

-- AddForeignKey
ALTER TABLE "servicos_lead" ADD CONSTRAINT "servicos_lead_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financiamentos" ADD CONSTRAINT "financiamentos_servicoLeadId_leadId_fkey" FOREIGN KEY ("servicoLeadId", "leadId") REFERENCES "servicos_lead"("id", "leadId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obras" ADD CONSTRAINT "obras_servicoLeadId_leadId_fkey" FOREIGN KEY ("servicoLeadId", "leadId") REFERENCES "servicos_lead"("id", "leadId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projetos" ADD CONSTRAINT "projetos_servicoLeadId_leadId_fkey" FOREIGN KEY ("servicoLeadId", "leadId") REFERENCES "servicos_lead"("id", "leadId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regularizacoes" ADD CONSTRAINT "regularizacoes_servicoLeadId_leadId_fkey" FOREIGN KEY ("servicoLeadId", "leadId") REFERENCES "servicos_lead"("id", "leadId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_servicoLeadId_leadId_fkey" FOREIGN KEY ("servicoLeadId", "leadId") REFERENCES "servicos_lead"("id", "leadId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Etapas seguras somente. Status histórico nunca é substituído.
UPDATE "leads" SET "etapaOperacional" = CASE "status"
  WHEN 'novo' THEN 'novo_lead' WHEN 'contato' THEN 'em_atendimento' END
WHERE "etapaOperacional" IS NULL AND "status" IN ('novo', 'contato');
UPDATE "leads" SET "arquivadoEm" = "atualizadoEm"
WHERE "status" IN ('arquivado', 'arquivada') AND "arquivadoEm" IS NULL;
UPDATE "leads" SET "excluidoEm" = "atualizadoEm"
WHERE "status" IN ('excluido', 'excluida') AND "excluidoEm" IS NULL;
ALTER TABLE "leads" ADD CONSTRAINT "leads_etapa_operacional_valida"
CHECK ("etapaOperacional" IS NULL OR "etapaOperacional" IN
 ('novo_lead','em_atendimento','aprovado_follow_up','projetos_vistorias','contratos_cartorio','medicoes','finalizado'));
CREATE INDEX "leads_pipeline_ativo_idx" ON "leads" ("etapaOperacional", "responsavelId")
WHERE "arquivadoEm" IS NULL AND "excluidoEm" IS NULL;

-- Reconciliação determinística apenas de FKs preexistentes, jamais por nome.
INSERT INTO "servicos_lead" ("id","leadId","modulo","servico","requestKey")
SELECT 'legado:financiamento:'||f.id,f."leadId",'financiamento',
 CASE WHEN lower(f.tipo)='mcmv' THEN 'Financiamento MCMV'
 WHEN lower(f.tipo) IN ('sbpe','convencional') THEN 'Financiamento Convencional'
 ELSE 'Financiamento ('||f.tipo||')' END, 'legado:financiamento:'||f.id
FROM "financiamentos" f JOIN "leads" l ON l.id=f."leadId";
INSERT INTO "servicos_lead" ("id","leadId","modulo","servico","requestKey")
SELECT 'legado:obra:'||o.id,o."leadId",'obra','Obra e reforma','legado:obra:'||o.id
FROM "obras" o JOIN "leads" l ON l.id=o."leadId";
INSERT INTO "servicos_lead" ("id","leadId","modulo","servico","requestKey")
SELECT 'legado:projeto:'||p.id,p."leadId",'projeto','Projeto de engenharia','legado:projeto:'||p.id
FROM "projetos" p JOIN "leads" l ON l.id=p."leadId";
INSERT INTO "servicos_lead" ("id","leadId","modulo","servico","requestKey")
SELECT 'legado:regularizacao:'||r.id,r."leadId",'regularizacao','Regularização imobiliária','legado:regularizacao:'||r.id
FROM "regularizacoes" r JOIN "leads" l ON l.id=r."leadId";
INSERT INTO "servicos_lead" ("id","leadId","modulo","servico","requestKey")
SELECT 'legado:avaliacao:'||a.id,a."leadId",'avaliacao','Avaliação de imóvel','legado:avaliacao:'||a.id
FROM "avaliacoes" a JOIN "leads" l ON l.id=a."leadId";
UPDATE "financiamentos" SET "servicoLeadId"='legado:financiamento:'||id WHERE "leadId" IS NOT NULL;
UPDATE "obras" SET "servicoLeadId"='legado:obra:'||id WHERE "leadId" IS NOT NULL;
UPDATE "projetos" SET "servicoLeadId"='legado:projeto:'||id WHERE "leadId" IS NOT NULL;
UPDATE "regularizacoes" SET "servicoLeadId"='legado:regularizacao:'||id WHERE "leadId" IS NOT NULL;
UPDATE "avaliacoes" SET "servicoLeadId"='legado:avaliacao:'||id WHERE "leadId" IS NOT NULL;

-- Proteção de origem também no banco. Não interfere nas operações legadas
-- desvinculadas ao atualizar seus dados; novas operações exigem demanda CRM.
CREATE SCHEMA IF NOT EXISTS "crm_interno";
REVOKE ALL ON SCHEMA "crm_interno" FROM PUBLIC;
CREATE FUNCTION "crm_interno"."validar_origem_servico"() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE esperado text;
BEGIN
  esperado := CASE TG_TABLE_NAME WHEN 'financiamentos' THEN 'financiamento'
    WHEN 'obras' THEN 'obra' WHEN 'projetos' THEN 'projeto'
    WHEN 'regularizacoes' THEN 'regularizacao' WHEN 'avaliacoes' THEN 'avaliacao' END;
  IF NEW."servicoLeadId" IS NOT NULL THEN
    IF NEW."leadId" IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.servicos_lead s
      WHERE s.id=NEW."servicoLeadId" AND s."leadId"=NEW."leadId" AND s.modulo=esperado
    ) THEN RAISE EXCEPTION 'Vínculo CRM incompatível com o serviço'; END IF;
  ELSIF TG_OP='INSERT' AND TG_TABLE_NAME <> 'avaliacoes' THEN
    RAISE EXCEPTION 'Crie operações exclusivamente pelo CRM';
  ELSIF TG_OP='UPDATE' AND OLD."servicoLeadId" IS NOT NULL THEN
    RAISE EXCEPTION 'Não remova a identidade CRM de uma operação vinculada';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION "crm_interno"."validar_origem_servico"() FROM PUBLIC;
CREATE TRIGGER "financiamentos_origem_crm" BEFORE INSERT OR UPDATE OF "leadId","servicoLeadId" ON "financiamentos"
FOR EACH ROW EXECUTE FUNCTION "crm_interno"."validar_origem_servico"();
CREATE TRIGGER "obras_origem_crm" BEFORE INSERT OR UPDATE OF "leadId","servicoLeadId" ON "obras"
FOR EACH ROW EXECUTE FUNCTION "crm_interno"."validar_origem_servico"();
CREATE TRIGGER "projetos_origem_crm" BEFORE INSERT OR UPDATE OF "leadId","servicoLeadId" ON "projetos"
FOR EACH ROW EXECUTE FUNCTION "crm_interno"."validar_origem_servico"();
CREATE TRIGGER "regularizacoes_origem_crm" BEFORE INSERT OR UPDATE OF "leadId","servicoLeadId" ON "regularizacoes"
FOR EACH ROW EXECUTE FUNCTION "crm_interno"."validar_origem_servico"();
CREATE TRIGGER "avaliacoes_vinculo_crm" BEFORE INSERT OR UPDATE OF "leadId","servicoLeadId" ON "avaliacoes"
FOR EACH ROW EXECUTE FUNCTION "crm_interno"."validar_origem_servico"();
ALTER TABLE "servicos_lead" ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE papel text; BEGIN
  FOREACH papel IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=papel) THEN
      EXECUTE format('REVOKE ALL ON TABLE public.servicos_lead FROM %I',papel);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA arquivo_modulos_removidos FROM %I',papel);
    END IF;
  END LOOP;
END $$;
COMMIT;
