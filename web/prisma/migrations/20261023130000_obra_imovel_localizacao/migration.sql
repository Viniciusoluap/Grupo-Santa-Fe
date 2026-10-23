-- Lote 23/10, etapa 3: "Localização exata" da obra vira um imóvel vinculado (aditiva).
-- AlterTable
ALTER TABLE "obras" ADD COLUMN     "imovelId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "obras_imovelId_key" ON "obras"("imovelId");

-- AddForeignKey
ALTER TABLE "obras" ADD CONSTRAINT "obras_imovelId_fkey" FOREIGN KEY ("imovelId") REFERENCES "imoveis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

