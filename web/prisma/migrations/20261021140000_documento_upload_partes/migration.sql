CREATE TABLE IF NOT EXISTS documento_upload_partes (
  upload_id varchar(64) NOT NULL, parte integer NOT NULL CHECK (parte >= 0 AND parte < 20),
  total integer NOT NULL CHECK (total >= 1 AND total <= 20), usuario_id text NOT NULL,
  tipo varchar(20) NOT NULL, item_id text NOT NULL, nome varchar(255) NOT NULL,
  dados bytea NOT NULL CHECK (octet_length(dados) > 0 AND octet_length(dados) <= 1048576),
  criado_em timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (upload_id, parte)
);
CREATE INDEX IF NOT EXISTS documento_upload_partes_expira ON documento_upload_partes(criado_em);
ALTER TABLE documento_upload_partes ENABLE ROW LEVEL SECURITY;
