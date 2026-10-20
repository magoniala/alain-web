-- ============================================================
-- Admin · Valoración inicial online (2026-10-20)
-- Pestaña /admin → Valoración
-- Ejecutar a mano en el SQL editor de Supabase.
-- ============================================================
--
-- Una fila por persona valorada. Todos los apuntes van en `datos` (una
-- clave por campo), que se sobrescribe en cada guardado automático.
-- cliente, fecha y pareja_id se copian de `datos` para poder listar sin
-- leer el jsonb entero. Contiene datos de salud (art. 9 RGPD).

CREATE TABLE IF NOT EXISTS valoraciones (
  id uuid PRIMARY KEY,
  cliente   text,
  fecha     date,
  pareja_id uuid,
  datos     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS valoraciones_updated_idx ON valoraciones (updated_at DESC);

-- Copia completa como mucho cada 2 minutos mientras se escribe. Para
-- recuperar algo que se borró sin querer:
--   SELECT guardado_en, datos FROM valoraciones_historial
--   WHERE valoracion_id = '<id>' ORDER BY guardado_en DESC;
CREATE TABLE IF NOT EXISTS valoraciones_historial (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  valoracion_id uuid NOT NULL,
  datos jsonb NOT NULL,
  guardado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS valoraciones_historial_idx ON valoraciones_historial (valoracion_id, guardado_en DESC);

-- Sin políticas: solo la service key (los endpoints de /admin) lee y escribe.
ALTER TABLE valoraciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE valoraciones_historial ENABLE ROW LEVEL SECURITY;
