-- ============================================================
-- Sistema automático · FASE 7b: app del cliente de ENTRENATZAILE · 2026-11-02
-- Ejecutar a mano en el SQL editor de Supabase, DESPUÉS de entrenatzaile-app.sql. Idempotente.
--
-- Suscripciones push por cliente (la app instalada en su móvil) y el registro
-- de envíos. El envío de avisos lo activa `ent_avisos_envio` = true.
-- ============================================================

CREATE TABLE IF NOT EXISTS ent_push (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES ent_clientes(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  claves jsonb NOT NULL,                  -- {p256dh, auth}
  dispositivo text,
  creado_en timestamptz NOT NULL DEFAULT now(),
  ultimo_envio timestamptz,
  fallos int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ent_push_cliente_idx ON ent_push (cliente_id);
ALTER TABLE ent_push ENABLE ROW LEVEL SECURITY;

-- Cada cliente entra con un enlace personal: /app/<token>. Se genera al vuelo si falta.
UPDATE ent_clientes SET token = encode(gen_random_bytes(18), 'hex') WHERE token IS NULL;

-- Fotos del cliente (solo las ve Alain): bucket privado.
INSERT INTO storage.buckets (id, name, public) VALUES ('ent-fotos', 'ent-fotos', false) ON CONFLICT (id) DO NOTHING;

ALTER TABLE ent_series ADD COLUMN IF NOT EXISTS completada boolean NOT NULL DEFAULT true;
ALTER TABLE ent_formularios ADD COLUMN IF NOT EXISTS fotos text[] NOT NULL DEFAULT '{}';
ALTER TABLE ent_avisos ADD COLUMN IF NOT EXISTS leido_en timestamptz;
