-- 11/11/2026 (paridade com a Prospecta): larguras de faixa (servidão/domínio) confirmadas pelo dono
-- no mapa do terreno. Só acrescenta uma coluna opcional; nada existente é alterado ou apagado.
ALTER TABLE "estudos_incorporacao" ADD COLUMN IF NOT EXISTS "largurasFaixaJson" TEXT;
