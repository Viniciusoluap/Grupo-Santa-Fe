-- AlterTable: localização exata do empreendimento (Google Maps) no estudo
ALTER TABLE "estudos_incorporacao" ADD COLUMN "endereco" TEXT;
ALTER TABLE "estudos_incorporacao" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "estudos_incorporacao" ADD COLUMN "longitude" DOUBLE PRECISION;

-- CreateTable: armazenamento de arquivos no próprio banco (sem Blob externo)
CREATE TABLE "arquivos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "mime" TEXT NOT NULL DEFAULT 'application/octet-stream',
    "tamanho" INTEGER NOT NULL DEFAULT 0,
    "dados" BYTEA NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arquivos_pkey" PRIMARY KEY ("id")
);

-- Segurança: habilita RLS (deny-all para API; Prisma conecta como owner)
ALTER TABLE "arquivos" ENABLE ROW LEVEL SECURITY;
