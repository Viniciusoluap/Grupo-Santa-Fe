-- Lote 03 (29/10/2026), correção 02: vínculo manual conversa do WhatsApp ↔ lead.
-- O vínculo escolhido pelo usuário ("Vincular lead") tem prioridade sobre a inferência pelo telefone.
-- "chaveTelefone" = DDD + 8 últimos dígitos (mesma normalização de mesmoTelefone).
-- Aditiva e idempotente. Paridade: Prospecta drizzle/0094_whatsapp_vinculo.sql. Não aplicar em produção sem autorização.
CREATE TABLE IF NOT EXISTS "whatsapp_vinculos_conversa" (
  "id" TEXT NOT NULL,
  "conexaoId" TEXT NOT NULL,
  "chaveTelefone" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "vinculadoPorId" TEXT,
  "vinculadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "whatsapp_vinculos_conversa_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_vinculos_conversa_conexaoId_chaveTelefone_key" ON "whatsapp_vinculos_conversa"("conexaoId", "chaveTelefone");
CREATE INDEX IF NOT EXISTS "whatsapp_vinculos_conversa_leadId_idx" ON "whatsapp_vinculos_conversa"("leadId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_vinculos_conversa_conexaoId_fkey') THEN
    ALTER TABLE "whatsapp_vinculos_conversa" ADD CONSTRAINT "whatsapp_vinculos_conversa_conexaoId_fkey"
      FOREIGN KEY ("conexaoId") REFERENCES "conexoes_whatsapp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_vinculos_conversa_leadId_fkey') THEN
    ALTER TABLE "whatsapp_vinculos_conversa" ADD CONSTRAINT "whatsapp_vinculos_conversa_leadId_fkey"
      FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
-- O acesso é feito exclusivamente pelo servidor Prisma, com autorização de perfil.
ALTER TABLE "whatsapp_vinculos_conversa" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "whatsapp_vinculos_conversa" FROM anon, authenticated;

-- Correção 04: contagem do dashboard por período sem varrer a tabela.
CREATE INDEX IF NOT EXISTS "mensagens_whatsapp_direcao_enviadaEm_idx" ON "mensagens_whatsapp"("direcao", "enviadaEm");
