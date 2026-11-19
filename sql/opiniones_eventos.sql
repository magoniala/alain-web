-- ============================================================
-- Opiniones después de un evento, dos carriles (2026-11-19)
--   1) /quetal (quien contrata): dos tipos de evento nuevos.
--   2) /opinion-mirariak2026 y /opinion/<evento> (familias y espectadores)
--      + el mail único a quienes reservaron.
-- Panel: /admin → Testimonios → «Opiniones familias» y
--        /admin → Magia → Mirariak 2026 → «Pedir opinión a las reservas».
-- Ejecutar a mano en el SQL editor de Supabase. Idempotente: se puede
-- ejecutar más de una vez. No borra ni cambia ningún dato.
-- ============================================================

-- 1) /quetal: se añaden «jornadas» (fin de semana o jornadas de magia) y
--    «recurrente» (show periódico en bar o sociedad) a los tipos admitidos.
ALTER TABLE feedback_links DROP CONSTRAINT IF EXISTS feedback_links_tipo_evento_check;
ALTER TABLE feedback_links ADD CONSTRAINT feedback_links_tipo_evento_check
  CHECK (tipo_evento IN ('familiar','taller','jornadas','fiestas','empresa','feria','externo','hosteleria','recurrente','centro','privado'));

ALTER TABLE feedback_organizadores DROP CONSTRAINT IF EXISTS feedback_organizadores_tipo_evento_check;
ALTER TABLE feedback_organizadores ADD CONSTRAINT feedback_organizadores_tipo_evento_check
  CHECK (tipo_evento IN ('familiar','taller','jornadas','fiestas','empresa','feria','externo','hosteleria','recurrente','centro','privado'));

-- 2) Opiniones de familias. Una fila por persona que empieza el formulario;
--    cada respuesta se guarda en el momento sobre la misma fila.
CREATE TABLE IF NOT EXISTS opiniones_familias (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  creado      timestamptz NOT NULL DEFAULT now(),
  actualizado timestamptz NOT NULL DEFAULT now(),

  -- Secreto que solo tiene el navegador que empezó la respuesta: sin él no
  -- se puede seguir escribiendo en la fila.
  clave text NOT NULL,

  evento text NOT NULL,                                         -- 'mirariak2026'…
  origen text CHECK (origen IN ('gracias','salida','mail','voz')), -- ?e= ; null = sin parámetro
  idioma text NOT NULL CHECK (idioma IN ('es','eu')),

  nota         int NOT NULL CHECK (nota BETWEEN 1 AND 4),       -- 4 = les encantó
  texto_peques text,
  texto_adulto text,
  palabra      text,
  -- Solo lo lee Alain. No se publica nunca.
  mejora_privada text,

  -- null = no llegó a contestar el permiso → no se publica.
  permiso text CHECK (permiso IN ('sin_nombre','con_nombre','no')),
  nombre  text,
  email   text,
  terminado boolean NOT NULL DEFAULT false,

  -- Solo del admin.
  estado         text NOT NULL DEFAULT 'nuevo' CHECK (estado IN ('nuevo','revisado','aprobado','publicado','archivado')),
  destacado      boolean NOT NULL DEFAULT false,
  texto_editado  text,
  notas_internas text
);
CREATE INDEX IF NOT EXISTS opiniones_familias_evento_idx ON opiniones_familias (evento, creado DESC);

-- 3) Mail «¿qué tal lo pasasteis?» a las reservas de un evento: una fila por
--    persona. La clave (evento, email) es lo que impide escribir dos veces a
--    la misma persona, aunque se pulse el botón dos veces.
CREATE TABLE IF NOT EXISTS opinion_envios (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  evento text NOT NULL,
  email  text NOT NULL,
  nombre text,
  idioma text NOT NULL CHECK (idioma IN ('es','eu')),
  -- pendiente = se ha empezado a enviar y no consta el resultado (no se
  -- reintenta solo). aceptado = Mailjet lo aceptó. error = no salió; se
  -- puede reintentar desde el panel.
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aceptado','error')),
  error  text,
  creado     timestamptz NOT NULL DEFAULT now(),
  enviado_en timestamptz,
  UNIQUE (evento, email)
);

-- Sin políticas: solo la service key (los endpoints) lee y escribe.
ALTER TABLE opiniones_familias ENABLE ROW LEVEL SECURITY;
ALTER TABLE opinion_envios ENABLE ROW LEVEL SECURITY;
