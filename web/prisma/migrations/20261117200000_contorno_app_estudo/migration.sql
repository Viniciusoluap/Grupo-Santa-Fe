-- 17/11/2026 — Paridade com a Prospecta (bloco 2, EPIC-023 S-I / migração 0117 de lá): APP com o contorno real no
-- Estudo de Massa. Guarda no estudo o contorno da APP que o mapa do Terreno calcula (MultiPolygon GeoJSON em
-- longitude/latitude, já recortado pelo terreno), para o motor tirar a APP da área loteável pela posição real.
-- Somente aditiva e idempotente: uma coluna nova, nula (IF NOT EXISTS); nada existente é alterado ou apagado.
-- Reversão: ALTER TABLE "estudos_incorporacao" DROP COLUMN "appContornoJson" (nenhuma outra coluna depende dela).
ALTER TABLE "estudos_incorporacao" ADD COLUMN IF NOT EXISTS "appContornoJson" TEXT;
