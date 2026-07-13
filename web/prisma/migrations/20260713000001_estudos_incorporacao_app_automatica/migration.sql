-- Área de APP (preservação permanente) calculada automaticamente pelo mapa
-- (Overpass + Código Florestal / largura manual) — nunca preenchida à mão.
ALTER TABLE "public"."estudos_incorporacao"
  ADD COLUMN IF NOT EXISTS "appAreaM2" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "appLarguraM" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "appOrigem" TEXT;
