-- 17/11/2026 — Paridade com a Prospecta (bloco 2, EPIC-023 S-E / migração 0116 de lá): camadas do mapa do terreno
-- resilientes. Guarda o último resultado bom ("ok" ou "vazio") de cada camada por terreno, com a data, para o mapa
-- mostrar quando a fonte pública estiver fora do ar.
-- Somente aditiva e idempotente: cria uma tabela nova (IF NOT EXISTS); nada existente é alterado ou apagado.
-- Reversão: DROP TABLE "camadas_terreno_cache" (nenhuma outra tabela depende dela).
CREATE TABLE IF NOT EXISTS "camadas_terreno_cache" (
  -- chaveDoTerreno(contorno): bbox arredondado + nº de vértices
  "chaveTerreno" VARCHAR(160) NOT NULL,
  "camada" VARCHAR(30) NOT NULL,
  "estado" VARCHAR(20) NOT NULL CHECK ("estado" IN ('ok', 'vazio')),
  "fonte" TEXT NOT NULL,
  -- EstadoCamada completo em JSON
  "dados" TEXT NOT NULL,
  "salvoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "camadas_terreno_cache_pkey" PRIMARY KEY ("chaveTerreno", "camada")
);

-- Supabase: a tabela só é lida/gravada pelo servidor (Prisma, papel do dono); a API pública fica sem acesso.
ALTER TABLE "camadas_terreno_cache" ENABLE ROW LEVEL SECURITY;
