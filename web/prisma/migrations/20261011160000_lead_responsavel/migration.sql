-- EPIC-007 S-08: responsável do lead passa a ser um usuário real do sistema.
-- Aditiva e nula: não afeta registros existentes nem o código anterior.

-- AlterTable
ALTER TABLE "leads" ADD COLUMN "responsavelId" TEXT;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
