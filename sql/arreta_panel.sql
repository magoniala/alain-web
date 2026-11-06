-- ============================================================
-- /arreta · panel de estadísticas (2026-11-06)
-- Ejecutar a mano en el SQL editor de Supabase, DESPUÉS de arreta.sql.
-- Idempotente. Todo con RLS activada y SIN políticas: solo la service key
-- (endpoints /api/arreta y /api/admin/arreta*) lee y escribe.
-- ============================================================

-- Charlas: cada una es un «paquete» de respuestas. Una respuesta es de una
-- charla si su `saioa` coincide con el slug; si no, si su fecha (hora de
-- Madrid) cae entre fecha_inicio y margen_hasta.
CREATE TABLE IF NOT EXISTS arreta_charlas (
  slug text PRIMARY KEY CHECK (slug ~ '^[a-z0-9-]{1,60}$'),
  nombre text NOT NULL CHECK (char_length(nombre) BETWEEN 1 AND 120),
  centro text CHECK (char_length(centro) <= 120),
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  margen_hasta date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (fecha_inicio <= fecha_fin AND fecha_fin <= margen_hasta)
);

INSERT INTO arreta_charlas (slug, nombre, centro, fecha_inicio, fecha_fin, margen_hasta) VALUES
  ('hernani-2026-11', 'Hernani BHI', 'Hernani BHI', '2026-11-09', '2026-11-10', '2026-11-17')
ON CONFLICT (slug) DO NOTHING;

-- Destacadas (testimonios para el dossier).
ALTER TABLE arreta_respuestas ADD COLUMN IF NOT EXISTS destacada boolean NOT NULL DEFAULT false;

-- Post-its en papel, apuntados a mano por charla y sesión.
CREATE TABLE IF NOT EXISTS arreta_postits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  charla text NOT NULL REFERENCES arreta_charlas (slug) ON UPDATE CASCADE ON DELETE CASCADE,
  sesion text NOT NULL CHECK (char_length(sesion) BETWEEN 1 AND 80),
  alumnos int NOT NULL DEFAULT 0 CHECK (alumnos >= 0),
  n1 int NOT NULL DEFAULT 0 CHECK (n1 >= 0),
  n2 int NOT NULL DEFAULT 0 CHECK (n2 >= 0),
  n3 int NOT NULL DEFAULT 0 CHECK (n3 >= 0),
  n4 int NOT NULL DEFAULT 0 CHECK (n4 >= 0),
  n5 int NOT NULL DEFAULT 0 CHECK (n5 >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS arreta_postits_charla_idx ON arreta_postits (charla, created_at);

ALTER TABLE arreta_charlas ENABLE ROW LEVEL SECURITY;
ALTER TABLE arreta_postits ENABLE ROW LEVEL SECURITY;
