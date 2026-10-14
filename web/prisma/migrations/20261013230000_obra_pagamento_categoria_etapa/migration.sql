-- Pedido de 13/10/2026 (paridade com a Prospecta 0050): pagamentos da obra ganham
-- as categorias "Mão de obra" e "Material" (as antigas continuam) e a etapa da
-- obra (mesma lista da Medição por serviço). Aditiva: nada existente muda.
ALTER TABLE "obra_movimentos" DROP CONSTRAINT IF EXISTS "obra_movimentos_categoria_check";
ALTER TABLE "obra_movimentos" ADD CONSTRAINT "obra_movimentos_categoria_check" CHECK ("categoria" IS NULL OR "categoria" IN ('terreno', 'comissao', 'empreiteiro', 'fornecedor', 'outros', 'nao_detalhado', 'mao_de_obra', 'material'));
ALTER TABLE "obra_movimentos" ADD COLUMN IF NOT EXISTS "etapa" TEXT;
ALTER TABLE "obra_movimentos" DROP CONSTRAINT IF EXISTS "obra_movimentos_etapa_check";
ALTER TABLE "obra_movimentos" ADD CONSTRAINT "obra_movimentos_etapa_check" CHECK ("etapa" IS NULL OR ("natureza" = 'pagamento' AND "etapa" IN ('preliminares', 'infraestrutura', 'supraestrutura', 'paredes', 'esquadrias', 'vidros', 'coberturas', 'impermeabilizacoes', 'revestimentos_internos', 'forros', 'revestimentos_externos', 'pintura', 'pisos', 'acabamentos', 'eletricas', 'hidraulicas', 'esgoto', 'loucas_metais', 'complementos', 'outros')));
