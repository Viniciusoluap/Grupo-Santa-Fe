-- Pedido de 25/10 (paridade Prospecta 0071): Conversas do WhatsApp — mensagens recebidas pelo
-- webhook da Evolution ficam na mesma tabela. Aditiva.
ALTER TABLE "mensagens_whatsapp" ADD COLUMN IF NOT EXISTS "direcao" TEXT NOT NULL DEFAULT 'saida';
ALTER TABLE "mensagens_whatsapp" ADD COLUMN IF NOT EXISTS "lida" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS "mensagens_whatsapp_conexaoId_destinatario_enviadaEm_idx" ON "mensagens_whatsapp"("conexaoId", "destinatario", "enviadaEm");
CREATE INDEX IF NOT EXISTS "mensagens_whatsapp_externalId_idx" ON "mensagens_whatsapp"("externalId");
