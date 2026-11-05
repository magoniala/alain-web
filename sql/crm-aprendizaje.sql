-- ============================================================
-- Sistema automático · carril MAGIA · aprendizaje semanal (2026-11-05)
-- Ejecutar a mano en el SQL editor de Supabase, DESPUÉS de crm-magia.sql.
-- Idempotente. Mismo patrón que charlas-fase2b.sql.
-- ============================================================

-- Propuestas de regla que saca el aprendizaje semanal a partir de las
-- correcciones de Alain en la bandeja de magia (crm_correcciones). Él aprueba
-- o descarta desde el panel; lo aprobado se añade a
-- crm_conocimiento (carril, 'reglas_aprendidas').
CREATE TABLE IF NOT EXISTS crm_reglas_propuestas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carril text NOT NULL DEFAULT 'magia',
  creado_en timestamptz NOT NULL DEFAULT now(),
  regla text NOT NULL,                     -- la regla tal cual iría al conocimiento
  tipos text[] NOT NULL DEFAULT '{}',      -- a qué tipos de mensaje afecta
  evidencia text,                          -- en qué correcciones se apoya (resumen)
  n_correcciones int NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aprobada','descartada')),
  resuelto_en timestamptz,
  texto_final text                         -- lo que Alain aprobó (puede editar la regla antes)
);
CREATE INDEX IF NOT EXISTS crm_reglas_propuestas_idx ON crm_reglas_propuestas (carril, estado, creado_en DESC);

-- Qué correcciones ya han alimentado una regla aprobada (como en charlas).
ALTER TABLE crm_correcciones ADD COLUMN IF NOT EXISTS aplicada_en timestamptz;
CREATE INDEX IF NOT EXISTS crm_correcciones_fecha_idx ON crm_correcciones (carril, creado_en);

-- Config (tabla común, prefijo magia_).
INSERT INTO charlas_config (clave, valor) VALUES
  ('magia_aprendizaje_ultima', 'null'),     -- marca de la última pasada (no repetir en la misma semana)
  ('magia_aprendizaje_dia', '0'),           -- 0 = domingo
  ('magia_aprendizaje_hora', '"20:00"'),
  ('magia_racha_para_automatico', '15')     -- envíos seguidos sin corrección para proponer nivel A
ON CONFLICT (clave) DO NOTHING;

ALTER TABLE crm_reglas_propuestas ENABLE ROW LEVEL SECURITY;
