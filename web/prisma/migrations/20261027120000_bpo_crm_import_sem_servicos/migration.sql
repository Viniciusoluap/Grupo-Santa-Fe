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

WITH repetidos AS (
  SELECT "id", "leadId", first_value("id") OVER (PARTITION BY "leadId" ORDER BY "criadoEm", "id") AS canonico
  FROM "bpo_clientes" WHERE "leadId" IS NOT NULL
), duplicados AS (SELECT * FROM repetidos WHERE "id" <> canonico)
INSERT INTO "bpo_cliente_migracao_backup" ("id", "tipo", "clienteReferencia", "dadosJson")
SELECT 'duplicata-' || b."id", 'cliente_crm_duplicado', b."id",
       jsonb_build_object('clienteDuplicado', to_jsonb(b), 'clienteCanonicoId', d.canonico)::text
FROM duplicados d JOIN "bpo_clientes" b ON b."id" = d."id"
ON CONFLICT ("id") DO NOTHING;

WITH repetidos AS (
  SELECT "id", "leadId", first_value("id") OVER (PARTITION BY "leadId" ORDER BY "criadoEm", "id") AS canonico
  FROM "bpo_clientes" WHERE "leadId" IS NOT NULL
), duplicados AS (SELECT * FROM repetidos WHERE "id" <> canonico)
UPDATE "bpo_lancamentos" l SET "clienteId" = d.canonico FROM duplicados d WHERE l."clienteId" = d."id";
WITH repetidos AS (
  SELECT "id", "leadId", first_value("id") OVER (PARTITION BY "leadId" ORDER BY "criadoEm", "id") AS canonico
  FROM "bpo_clientes" WHERE "leadId" IS NOT NULL
), duplicados AS (SELECT * FROM repetidos WHERE "id" <> canonico)
UPDATE "transacoes_bancarias" t SET "bpoClienteId" = d.canonico FROM duplicados d WHERE t."bpoClienteId" = d."id";
WITH repetidos AS (
  SELECT "id", "leadId", first_value("id") OVER (PARTITION BY "leadId" ORDER BY "criadoEm", "id") AS canonico
  FROM "bpo_clientes" WHERE "leadId" IS NOT NULL
), duplicados AS (SELECT * FROM repetidos WHERE "id" <> canonico)
UPDATE "bpo_regras_titular" r SET "bpoClienteId" = d.canonico FROM duplicados d WHERE r."bpoClienteId" = d."id";
WITH repetidos AS (
  SELECT "id", "leadId", first_value("id") OVER (PARTITION BY "leadId" ORDER BY "criadoEm", "id") AS canonico
  FROM "bpo_clientes" WHERE "leadId" IS NOT NULL
), duplicados AS (SELECT "id" FROM repetidos WHERE "id" <> canonico)
DELETE FROM "bpo_clientes" b USING duplicados d WHERE b."id" = d."id";

CREATE UNIQUE INDEX IF NOT EXISTS "bpo_clientes_leadId_key" ON "bpo_clientes"("leadId");
-- Campo legado mantido fisicamente para recuperação; não aparece na UI nem no modelo Prisma.
-- A remoção do formulário não exige apagar informação histórica.
ALTER TABLE "bpo_cliente_migracao_backup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bpo_cliente_migracao_backup" FORCE ROW LEVEL SECURITY;
