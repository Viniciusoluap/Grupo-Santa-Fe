-- CreateTable: estudos_incorporacao (módulo Incorporação — Fase 1)
CREATE TABLE "estudos_incorporacao" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "municipio" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PA',
    "responsavel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'rascunho',
    "imovelId" TEXT,
    "kmlUrl" TEXT,
    "geojson" TEXT,
    "areaM2" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "perimetroM" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "centroLat" DOUBLE PRECISION,
    "centroLng" DOUBLE PRECISION,
    "elevacaoJson" TEXT,
    "levantamentoUrl" TEXT,
    "corteAterroJson" TEXT,
    "parametrosJson" TEXT,
    "potencialJson" TEXT,
    "urbanismoParecer" TEXT,
    "pesquisaCidadeJson" TEXT,
    "estudoMercadoJson" TEXT,
    "massaCenariosJson" TEXT,
    "cenarioEscolhidoId" TEXT,
    "mixJson" TEXT,
    "viabilidadeJson" TEXT,
    "cronogramaJson" TEXT,
    "parecerIa" TEXT,
    "relatorios" TEXT NOT NULL DEFAULT '[]',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estudos_incorporacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "estudos_incorporacao_status_idx" ON "estudos_incorporacao"("status");

-- AddForeignKey
ALTER TABLE "estudos_incorporacao" ADD CONSTRAINT "estudos_incorporacao_imovelId_fkey" FOREIGN KEY ("imovelId") REFERENCES "imoveis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Segurança: habilita RLS (deny-all para API; Prisma conecta como owner)
ALTER TABLE "estudos_incorporacao" ENABLE ROW LEVEL SECURITY;
