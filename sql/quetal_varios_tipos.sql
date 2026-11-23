-- /quetal: el organizador puede marcar varios tipos de evento (23-11-2026).
--
-- tipo_evento sigue siendo el principal (el primero que marca). Aquí se
-- guardan todos. Las respuestas antiguas quedan con null y el panel usa
-- tipo_evento. Mientras no se aplique, /api/quetal guarda sin esta columna.

ALTER TABLE feedback_organizadores ADD COLUMN IF NOT EXISTS tipos_evento text[];

ALTER TABLE feedback_organizadores DROP CONSTRAINT IF EXISTS feedback_organizadores_tipos_evento_check;
ALTER TABLE feedback_organizadores ADD CONSTRAINT feedback_organizadores_tipos_evento_check
  CHECK (tipos_evento IS NULL OR tipos_evento <@ ARRAY['familiar','taller','jornadas','fiestas','empresa','feria','externo','hosteleria','recurrente','centro','privado']::text[]);
