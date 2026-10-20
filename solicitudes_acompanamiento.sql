-- ============================================================
-- Entrenatzaile · Solicitudes de plaza de acompañamiento (2026-10-20)
-- Página  entrenatzaile.alainzulaika.com/acompanamiento
-- Ejecutar a mano en el SQL editor de Supabase.
-- ============================================================
--
-- Quien pide plaza NO entra en la newsletter desde aquí: las casillas cubren
-- valorar su caso y escribirle por WhatsApp, nada más. en_newsletter solo
-- anota si ya estaba en la lista cuando lo envió.

CREATE TABLE IF NOT EXISTS solicitudes_acompanamiento (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  nombre   text NOT NULL,
  email    text NOT NULL,
  telefono text NOT NULL,

  -- Opciones cerradas, como el texto que se mostró.
  edad_rango text,
  actividad  text,
  -- "1", "2", "3" o "4 o más". Vacío cuando dijo que no hace nada.
  dias_semana text,
  lugar      text,

  -- Casillas marcadas, tal cual. "Otro" lleva su texto en frenos_otro.
  frenos      jsonb,
  frenos_otro text,

  -- Texto libre. salud puede contener datos de salud (art. 9 RGPD): no sale
  -- nunca de esta tabla ni del correo de aviso.
  objetivo text,
  salud    text,

  preguntas_mostradas jsonb,

  -- Si el email ya estaba en newsletter_contactos al enviarlo.
  en_newsletter boolean DEFAULT false,

  -- Las dos casillas, sin premarcar, obligatorias. Valor, cuándo y el texto
  -- exacto que se le mostró.
  consent_datos           boolean DEFAULT false,
  consent_datos_texto     text,
  consent_whatsapp        boolean DEFAULT false,
  consent_whatsapp_texto  text,
  consent_en              timestamptz,
  consentimientos_version text,

  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  utm_content  text,
  utm_term     text,
  referrer     text,

  enviado_en timestamptz DEFAULT now(),

  confirmacion_enviada boolean DEFAULT false,
  aviso_enviado        boolean DEFAULT false,
  aviso_error          text
);

CREATE INDEX IF NOT EXISTS solicitudes_acompanamiento_email_idx ON solicitudes_acompanamiento (email);

-- Lista de espera: quien llega con las plazas ya cubiertas y deja su email.
CREATE TABLE IF NOT EXISTS acompanamiento_avisos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  consent_texto text,
  consentimientos_version text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  referrer text,
  enviado_en timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS acompanamiento_avisos_email_idx ON acompanamiento_avisos (email);

-- Contador de plazas libres, editable desde /admin → Acompañamiento.
CREATE TABLE IF NOT EXISTS acompanamiento_config (
  tanda text PRIMARY KEY,
  plazas_libres int NOT NULL DEFAULT 2 CHECK (plazas_libres >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO acompanamiento_config (tanda) VALUES ('noviembre-2026')
ON CONFLICT (tanda) DO NOTHING;
