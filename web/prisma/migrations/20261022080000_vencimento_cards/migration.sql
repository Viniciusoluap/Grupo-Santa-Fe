ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "vencimentoCard" DATE;
CREATE INDEX IF NOT EXISTS "leads_vencimentoCard_idx" ON "leads" ("vencimentoCard");
CREATE TABLE IF NOT EXISTS "avisos_vencimento_card" (
  "usuarioId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "vencimento" DATE NOT NULL,
  "canal" TEXT NOT NULL,
  "enviadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "avisos_vencimento_card_pkey" PRIMARY KEY ("usuarioId", "leadId", "vencimento", "canal")
);
CREATE TABLE IF NOT EXISTS "resumos_vencimento_card" (
  "usuarioId" TEXT NOT NULL,
  "dia" DATE NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "resumos_vencimento_card_pkey" PRIMARY KEY ("usuarioId", "dia")
);
CREATE TABLE IF NOT EXISTS "tarefas_crm" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "leadId" TEXT NOT NULL REFERENCES "leads"("id") ON DELETE RESTRICT,
  "servicoLeadId" TEXT UNIQUE REFERENCES "servicos_lead"("id") ON DELETE SET NULL,
  "titulo" TEXT NOT NULL,
  "descricao" TEXT NOT NULL DEFAULT '',
  "responsavelId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pendente',
  "prazo" TIMESTAMP(3),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "tarefas_crm_leadId_prazo_idx" ON "tarefas_crm" ("leadId", "prazo");
ALTER TABLE "avisos_vencimento_card" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "resumos_vencimento_card" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tarefas_crm" ENABLE ROW LEVEL SECURITY;
