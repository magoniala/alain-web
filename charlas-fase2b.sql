-- ============================================================
-- Sistema automático · carril charlas · FASE 2b: aprendizaje y métricas (2026-10-30)
-- Ejecutar a mano en el SQL editor de Supabase, DESPUÉS de charlas-fase2.sql.
-- Idempotente.
-- ============================================================

-- Propuestas de regla que saca el aprendizaje semanal a partir de las
-- correcciones de Alain. Él aprueba o descarta desde el panel; lo aprobado
-- se añade a charlas_conocimiento.reglas_aprendidas.
CREATE TABLE IF NOT EXISTS charlas_reglas_propuestas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creado_en timestamptz NOT NULL DEFAULT now(),
  regla text NOT NULL,                     -- la regla tal cual iría al conocimiento
  tipos text[] NOT NULL DEFAULT '{}',      -- a qué tipos de mensaje afecta
  evidencia text,                          -- en qué correcciones se apoya (resumen)
  n_correcciones int NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aprobada','descartada')),
  resuelto_en timestamptz,
  texto_final text                         -- lo que Alain aprobó (puede editar la regla antes)
);

-- Marca de la última pasada de aprendizaje, para no repetirla en la misma semana.
INSERT INTO charlas_config (clave, valor) VALUES
  ('aprendizaje_ultima', 'null'),
  ('aprendizaje_dia', '0'),                 -- 0 = domingo
  ('aprendizaje_hora', '"20:00"')
ON CONFLICT (clave) DO NOTHING;

-- Métricas: vista del embudo por estado y territorio (lo que ve la pestaña Métricas).
CREATE OR REPLACE VIEW charlas_v_embudo AS
SELECT territorio, tipo, euskera, estado, count(*) AS n
FROM charlas_centros
GROUP BY territorio, tipo, euskera, estado;

ALTER TABLE charlas_reglas_propuestas ENABLE ROW LEVEL SECURITY;
