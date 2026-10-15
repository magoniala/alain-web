-- ============================================================
-- Entrenatzaile · leads del Instant Form de Meta Ads (2026-10-13)
-- Make -> POST /api/leads/entrada
-- Ejecutar a mano en el SQL editor de Supabase. El fichero entero se puede
-- volver a pasar sin miedo: crea lo que falte y no toca los datos.
-- ============================================================

-- Espejo de espalda_leads: una fila por ENVÍO del formulario, con el texto
-- literal de lo que se mostró. El contacto vive en newsletter_contactos;
-- esto es el recibo de este envío concreto. Una persona puede tener varias
-- filas aquí y un solo contacto, igual que en espalda_leads.
CREATE TABLE IF NOT EXISTS leads_ads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Identificador del lead en Meta. Es la clave de idempotencia de todo el
  -- camino: Make reintenta, y un reintento no puede crear una segunda fila.
  leadgen_id text,
  form_id    text,

  email  text NOT NULL,
  nombre text,

  -- Solo se guarda si consent_whatsapp llegó en true. Meta autorrellena el
  -- teléfono y lo manda siempre; el endpoint lo descarta cuando la casilla
  -- no está marcada, para que no quede ningún teléfono sin base jurídica.
  telefono text,

  -- La pregunta tal y como la vio el lead y lo que contestó, juntas:
  --   {"pregunta": "...", "respuesta": "..."}
  -- El texto de la pregunta lo pone el servidor desde
  -- lib/entrenatzaile-formularios.ts, nunca Make. Puede contener datos de
  -- salud (art. 9 RGPD): no sale de esta tabla ni del aviso interno.
  pregunta jsonb,

  -- Una sola casilla, sin premarcar, y es la que habilita el teléfono.
  consent_whatsapp        boolean DEFAULT false,
  consent_whatsapp_en     timestamptz,
  consent_whatsapp_texto  text,
  consentimientos_version text,

  -- Cuándo registró Meta el lead y cuándo lo recibimos nosotros. Se separan
  -- a propósito: Make puede entregar con retraso, y created_time es además
  -- el que fija fecha_alta del contacto, o sea el día 1 de la ventana de 8.
  created_time timestamptz,
  fecha        timestamptz DEFAULT now(),

  -- Qué pasó de verdad con el alta y con el M0, en la propia fila, para
  -- poder verlo con una consulta y no desde los logs de Vercel.
  -- alta_estado: 'nuevo' | 'reactivado' | 'existente' | 'duplicado' | 'error'
  contacto_id uuid,
  alta_estado text,
  m0_enviado  boolean DEFAULT false,
  m0_error    text
);

-- Un lead de Meta, una fila. Es la base de datos quien impide que un
-- reintento de Make duplique el envío, no solo el endpoint.
CREATE UNIQUE INDEX IF NOT EXISTS leads_ads_leadgen_id_key
  ON leads_ads (leadgen_id)
  WHERE leadgen_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS leads_ads_email_idx ON leads_ads (email);

-- ============================================================
-- RLS
--
-- Esta tabla no la lee nadie desde el navegador: el endpoint y el panel
-- entran con la service key, que salta RLS por diseño. Con RLS activado y
-- CERO políticas, cualquier otra clave (anon incluida) ve cero filas.
--
-- El REVOKE va ADEMÁS del RLS, no en su lugar: son dos capas distintas
-- (permisos de tabla y políticas de fila). Si algún día alguien añade una
-- política permisiva sin pensarlo, el REVOKE sigue en pie.
--
-- No se usa FORCE ROW LEVEL SECURITY a propósito: FORCE aplica las políticas
-- también al propietario de la tabla, y el SQL editor de Supabase entra como
-- propietario. Con FORCE dejarías de poder leer tus propios leads desde ahí.
-- ============================================================

ALTER TABLE leads_ads ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE leads_ads FROM anon;
REVOKE ALL ON TABLE leads_ads FROM authenticated;

-- ============================================================
-- Ampliación 2026-10-15: el campo oculto de seguimiento del formulario.
--
-- Identifica la tirada ('t03') dentro de la propia fila, sin depender de que
-- el form_id se pueda interpretar meses después. Es un código corto que se
-- sanea en el servidor, nunca texto libre.
--
-- En newsletter_contactos la misma cohorte queda marcada con la etiqueta
-- 'tirada03' (columna tags), que es por donde se segmenta desde la
-- newsletter; esto es para consultar la tabla de leads directamente.
-- ============================================================

ALTER TABLE leads_ads
  ADD COLUMN IF NOT EXISTS tirada text;
