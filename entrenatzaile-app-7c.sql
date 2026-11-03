-- ============================================================
-- Sistema automático · FASE 7c: propuesta de la siguiente sesión con IA · 2026-11-03
-- Ejecutar a mano en el SQL editor de Supabase. Idempotente.
-- Las tablas (ent_propuestas, ent_correcciones) ya existen desde entrenatzaile-app.sql.
-- ============================================================
INSERT INTO charlas_config (clave, valor) VALUES
  ('ent_propuestas_ia', 'false')   -- true: cuando un cliente cierra una sesión, la IA propone la siguiente (tarjeta en la pestaña Entrenatzaile)
ON CONFLICT (clave) DO NOTHING;
ALTER TABLE ent_propuestas ADD COLUMN IF NOT EXISTS motivo text;
