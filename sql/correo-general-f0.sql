-- ============================================================
-- Sistema automático · BANDEJA GENERAL DE CORREO · fase F0 (medir) · 2026-11-06
-- Ejecutar a mano en el SQL editor de Supabase. Idempotente.
--
-- Diseño: vault → 01 - PROYECTOS/🤖 Sistema automático/
--   Sistema · Arquitectura v4 — bandeja general de correo.md
--
-- F0 solo mide: el lector apunta las CABECERAS de todo lo que entra en el
-- buzón (sin cuerpo, sin IA, sin tocar flags en el buzón) y lo clasifica
-- con reglas. Las tablas ya llevan las columnas de F1-F2 para no migrar
-- otra vez (texto, resumen, estado), pero en F0 se quedan vacías.
-- ============================================================

CREATE TABLE IF NOT EXISTS correo_entrada (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buzon text NOT NULL DEFAULT 'alain',          -- id del buzón (F1: tabla correo_buzones)
  carpeta text NOT NULL DEFAULT 'INBOX',
  uid bigint,
  message_id text NOT NULL UNIQUE,
  in_reply_to text,
  referencias text[],
  direccion text NOT NULL DEFAULT 'entrante' CHECK (direccion IN ('entrante','saliente')),
  de text,
  de_nombre text,
  dominio text,
  para text[],
  asunto text,
  fecha timestamptz,
  masivo boolean NOT NULL DEFAULT false,         -- List-Unsubscribe / List-Id / Precedence bulk / Auto-Submitted / no-reply
  cabeceras jsonb NOT NULL DEFAULT '{}'::jsonb,
  tratamiento text NOT NULL DEFAULT 'sin_regla'
    CHECK (tratamiento IN ('completo','solo_fecha','solo_cabecera','silenciado','sin_regla')),
  categoria text NOT NULL DEFAULT 'sin_clasificar'
    CHECK (categoria IN ('solicitud','conversacion','newsletter','tramite','aviso','ruido','via','sin_clasificar')),
  clasificado_por text CHECK (clasificado_por IN ('regla','via','cabeceras','ia','alain')),
  via text,                                      -- charlas | magia | (entrenatzaile, más adelante)
  via_ref text,                                  -- id del centro o de la ficha
  seen_buzon boolean,
  estado text NOT NULL DEFAULT 'nuevo' CHECK (estado IN ('nuevo','abierto','cerrado')),
  texto text,                                    -- F1 (nunca en solo_cabecera ni silenciado)
  resumen text,                                  -- F1
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS correo_entrada_fecha_idx ON correo_entrada (fecha DESC);
CREATE INDEX IF NOT EXISTS correo_entrada_de_idx ON correo_entrada (de);
CREATE INDEX IF NOT EXISTS correo_entrada_dominio_idx ON correo_entrada (dominio);
CREATE INDEX IF NOT EXISTS correo_entrada_estado_idx ON correo_entrada (estado, fecha DESC);

-- Reglas por remitente: email exacto ('x@dominio.com') o dominio entero ('@dominio.com').
-- 'sugerencia' = propuesta de Álex, se ve en gris y NO se aplica hasta que Alain la confirma.
CREATE TABLE IF NOT EXISTS correo_remitentes (
  patron text PRIMARY KEY,
  tratamiento text NOT NULL CHECK (tratamiento IN ('completo','solo_fecha','solo_cabecera','silenciado')),
  categoria text CHECK (categoria IN ('solicitud','conversacion','newsletter','tramite','aviso','ruido')),
  nota text,
  creado_por text NOT NULL DEFAULT 'alain' CHECK (creado_por IN ('alain','sugerencia')),
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE correo_entrada ENABLE ROW LEVEL SECURITY;
ALTER TABLE correo_remitentes ENABLE ROW LEVEL SECURITY;

-- Sugerencias iniciales (avisos de plataformas: basta con ver remitente y asunto).
INSERT INTO correo_remitentes (patron, tratamiento, categoria, nota, creado_por) VALUES
  ('@stripe.com',          'solo_cabecera', 'aviso', 'Pagos y avisos de Stripe', 'sugerencia'),
  ('@mailjet.com',         'solo_cabecera', 'aviso', 'Avisos de Mailjet (las respuestas a la newsletter NO vienen de aquí)', 'sugerencia'),
  ('@vercel.com',          'solo_cabecera', 'aviso', 'Despliegues y facturación', 'sugerencia'),
  ('@github.com',          'solo_cabecera', 'aviso', NULL, 'sugerencia'),
  ('@supabase.com',        'solo_cabecera', 'aviso', NULL, 'sugerencia'),
  ('@supabase.io',         'solo_cabecera', 'aviso', NULL, 'sugerencia'),
  ('@facebookmail.com',    'solo_cabecera', 'aviso', 'Meta (anuncios, páginas)', 'sugerencia'),
  ('@accounts.google.com', 'solo_cabecera', 'aviso', 'Alertas de cuenta de Google', 'sugerencia'),
  ('@metricool.com',       'solo_cabecera', 'aviso', NULL, 'sugerencia')
ON CONFLICT (patron) DO NOTHING;
