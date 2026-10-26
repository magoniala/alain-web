-- ============================================================
-- Embudos: configuración de rutas de alta (2026-10-26)
-- Fase 2 de /admin → Embudos.
-- Ejecutar a mano en el SQL editor de Supabase, ANTES de desplegar la fase 3.
-- ============================================================
--
-- Qué secuencia recibe cada alta deja de estar escrito en el código: lo
-- dice esta configuración, que leen las altas (lib/embudos.ts) y que se
-- podrá cambiar desde el panel. Los datos de abajo reproducen EXACTAMENTE
-- el comportamiento de hoy: ejecutar esto no cambia ningún envío.
--
-- Un cambio de secuencia en un embudo solo afecta a las altas nuevas. Quien
-- ya está en una secuencia sigue en ella.

-- ---------- Secuencias ----------
--
-- motor:
--   nurture → la lleva el cron de /api/newsletter/cron, con su estado en
--             newsletter_contactos (secuencia_activa / posicion_secuencia).
--   legacy  → la lleva /api/sequence/cron con su propia tabla
--             (mision_contactos, comodin_contactos). No toca
--             secuencia_activa: quien entra sigue en la newsletter a la vez.
--   unico   → un solo mail en el momento del alta, sin programación.
CREATE TABLE IF NOT EXISTS secuencias (
  slug   text PRIMARY KEY,
  nombre text NOT NULL,
  motor  text NOT NULL CHECK (motor IN ('nurture', 'legacy', 'unico')),
  -- Descripción legible de cuándo sale cada mail; la programación real sigue
  -- en el código hasta la fase 4.
  programacion text,
  idiomas      text[] NOT NULL DEFAULT '{es}',
  al_terminar  text CHECK (al_terminar IN ('newsletter')),
  -- Solo nurture: ventana de 8 días, recordatorio de la posición 8 y transición.
  logica_hoja_ruta boolean NOT NULL DEFAULT false,
  activa boolean NOT NULL DEFAULT true,
  notas  text
);

INSERT INTO secuencias (slug, nombre, motor, programacion, idiomas, al_terminar, logica_hoja_ruta, notas) VALUES
  ('nurture',      'Espalda / Hoja de Ruta', 'nurture', 'M0 al momento; M1–M8 uno al día a las 14:30', '{es}',    'newsletter', true,  NULL),
  ('mision',       'Tu misión (tumisión)',   'legacy',  'Mail 1 al momento; mail 2 a las 48 h',        '{es,eu}', NULL,         false, 'El mail 3 está retirado (enlazaba a Eguzkilore).'),
  ('comodin',      'Comodín',                'legacy',  'Mail 1 al momento; mails 2 y 3 a las 48 y 96 h', '{es,eu}', NULL,      false, 'Embudo aparcado: pendiente de rediseño.'),
  ('comodin_show', 'Comodín · show',         'unico',   'Un mail con el enlace al show',                '{es}',    NULL,         false, NULL)
ON CONFLICT (slug) DO NOTHING;

