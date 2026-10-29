-- Pedido de 29/10 (revisão do PR #239; gêmeo da tabela drive_trash_queue da Prospecta):
-- arquivo/pasta que deveria ter ido para a lixeira do Drive e falhou fica nesta fila
-- durável; o "Organizar Drive" tenta de novo. Migração aditiva: só uma tabela nova.
CREATE TABLE IF NOT EXISTS "drive_lixeira_pendente" (
  "id" SERIAL PRIMARY KEY,
  "tipo" VARCHAR(10) NOT NULL CHECK ("tipo" IN ('arquivo', 'pasta')),
  "alvo" TEXT NOT NULL,
  "tentativas" INTEGER NOT NULL DEFAULT 0,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "drive_lixeira_pendente_tipo_alvo_key" UNIQUE ("tipo", "alvo")
);
ALTER TABLE "drive_lixeira_pendente" ENABLE ROW LEVEL SECURITY;
-- Rollback operacional: reverter o código; a tabela pode ficar.
