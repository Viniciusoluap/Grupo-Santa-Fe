-- Campos para o módulo de prospecção com IA
-- Execute manualmente no Supabase SQL Editor

ALTER TABLE "imoveis" ADD COLUMN IF NOT EXISTS "rascunho" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "imoveis" ADD COLUMN IF NOT EXISTS "contatoOrigem" TEXT;
ALTER TABLE "imoveis" ADD COLUMN IF NOT EXISTS "origemUrl" TEXT;
