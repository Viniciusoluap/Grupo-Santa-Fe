-- Pedido de 18/10 (item 15): o cliente envia/substitui no Portal o documento de
-- cada item do checklist do financiamento. Só acrescenta colunas (não destrutiva).
ALTER TABLE "checklist_items" ADD COLUMN IF NOT EXISTS "arquivoId" TEXT;
ALTER TABLE "checklist_items" ADD COLUMN IF NOT EXISTS "enviadoEm" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "checklist_items_arquivoId_key" ON "checklist_items"("arquivoId");
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_arquivoId_fkey" FOREIGN KEY ("arquivoId") REFERENCES "arquivos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
