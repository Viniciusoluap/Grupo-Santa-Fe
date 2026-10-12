-- Recuperação limitada à limpeza de módulos, não desfaz dados novos do CRM.
-- Execute somente após revisão/aprovação do plano de recuperação.
BEGIN;
SET LOCAL lock_timeout = '10s';
ALTER TABLE "arquivo_modulos_removidos"."agregador_imoveis" SET SCHEMA "public";
ALTER TABLE "arquivo_modulos_removidos"."lancamentos" SET SCHEMA "public";
COMMIT;
