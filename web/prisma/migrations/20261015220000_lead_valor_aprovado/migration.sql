-- Pedido de 15/10: Valor Aprovado do cliente no CRM (paridade com a Prospecta).
-- O VGV das obras do lead passa a vir deste campo.
ALTER TABLE "leads" ADD COLUMN "valorAprovado" DECIMAL(15,2);

-- Leads sem Valor Aprovado recebem o VGV já cadastrado na obra (nenhum cálculo
-- de obra muda). Lead com obras de VGVs diferentes não é tocado (ambíguo).
UPDATE "leads" l
SET "valorAprovado" = o."vgv"
FROM "obras" o
WHERE o."leadId" = l."id"
  AND o."vgv" IS NOT NULL
  AND l."valorAprovado" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "obras" o2
    WHERE o2."leadId" = l."id" AND o2."id" <> o."id" AND o2."vgv" IS DISTINCT FROM o."vgv"
  );
