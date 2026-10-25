-- Pedido de 25/10 (paridade com Prospecta drizzle/0069_bancos_provedores.sql): contas bancárias
-- por provedor (Asaas, Pluggy/Meu Pluggy, manual/importação), chave da API por conta
-- (criptografada), data inicial (movimentações anteriores não pertencem a esta empresa), último
-- erro, origem de cada transação e credenciais da Pluggy no banco. Aditiva.
ALTER TABLE "contas_bancarias" ADD COLUMN IF NOT EXISTS "provedor" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "contas_bancarias" ADD COLUMN IF NOT EXISTS "credencialEncrypted" TEXT;
ALTER TABLE "contas_bancarias" ADD COLUMN IF NOT EXISTS "dataInicial" DATE;
ALTER TABLE "contas_bancarias" ADD COLUMN IF NOT EXISTS "ultimoErro" TEXT;
ALTER TABLE "transacoes_bancarias" ADD COLUMN IF NOT EXISTS "origem" TEXT NOT NULL DEFAULT 'manual';
UPDATE "contas_bancarias" SET "provedor" = 'pluggy' WHERE "pluggyAccountId" IS NOT NULL AND "provedor" = 'manual';

CREATE TABLE IF NOT EXISTS "pluggy_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "client_id_encrypted" TEXT NOT NULL,
    "client_secret_encrypted" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pluggy_settings_pkey" PRIMARY KEY ("id")
);
