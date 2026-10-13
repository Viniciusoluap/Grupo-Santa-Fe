-- 10 implementações, item 09: quando o Google Drive recusa a gravação, o
-- documento do registro da incorporação fica no próprio banco (`arquivos`),
-- servido só pela rota autenticada. Nenhum dado existente muda.
ALTER TABLE "estudo_documentos_registro" ALTER COLUMN "driveFileId" DROP NOT NULL;
ALTER TABLE "estudo_documentos_registro" ADD COLUMN IF NOT EXISTS "armazenamento" VARCHAR(10) NOT NULL DEFAULT 'drive';
ALTER TABLE "estudo_documentos_registro" ADD COLUMN IF NOT EXISTS "notaArmazenamento" VARCHAR(400);
ALTER TABLE "estudo_documentos_registro" ADD COLUMN IF NOT EXISTS "arquivoId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "estudo_documentos_registro_arquivoId_key" ON "estudo_documentos_registro"("arquivoId");
ALTER TABLE "estudo_documentos_registro" ADD CONSTRAINT "estudo_documentos_registro_arquivoId_fkey" FOREIGN KEY ("arquivoId") REFERENCES "arquivos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "estudo_documentos_registro" ADD CONSTRAINT "estudo_documentos_registro_armazenamento_check" CHECK (("armazenamento" = 'drive' AND "driveFileId" IS NOT NULL) OR ("armazenamento" = 'banco' AND "arquivoId" IS NOT NULL));
