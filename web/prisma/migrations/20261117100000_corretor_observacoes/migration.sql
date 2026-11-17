-- Paridade 17/11, bloco 1 — EPIC-023 S-A da Prospecta: o cadastro de corretor passou para "Usuários e acesso"
-- com comissão padrão e observações (na Prospecta, `broker_profiles.notes`). Aqui o corretor ainda não tinha
-- observações. Só aditiva e idempotente: coluna nova com padrão vazio; nenhum dado existente é alterado.
ALTER TABLE "corretores" ADD COLUMN IF NOT EXISTS "observacoes" TEXT NOT NULL DEFAULT '';
