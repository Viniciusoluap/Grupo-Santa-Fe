-- Quadro de Áreas (NBR 12721) e Orçamento Parametrizado — etapas 2.3/3.3 e 2.4
-- da metodologia Carolina Caribé (Onda 2 do roadmap de Novos Negócios).
ALTER TABLE "public"."estudos_incorporacao"
  ADD COLUMN IF NOT EXISTS "quadroAreasJson" TEXT,
  ADD COLUMN IF NOT EXISTS "orcamentoParametrizadoJson" TEXT;
