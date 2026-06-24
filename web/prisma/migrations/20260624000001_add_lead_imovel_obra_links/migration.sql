-- AlterTable financiamentos: vincular lead e imóvel existente
ALTER TABLE "financiamentos" ADD COLUMN "leadId" TEXT;
ALTER TABLE "financiamentos" ADD COLUMN "imovelVinculadoId" TEXT;

-- AlterTable obras: vincular lead e localização GPS
ALTER TABLE "obras" ADD COLUMN "leadId" TEXT;
ALTER TABLE "obras" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "obras" ADD COLUMN "longitude" DOUBLE PRECISION;

-- AddForeignKey
ALTER TABLE "financiamentos" ADD CONSTRAINT "financiamentos_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financiamentos" ADD CONSTRAINT "financiamentos_imovelVinculadoId_fkey" FOREIGN KEY ("imovelVinculadoId") REFERENCES "imoveis"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "obras" ADD CONSTRAINT "obras_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable projetos: vincular lead
ALTER TABLE "projetos" ADD COLUMN "leadId" TEXT;
ALTER TABLE "projetos" ADD CONSTRAINT "projetos_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable regularizacoes: vincular lead
ALTER TABLE "regularizacoes" ADD COLUMN "leadId" TEXT;
ALTER TABLE "regularizacoes" ADD CONSTRAINT "regularizacoes_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
