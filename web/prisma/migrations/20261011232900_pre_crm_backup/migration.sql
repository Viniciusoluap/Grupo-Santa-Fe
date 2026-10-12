-- Cópia dos dados tocados pela migração seguinte, restrita ao projeto Grupo Santa Fé.
-- Não execute novamente depois de 20261011233000_crm_central_limpeza.
BEGIN;
SET LOCAL lock_timeout = '10s';
CREATE SCHEMA "aiox_backup_20261012";
REVOKE ALL ON SCHEMA "aiox_backup_20261012" FROM PUBLIC;

CREATE TABLE "aiox_backup_20261012"."leads" AS TABLE "public"."leads" WITH DATA;
CREATE TABLE "aiox_backup_20261012"."obras" AS TABLE "public"."obras" WITH DATA;
CREATE TABLE "aiox_backup_20261012"."financiamentos" AS TABLE "public"."financiamentos" WITH DATA;
CREATE TABLE "aiox_backup_20261012"."projetos" AS TABLE "public"."projetos" WITH DATA;
CREATE TABLE "aiox_backup_20261012"."regularizacoes" AS TABLE "public"."regularizacoes" WITH DATA;
CREATE TABLE "aiox_backup_20261012"."avaliacoes" AS TABLE "public"."avaliacoes" WITH DATA;
CREATE TABLE "aiox_backup_20261012"."agregador_imoveis" AS TABLE "public"."agregador_imoveis" WITH DATA;
CREATE TABLE "aiox_backup_20261012"."lancamentos" AS TABLE "public"."lancamentos" WITH DATA;

DO $$ DECLARE papel text; BEGIN
  FOREACH papel IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=papel) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA aiox_backup_20261012 FROM %I',papel);
    END IF;
  END LOOP;
END $$;
COMMIT;
