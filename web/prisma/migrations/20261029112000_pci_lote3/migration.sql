-- Lote 03, correções 09b e 10: modelo oficial da PCI — exclusão lógica por versão,
-- relatório de compatibilidade e confirmação de mudança crítica, com auditoria.
-- Aditiva e idempotente. O arquivo ("dados") nunca é apagado: as PCIs já geradas
-- continuam vinculadas à versão usada (pci_geradas.modeloId/modeloVersao).
-- Gêmeo de Prospecta/drizzle/0096_pci_lote3.sql.

ALTER TABLE "pci_modelos" ADD COLUMN IF NOT EXISTS "excluidoEm" TIMESTAMP(3);
ALTER TABLE "pci_modelos" ADD COLUMN IF NOT EXISTS "excluidoPorId" TEXT;
ALTER TABLE "pci_modelos" ADD COLUMN IF NOT EXISTS "relatorioCompatibilidade" JSONB;
ALTER TABLE "pci_modelos" ADD COLUMN IF NOT EXISTS "aguardandoConfirmacao" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "pci_modelos" ADD COLUMN IF NOT EXISTS "confirmadoPorId" TEXT;
ALTER TABLE "pci_modelos" ADD COLUMN IF NOT EXISTS "confirmadoEm" TIMESTAMP(3);

DO $$ BEGIN
  ALTER TABLE "pci_modelos" ADD CONSTRAINT "pci_modelos_excluido_nao_atual" CHECK ("excluidoEm" IS NULL OR NOT "atual");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "pci_modelo_auditoria" (
  "id" TEXT NOT NULL,
  "modeloId" TEXT NOT NULL,
  "acao" VARCHAR(30) NOT NULL,
  "usuarioId" TEXT,
  "detalhes" JSONB,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pci_modelo_auditoria_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pci_modelo_auditoria_acao_check" CHECK ("acao" IN ('enviar', 'tornar_atual', 'confirmar_critica', 'excluir'))
);
CREATE INDEX IF NOT EXISTS "pci_modelo_auditoria_modeloId_criadoEm_idx" ON "pci_modelo_auditoria"("modeloId", "criadoEm");
DO $$ BEGIN
  ALTER TABLE "pci_modelo_auditoria" ADD CONSTRAINT "pci_modelo_auditoria_modeloId_fkey" FOREIGN KEY ("modeloId") REFERENCES "pci_modelos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "pci_modelo_auditoria" ENABLE ROW LEVEL SECURITY;
