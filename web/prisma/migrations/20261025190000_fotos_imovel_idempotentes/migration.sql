ALTER TABLE "imovel_fotos" ADD COLUMN "sha256" VARCHAR(64);
CREATE UNIQUE INDEX "imovel_fotos_imovelId_sha256_key" ON "imovel_fotos"("imovelId", "sha256");
