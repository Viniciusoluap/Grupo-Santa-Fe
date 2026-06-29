-- AlterTable: Add new columns to contratos
ALTER TABLE "contratos" ADD COLUMN "leadId" TEXT;
ALTER TABLE "contratos" ADD COLUMN "assinaturaStatus" TEXT NOT NULL DEFAULT 'pendente';
ALTER TABLE "contratos" ADD COLUMN "assinaturaGovId" TEXT;

-- AddForeignKey: contratos -> leads
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: contrato_documentos
CREATE TABLE "contrato_documentos" (
    "id" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contrato_documentos_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: contrato_documentos -> contratos
ALTER TABLE "contrato_documentos" ADD CONSTRAINT "contrato_documentos_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: chat_mensagens
CREATE TABLE "chat_mensagens" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "remetente" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "lido" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_mensagens_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: chat_mensagens -> leads
ALTER TABLE "chat_mensagens" ADD CONSTRAINT "chat_mensagens_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
