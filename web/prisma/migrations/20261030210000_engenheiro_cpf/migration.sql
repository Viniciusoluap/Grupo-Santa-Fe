-- CPF opcional do perfil profissional; não copia nem altera dados existentes.
ALTER TABLE "perfis_engenheiro" ADD COLUMN IF NOT EXISTS "cpf" VARCHAR(14);
