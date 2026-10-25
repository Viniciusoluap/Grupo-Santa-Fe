ALTER TABLE "imovel_fotos" ADD COLUMN IF NOT EXISTS "sha256" VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS "imovel_fotos_imovelId_sha256_key" ON "imovel_fotos"("imovelId", "sha256");
