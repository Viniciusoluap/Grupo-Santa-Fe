-- AlterTable
ALTER TABLE "corretores" ADD COLUMN "usuarioId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "corretores_usuarioId_key" ON "corretores"("usuarioId");

-- AddForeignKey
ALTER TABLE "corretores" ADD CONSTRAINT "corretores_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
