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

-- A classificação não pode esconder um inventário existente, e vendas antigas
-- no JSON não podem reaparecer depois da implantação do registro transacional.
CREATE OR REPLACE FUNCTION protect_estudo_unidade_origin() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."tipoIncorporacao" IS DISTINCT FROM OLD."tipoIncorporacao"
     AND EXISTS (SELECT 1 FROM estudo_unidades WHERE "estudoId" = OLD.id) THEN
    RAISE EXCEPTION 'INVENTARIO_TIPO_BLOQUEADO';
  END IF;
  IF NEW."tipoIncorporacao" = 'desmembramento_simples'
     AND NEW."lancamentoImobiliarioJson" IS DISTINCT FROM OLD."lancamentoImobiliarioJson" THEN
    RAISE EXCEPTION 'INVENTARIO_VENDAS_JSON_BLOQUEADAS';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_estudo_unidade_origin_trg BEFORE UPDATE ON estudos_incorporacao
FOR EACH ROW EXECUTE FUNCTION protect_estudo_unidade_origin();
