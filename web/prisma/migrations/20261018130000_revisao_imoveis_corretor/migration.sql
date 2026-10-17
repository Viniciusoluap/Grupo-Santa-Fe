-- Pedido de 18/10 (itens 3 e 8): revisão dos imóveis cadastrados pelo corretor,
-- igual à Prospecta. Só acrescenta colunas/tabela (não destrutiva). Os imóveis
-- existentes continuam aprovados; os que já estão vinculados a um corretor passam
-- a contar como cadastro dele (é o mesmo vínculo que hoje libera editar/excluir).
ALTER TABLE "imoveis" ADD COLUMN IF NOT EXISTS "revisaoStatus" TEXT NOT NULL DEFAULT 'aprovado';
ALTER TABLE "imoveis" ADD COLUMN IF NOT EXISTS "revisadoEm" TIMESTAMP(3);
ALTER TABLE "imoveis" ADD COLUMN IF NOT EXISTS "cadastradoPorId" TEXT;

DO $$ BEGIN
  ALTER TABLE "imoveis" ADD CONSTRAINT "imoveis_cadastradoPorId_fkey"
    FOREIGN KEY ("cadastradoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "imoveis_cadastradoPorId_idx" ON "imoveis"("cadastradoPorId");

UPDATE "imoveis" i SET "cadastradoPorId" = c."usuarioId"
FROM "corretores" c
WHERE i."corretorId" = c."id" AND c."usuarioId" IS NOT NULL AND i."cadastradoPorId" IS NULL;

CREATE TABLE IF NOT EXISTS "imovel_recusado_avisos" (
  "id" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "titulo" TEXT NOT NULL,
  "recusadoEm" TIMESTAMP(3) NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "imovel_recusado_avisos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "imovel_recusado_avisos_usuarioId_idx" ON "imovel_recusado_avisos"("usuarioId");
DO $$ BEGIN
  ALTER TABLE "imovel_recusado_avisos" ADD CONSTRAINT "imovel_recusado_avisos_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
