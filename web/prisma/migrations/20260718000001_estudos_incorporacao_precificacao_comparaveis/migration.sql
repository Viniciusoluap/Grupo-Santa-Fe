-- Precificação por comparáveis ponderados (2.2 Inteligência de Mercado) —
-- separado do estudoMercadoJson da IA para não ser sobrescrito ao refazer a pesquisa.
ALTER TABLE "public"."estudos_incorporacao"
  ADD COLUMN IF NOT EXISTS "precificacaoComparaveisJson" TEXT;
