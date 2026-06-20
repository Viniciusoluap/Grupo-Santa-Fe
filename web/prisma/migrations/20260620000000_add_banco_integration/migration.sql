-- CreateTable
CREATE TABLE "contas_bancarias" (
    "id" TEXT NOT NULL,
    "banco" TEXT NOT NULL,
    "agencia" TEXT,
    "conta" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'corrente',
    "descricao" TEXT,
    "saldoAtual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "pluggyItemId" TEXT,
    "pluggyAccountId" TEXT,
    "ultimaSincronizacao" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contas_bancarias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transacoes_bancarias" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "tipo" TEXT NOT NULL,
    "categoria" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "externalId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transacoes_bancarias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transacoes_bancarias_externalId_key" ON "transacoes_bancarias"("externalId");

-- AddForeignKey
ALTER TABLE "transacoes_bancarias" ADD CONSTRAINT "transacoes_bancarias_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "contas_bancarias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
