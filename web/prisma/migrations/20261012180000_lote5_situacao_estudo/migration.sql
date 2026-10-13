-- EPIC-020 Lote 5, item 01. Sem reclassificar registros antigos ambíguos.
-- O inventário de produção antes desta mudança encontrou apenas em_estudo.
ALTER TABLE "estudos_incorporacao"
  ALTER COLUMN "status" SET DEFAULT 'em_estudo';
