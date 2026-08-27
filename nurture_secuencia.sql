-- ============================================================
-- Secuencia de nurture (7 mails) sobre newsletter_contactos
-- Ejecutar a mano en el SQL editor de Supabase.
-- ============================================================

ALTER TABLE newsletter_contactos
  ADD COLUMN IF NOT EXISTS recibe_secuencia boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS posicion_secuencia int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS secuencia_completada boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS fecha_ultimo_mail_secuencia timestamptz;

CREATE TABLE IF NOT EXISTS secuencia_mails (
  posicion    int PRIMARY KEY,
  asunto      text,
  cuerpo_html text,
  activo      boolean DEFAULT false
);

-- ============================================================
-- Ampliación 2026-07-29: remitente por mail + recordatorio puntual
-- (secuencia de leads de Facebook Ads)
-- ============================================================

ALTER TABLE secuencia_mails
  ADD COLUMN IF NOT EXISTS remitente text;

ALTER TABLE newsletter_contactos
  ADD COLUMN IF NOT EXISTS recordatorio_valoracion_enviado boolean DEFAULT false;

-- ============================================================
-- Ampliación 2026-07-29 (2): captación de leads de Meta/Facebook Ads
-- vía POST /api/leads/entrada
-- ============================================================

ALTER TABLE newsletter_contactos
  ADD COLUMN IF NOT EXISTS edad int,
  ADD COLUMN IF NOT EXISTS leadgen_id text,
  ADD COLUMN IF NOT EXISTS form_id text;

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_contactos_leadgen_id_key
  ON newsletter_contactos (leadgen_id)
  WHERE leadgen_id IS NOT NULL;

-- ============================================================
-- Ampliación 2026-07-29 (3): leads de ads que ya estaban en la lista
-- ============================================================

ALTER TABLE newsletter_contactos
  ADD COLUMN IF NOT EXISTS mail_duplicado_ads_enviado boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS leads_ads_duplicados (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email      text NOT NULL,
  leadgen_id text,
  fecha      timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS leads_ads_duplicados_leadgen_id_key
  ON leads_ads_duplicados (leadgen_id)
  WHERE leadgen_id IS NOT NULL;

-- ============================================================
-- Ampliación 2026-07-29 (4): candado de envío separado del marcador de
-- "enviado de verdad" — fecha_ultimo_mail_secuencia ahora solo se toca
-- tras confirmación de Mailjet, nunca antes del intento.
-- ============================================================

ALTER TABLE newsletter_contactos
  ADD COLUMN IF NOT EXISTS enviando_secuencia_desde timestamptz,
  ADD COLUMN IF NOT EXISTS recordatorio_valoracion_enviando_desde timestamptz,
  ADD COLUMN IF NOT EXISTS mail_duplicado_ads_enviando_desde timestamptz;

-- ============================================================
-- Ampliación 2026-07-29 (5): visibilidad real del envío del mail de
-- duplicados — queda registrado en la propia fila del toque, no solo en
-- logs de Vercel que nadie puede consultar cómodamente.
-- ============================================================

ALTER TABLE leads_ads_duplicados
  ADD COLUMN IF NOT EXISTS mail_enviado boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS mail_error text;

-- ============================================================
-- Ampliación 2026-08-26: los mails de la secuencia se pueden escribir
-- como texto desde el panel, sin picar HTML.
--
-- `formato` decide cómo se interpreta `cuerpo_html` al enviar:
--   'html'  -> se usa tal cual (es lo que había: no se toca nada de lo ya escrito)
--   'texto' -> se convierte con lib/email-markdown.ts
-- Por eso el DEFAULT es 'html': las filas que ya existen siguen saliendo
-- exactamente igual que antes.
-- ============================================================

ALTER TABLE secuencia_mails
  ADD COLUMN IF NOT EXISTS formato   text DEFAULT 'html',
  ADD COLUMN IF NOT EXISTS preheader text;

UPDATE secuencia_mails SET formato = 'html' WHERE formato IS NULL;

-- ============================================================
-- Ampliación 2026-08-26 (2): secuencia_mails deja de ser solo la secuencia
-- de nurture y pasa a alojar TODAS las secuencias automáticas.
--
--   secuencia : 'nurture' | 'comodin' | 'mision'
--   idioma    : 'es' | 'eu'  (comodin y mision son bilingües)
--
-- Las filas que ya existen se quedan como ('nurture', posicion, 'es'), que
-- es exactamente lo que eran. La clave primaria pasa a ser compuesta, y
-- TODAS las consultas de nurture filtran ya por secuencia='nurture', para
-- que no se mezclen los mails de una secuencia con los de otra.
-- ============================================================

ALTER TABLE secuencia_mails
  ADD COLUMN IF NOT EXISTS secuencia text NOT NULL DEFAULT 'nurture',
  ADD COLUMN IF NOT EXISTS idioma    text NOT NULL DEFAULT 'es';

ALTER TABLE secuencia_mails DROP CONSTRAINT IF EXISTS secuencia_mails_pkey;
ALTER TABLE secuencia_mails ADD PRIMARY KEY (secuencia, posicion, idioma);
