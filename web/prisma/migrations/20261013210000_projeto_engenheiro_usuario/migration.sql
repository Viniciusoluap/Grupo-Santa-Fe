-- 10 implementações, item 07: engenheiro responsável do projeto é um
-- colaborador cadastrado (vínculo por ID). O texto "engenheiro" continua como
-- nome exibido e preserva os registros anteriores. Migração aditiva.
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "engenheiroId" TEXT;
ALTER TABLE "projetos" ADD COLUMN IF NOT EXISTS "engenheiroRegistro" VARCHAR(60);
ALTER TABLE "projetos" ADD CONSTRAINT "projetos_engenheiroId_fkey" FOREIGN KEY ("engenheiroId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "projetos_engenheiroId_idx" ON "projetos"("engenheiroId");
