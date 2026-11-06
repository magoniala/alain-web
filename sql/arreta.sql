-- ============================================================
-- /arreta · encuesta anónima de alumnos (2026-11-06)
-- Ejecutar a mano en el SQL editor de Supabase. Idempotente.
-- ============================================================
-- Anonimato estricto: ni IP, ni user-agent, ni cookies, ni identificador.
-- Lo único con fecha es created_at.
CREATE TABLE IF NOT EXISTS arreta_respuestas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  probatu text NOT NULL CHECK (probatu IN ('bai', 'oraindik-ez', 'ez')),
  ikasi text CHECK (char_length(ikasi) <= 1000),
  gustatu text CHECK (char_length(gustatu) <= 1000),
  gehitu text CHECK (char_length(gehitu) <= 1000),
  saioa text CHECK (char_length(saioa) <= 60)   -- p. ej. 'hernani-2026-11'
);

-- RLS activada y SIN políticas: anon/authenticated no pueden leer ni escribir.
-- Solo entra la service key, que usan el endpoint /api/arreta (insertar) y el
-- panel /admin (leer).
ALTER TABLE arreta_respuestas ENABLE ROW LEVEL SECURITY;
