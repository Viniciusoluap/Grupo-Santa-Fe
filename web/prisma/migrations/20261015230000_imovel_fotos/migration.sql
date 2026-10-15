-- Pedido de 15/10: fotos de imóveis no Google Drive (Imóveis/<Título (nº)>/01 - Fotos).
-- "dados" só guarda a foto enquanto o Drive está indisponível.
CREATE TABLE "imovel_fotos" (
    "id" TEXT NOT NULL,
    "imovelId" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "driveFileId" TEXT,
    "dados" BYTEA,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "imovel_fotos_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "imovel_fotos_origem" CHECK ("driveFileId" IS NOT NULL OR "dados" IS NOT NULL)
);
CREATE INDEX "imovel_fotos_imovelId_idx" ON "imovel_fotos"("imovelId");
ALTER TABLE "imovel_fotos" ADD CONSTRAINT "imovel_fotos_imovelId_fkey" FOREIGN KEY ("imovelId") REFERENCES "imoveis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
