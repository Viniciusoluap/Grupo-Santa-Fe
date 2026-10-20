-- Staging temporário autenticado da PCI; partes de 1 MiB, expiração em 30 minutos.
CREATE TABLE IF NOT EXISTS pci_upload_chunks (
  upload_id varchar(64) NOT NULL,
  chunk_index integer NOT NULL CHECK (chunk_index >= 0 AND chunk_index < 8),
  total_chunks integer NOT NULL CHECK (total_chunks >= 1 AND total_chunks <= 8),
  user_id text NOT NULL,
  project_id text NOT NULL,
  file_name varchar(255) NOT NULL,
  data bytea NOT NULL CHECK (octet_length(data) > 0 AND octet_length(data) <= 1048576),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (upload_id, chunk_index)
);
CREATE INDEX IF NOT EXISTS pci_upload_chunks_expiry_idx ON pci_upload_chunks(created_at);
CREATE INDEX IF NOT EXISTS pci_upload_chunks_owner_idx ON pci_upload_chunks(user_id, project_id);