-- ---------- Embudos ----------
--
-- secuencia: a cuál va un alta NUEVA; null = solo la newsletter diaria.
-- idioma_modo: landing = el de la página desde la que se apunta; es/eu = fijo.
-- consentimiento_secuencia: si el formulario cubre recibir una secuencia
-- comercial. El panel avisará antes de asignar una secuencia a un embudo sin él.
CREATE TABLE IF NOT EXISTS embudos (
  slug      text PRIMARY KEY,
  nombre    text NOT NULL,
  landings  text[] NOT NULL DEFAULT '{}',
  secuencia text REFERENCES secuencias (slug),
  idioma_modo text NOT NULL DEFAULT 'landing' CHECK (idioma_modo IN ('landing', 'es', 'eu')),
  consentimiento_secuencia boolean NOT NULL DEFAULT false,
  activo boolean NOT NULL DEFAULT true,
  notas  text,
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

INSERT INTO embudos (slug, nombre, landings, secuencia, idioma_modo, consentimiento_secuencia, notas) VALUES
  ('tumision',        'Tarjeta Magia Zaparrada (tumisión)', '{/tumision,/es/tumision}',       'mision',  'landing', true,  NULL),
  ('comodin',         'Tarjeta comodín',                    '{/comodin,/es/comodin}',         'comodin', 'landing', true,  'Aparcado.'),
  ('mirariak2026',    'MIRARIAK 2026',                      '{/mirariak2026}',                NULL,      'landing', false, NULL),
  ('arrogante',       'Arrogante',                          '{/arrogante}',                   NULL,      'es',      false, NULL),
  ('guias',           'Guías de espalda',                   '{entrenatzaile.alainzulaika.com/guias}', 'nurture', 'es', true, NULL),
  ('meta_ads',        'Leads de Meta Ads',                  '{}',                             'nurture', 'es',      true,  'Entran por /api/leads/entrada (Make).'),
  ('landing_espalda', 'Landing espalda',                    '{entrenatzaile.alainzulaika.com/espalda}', 'nurture', 'es', true, NULL),
  ('hoja_ruta',       'Hoja de Ruta',                       '{entrenatzaile.alainzulaika.com/hoja-de-ruta}', NULL, 'es', false, 'Reservan: solo la diaria.'),
  ('alivio',          'Alivio',                             '{entrenatzaile.alainzulaika.com/alivio}', NULL, 'es', false, 'Incluye las altas de Whop.'),
  ('valoracion',      'Valoración Entrenatzaile',           '{entrenatzaile.alainzulaika.com/valoracion}', NULL, 'landing', false, 'Ya reservaron: solo la diaria.'),
  ('manual',          'Alta manual desde /admin',           '{}',                             NULL,      'landing', false, 'La casilla del panel puede asignar la secuencia de espalda a mano.'),
  ('importado',       'Importados',                         '{}',                             NULL,      'landing', false, 'Importación histórica.')
ON CONFLICT (slug) DO NOTHING;

-- ---------- Origen → embudo ----------
--
-- Un embudo puede tener varios orígenes (guías los ha tenido con varios
-- nombres). Un origen que no esté aquí se trata como «solo la diaria» y sale
-- como alerta en el panel: nunca entra en una secuencia por omisión.
CREATE TABLE IF NOT EXISTS embudo_origenes (
  origen text PRIMARY KEY,
  embudo text NOT NULL REFERENCES embudos (slug)
);

INSERT INTO embudo_origenes (origen, embudo) VALUES
  ('tumision', 'tumision'),
  ('comodin', 'comodin'),
  ('mirariak2026', 'mirariak2026'),
  ('arrogante', 'arrogante'),
  ('guias', 'guias'),
  ('guias, meta_ads', 'guias'),
  ('entrenamiento', 'guias'),
  ('entrenamientos', 'guias'),
  ('Entrenamiento', 'guias'),
  ('ENTRENAMIENTO', 'guias'),
  ('meta_ads', 'meta_ads'),
  ('landing_espalda', 'landing_espalda'),
  ('landing_hoja_ruta', 'hoja_ruta'),
  ('alivio', 'alivio'),
  ('whop-alivio', 'alivio'),
  ('entrenatzaile_valoracion', 'valoracion'),
  ('manual', 'manual'),
  ('importado', 'importado')
ON CONFLICT (origen) DO NOTHING;

-- ---------- newsletter_contactos ----------
--
-- secuencia_activa: la secuencia (motor nurture) en la que está la persona;
--   null = ninguna. Sustituirá a recibe_secuencia en la fase 4; hasta
--   entonces se escriben las dos y el cron sigue leyendo recibe_secuencia.
-- secuencia_asignada_por: embudo (la decidió la configuración) o manual.
-- embudo: por dónde entró.
ALTER TABLE newsletter_contactos ADD COLUMN IF NOT EXISTS secuencia_activa text REFERENCES secuencias (slug);
ALTER TABLE newsletter_contactos ADD COLUMN IF NOT EXISTS secuencia_asignada_por text CHECK (secuencia_asignada_por IN ('embudo', 'manual'));
ALTER TABLE newsletter_contactos ADD COLUMN IF NOT EXISTS embudo text REFERENCES embudos (slug);

-- Relleno con lo que hay hoy. Quien terminó nurture conserva
-- secuencia_activa = 'nurture' con secuencia_completada = true: así se sabe
-- qué secuencia recibió.
UPDATE newsletter_contactos n
SET embudo = o.embudo
FROM embudo_origenes o
WHERE n.origen = o.origen AND n.embudo IS NULL;

UPDATE newsletter_contactos
SET secuencia_activa = 'nurture', secuencia_asignada_por = 'embudo'
WHERE recibe_secuencia = true AND secuencia_activa IS NULL;

CREATE INDEX IF NOT EXISTS newsletter_contactos_secuencia_activa_idx ON newsletter_contactos (secuencia_activa) WHERE secuencia_activa IS NOT NULL;
CREATE INDEX IF NOT EXISTS newsletter_contactos_embudo_idx ON newsletter_contactos (embudo);

-- Sin políticas: solo la service key.
ALTER TABLE secuencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE embudos ENABLE ROW LEVEL SECURITY;
ALTER TABLE embudo_origenes ENABLE ROW LEVEL SECURITY;
