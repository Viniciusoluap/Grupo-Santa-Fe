-- EPIC-008 (correção pós-merge): a comissão passa a guardar o ID real do
-- negócio vinculado (imóvel/financiamento/obra). Antes só o rótulo era salvo e,
-- com rótulos repetidos, a edição recalculava sobre o valor de OUTRO registro.
-- Aditiva e nula: comissões existentes continuam válidas (sem ID = busca por
-- rótulo apenas quando ele é inequívoco).

-- AlterTable
ALTER TABLE "comissoes" ADD COLUMN "negocioId" TEXT;
