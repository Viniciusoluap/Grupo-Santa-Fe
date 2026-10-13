-- 10 implementações, item 05: conta de cliente vinculada ao cliente real (lead
-- do CRM) por ID, não mais por coincidência de e-mail. Migração aditiva.
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "leadId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "usuarios_leadId_key" ON "usuarios"("leadId");
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- Contas de cliente existentes: vincula só quando exatamente um lead ativo tem o
-- mesmo e-mail e ainda não está ligado a outra conta (ambíguos ficam para o admin).
UPDATE "usuarios" u SET "leadId" = l."id"
FROM "leads" l
WHERE u."papel" = 'cliente' AND u."leadId" IS NULL
  AND lower(l."email") = lower(u."email") AND l."excluidoEm" IS NULL
  AND (SELECT count(*) FROM "leads" l2 WHERE lower(l2."email") = lower(u."email") AND l2."excluidoEm" IS NULL) = 1
  AND NOT EXISTS (SELECT 1 FROM "usuarios" u2 WHERE u2."leadId" = l."id");
