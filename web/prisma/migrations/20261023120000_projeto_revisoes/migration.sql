-- Lote 23/10, etapa 2C: pedidos de revisão de projeto (aditiva).
-- CreateTable
CREATE TABLE "projeto_revisoes" (
    "id" TEXT NOT NULL,
    "projetoId" TEXT NOT NULL,
    "solicitadoPorId" TEXT,
    "solicitadoPorNome" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "colaboradorId" TEXT,
    "situacaoNotificacao" TEXT NOT NULL,
    "situacaoEmail" TEXT NOT NULL,
    "entregas" TEXT NOT NULL DEFAULT '[]',
    "entregueEm" TIMESTAMP(3),
    "entreguePorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projeto_revisoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "projeto_revisoes_projetoId_criadoEm_idx" ON "projeto_revisoes"("projetoId", "criadoEm" DESC);

-- AddForeignKey
ALTER TABLE "projeto_revisoes" ADD CONSTRAINT "projeto_revisoes_projetoId_fkey" FOREIGN KEY ("projetoId") REFERENCES "projetos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projeto_revisoes" ADD CONSTRAINT "projeto_revisoes_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projeto_revisoes" ADD CONSTRAINT "projeto_revisoes_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projeto_revisoes" ADD CONSTRAINT "projeto_revisoes_entreguePorId_fkey" FOREIGN KEY ("entreguePorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Mesmo padrão das demais tabelas: acesso só pelo servidor (Prisma).
ALTER TABLE "projeto_revisoes" ENABLE ROW LEVEL SECURITY;
