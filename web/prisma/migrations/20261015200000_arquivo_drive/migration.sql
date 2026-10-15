-- Contratos do Jurídico/Portal passam a ir para o Google Drive (pasta do cliente).
-- Só acrescenta: nenhum dado existente é alterado.
ALTER TABLE "arquivos" ADD COLUMN "driveFileId" TEXT;
ALTER TABLE "arquivos" ALTER COLUMN "dados" DROP NOT NULL;
CREATE UNIQUE INDEX "arquivos_driveFileId_key" ON "arquivos"("driveFileId");
