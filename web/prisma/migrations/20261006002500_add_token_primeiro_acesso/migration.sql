-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN "tokenPrimeiroAcesso" TEXT;
ALTER TABLE "usuarios" ADD COLUMN "tokenPrimeiroAcessoExpira" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_tokenPrimeiroAcesso_key" ON "usuarios"("tokenPrimeiroAcesso");
