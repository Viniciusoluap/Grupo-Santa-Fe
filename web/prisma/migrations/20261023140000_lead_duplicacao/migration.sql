-- Lote 23/10, etapa 6: "Duplicar lead" registra a origem (aditiva).
-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "duplicadoDeId" TEXT,
ADD COLUMN     "duplicadoEm" TIMESTAMP(3),
ADD COLUMN     "duplicadoPorId" TEXT;

-- AlterTable
ALTER TABLE "documentos_cliente" ADD COLUMN     "copiadoDeId" TEXT;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_duplicadoDeId_fkey" FOREIGN KEY ("duplicadoDeId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_duplicadoPorId_fkey" FOREIGN KEY ("duplicadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

