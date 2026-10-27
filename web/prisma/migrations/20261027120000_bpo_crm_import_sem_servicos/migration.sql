-- CRM -> BPO idempotente e remoção do campo legado "Serviços Contratados".
-- Os dados antigos são arquivados antes de retirar a coluna e qualquer duplicata.
CREATE TABLE IF NOT EXISTS "bpo_cliente_migracao_backup" (
  "id" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "clienteReferencia" TEXT NOT NULL,
  "dadosJson" TEXT NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bpo_cliente_migracao_backup_pkey" PRIMARY KEY ("id")
);

INSERT INTO "bpo_cliente_migracao_backup" ("id", "tipo", "clienteReferencia", "dadosJson")
SELECT 'servicos-' || "id", 'servicos_legados', "id",
       jsonb_build_object('clienteId', "id", 'leadId', "leadId", 'servicos', "servicos")::text
FROM "bpo_clientes" WHERE COALESCE("servicos", '[]') <> '[]'
ON CONFLICT ("id") DO NOTHING;

-- Nenhum cliente ou vínculo financeiro é removido ou reescrito nesta migração.
-- Havendo duplicatas, o índice falha e exige conciliação administrativa prévia.
CREATE UNIQUE INDEX IF NOT EXISTS "bpo_clientes_leadId_key" ON "bpo_clientes"("leadId");
-- Coluna servicos legada preservada; retirada apenas da UI e do modelo Prisma.
ALTER TABLE "bpo_cliente_migracao_backup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bpo_cliente_migracao_backup" FORCE ROW LEVEL SECURITY;
