-- Cadastro formal é informado por responsável; não inferir de geometria ou IA.
ALTER TABLE "estudos_incorporacao"
  ADD COLUMN "matriculaImovel" TEXT,
  ADD COLUMN "carRegistro" TEXT,
  ADD COLUMN "zoneamentoOficial" TEXT,
  ADD COLUMN "zoneamentoFonte" TEXT;
