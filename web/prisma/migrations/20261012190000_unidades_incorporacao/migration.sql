CREATE TABLE "estudo_unidades" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "estudoId" TEXT NOT NULL REFERENCES "estudos_incorporacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "codigo" VARCHAR(120) NOT NULL,
  "codigoChave" VARCHAR(120) NOT NULL,
  "tipo" VARCHAR(40) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'disponivel' CHECK ("status" IN ('disponivel', 'reservada', 'vendida')),
  "comprador" VARCHAR(255),
  "valorVenda" DECIMAL(15,2),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "estudo_unidades_venda_comprador_chk" CHECK ("status" <> 'vendida' OR ("comprador" IS NOT NULL AND "valorVenda" IS NOT NULL))
);
CREATE UNIQUE INDEX "estudo_unidades_estudoId_codigoChave_key" ON "estudo_unidades"("estudoId", "codigoChave");
CREATE TABLE "estudo_unidades_eventos" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "unidadeId" TEXT NOT NULL REFERENCES "estudo_unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "statusAnterior" VARCHAR(20),
  "statusNovo" VARCHAR(20) NOT NULL,
  "comprador" VARCHAR(255),
  "valorVenda" DECIMAL(15,2),
  "vendaLegadaId" VARCHAR(120),
  "usuarioId" TEXT NOT NULL REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "estudo_unidades_eventos_unidadeId_criadoEm_idx" ON "estudo_unidades_eventos"("unidadeId", "criadoEm");
CREATE UNIQUE INDEX "estudo_unidades_eventos_unidadeId_vendaLegadaId_key" ON "estudo_unidades_eventos"("unidadeId", "vendaLegadaId");
