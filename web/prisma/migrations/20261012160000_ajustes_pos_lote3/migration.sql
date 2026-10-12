-- EPIC-020 — ajustes decididos pelo proprietário em 12/10/2026 (HANDOFF §7).
-- D-02: comissão manual sugere 5% (editável) em vez de 6%.
ALTER TABLE "comissoes" ALTER COLUMN "percentual" SET DEFAULT 5;

-- P-01: o "Valor Total" antigo das obras era o VGV. Copia para o VGV quando
-- ainda vazio (idempotente). `valorTotal` permanece preservado como legado.
UPDATE "obras" SET "vgv" = "valorTotal"::numeric(15,2)
WHERE "vgv" IS NULL AND "valorTotal" IS NOT NULL AND "valorTotal" > 0;
