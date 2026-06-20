CREATE TABLE "conexoes_whatsapp" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "provedor" TEXT NOT NULL DEFAULT 'evolution',
    "instancia" TEXT,
    "token" TEXT,
    "phoneNumberId" TEXT,
    "numero" TEXT,
    "status" TEXT NOT NULL DEFAULT 'desconectado',
    "qrCode" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "conexoes_whatsapp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "conexoes_whatsapp_usuarioId_key" ON "conexoes_whatsapp"("usuarioId");

ALTER TABLE "conexoes_whatsapp" ADD CONSTRAINT "conexoes_whatsapp_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "mensagens_whatsapp" (
    "id" TEXT NOT NULL,
    "conexaoId" TEXT NOT NULL,
    "leadId" TEXT,
    "destinatario" TEXT NOT NULL,
    "nomeDestinatario" TEXT,
    "mensagem" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'enviada',
    "externalId" TEXT,
    "erroMsg" TEXT,
    "enviadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "mensagens_whatsapp_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "mensagens_whatsapp" ADD CONSTRAINT "mensagens_whatsapp_conexaoId_fkey"
    FOREIGN KEY ("conexaoId") REFERENCES "conexoes_whatsapp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
