-- ============================================================
-- Envíos a grupos de contactos (2026-11-27)
-- /admin → Newsletter → Grupos. Ejecutar a mano en el SQL editor de Supabase.
-- ============================================================
--
-- No es la newsletter: es un mail suelto a un grupo concreto (familias con
-- taller en Mirariak, apuntados a la plataforma de magia…). Los grupos se
-- definen en lib/grupos-envio.ts; aquí solo se guarda qué se escribió, a
-- quién salió y quién no quiere más correos así.

-- 1) Cada mail (borrador o enviado). `clave` es el nombre corto que pone
--    Alain («videos-mirariak»): con ella se sabe a quién le llegó ya.
CREATE TABLE IF NOT EXISTS grupos_mails (
  clave        text PRIMARY KEY,
  grupo        text NOT NULL,
  subject_es   text, preheader_es text, body_es text,
  subject_eu   text, preheader_eu text, body_eu text,
  creado       timestamptz NOT NULL DEFAULT now(),
  actualizado  timestamptz NOT NULL DEFAULT now()
);

-- 2) Una fila por persona y mail. UNIQUE (clave, email) es lo que impide
--    mandar dos veces el mismo mail a la misma persona, aunque se pulse el
--    botón dos veces o la persona esté en dos reservas.
--    pendiente = empezado y sin resultado (no se reintenta solo) ·
--    aceptado = Mailjet lo aceptó · error = no salió; se reintenta al volver a enviar.
CREATE TABLE IF NOT EXISTS grupos_envios (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  clave      text NOT NULL,
  grupo      text NOT NULL,
  email      text NOT NULL,
  nombre     text,
  idioma     text NOT NULL CHECK (idioma IN ('es','eu')),
  asunto     text,
  estado     text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aceptado','error')),
  error      text,
  creado     timestamptz NOT NULL DEFAULT now(),
  enviado_en timestamptz,
  UNIQUE (clave, email)
);
CREATE INDEX IF NOT EXISTS grupos_envios_email_idx ON grupos_envios (email);

-- 3) Quien ha pulsado «No quiero recibir más correos como este». Queda fuera
--    de TODOS los grupos. No toca la newsletter (newsletter_contactos).
CREATE TABLE IF NOT EXISTS grupos_bajas (
  email  text PRIMARY KEY,
  clave  text,            -- desde qué mail se dio de baja
  creado timestamptz NOT NULL DEFAULT now()
);

-- Sin políticas: solo la service key (los endpoints) lee y escribe.
ALTER TABLE grupos_mails  ENABLE ROW LEVEL SECURITY;
ALTER TABLE grupos_envios ENABLE ROW LEVEL SECURITY;
ALTER TABLE grupos_bajas  ENABLE ROW LEVEL SECURITY;
