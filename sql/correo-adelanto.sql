-- ============================================================
-- Correo en el panel · adelanto de F1 · 2026-11-28
-- Ejecutar a mano en el SQL editor de Supabase. Idempotente.
-- Requiere sql/correo-general-f0.sql ya aplicado.
-- Encargo: vault → 2026-11-28 Encargo — correo en el panel con testimonios,
--   respuestas de newsletter y pendientes (adelanto de F1).md
-- Las tarjetas viven en Correo › Por revisar (la bandeja única «Te toca a ti»
-- aún no existe); la columna `via` ya está en todas las tablas para migrar.
-- ============================================================

-- 1) correo_entrada: categoría «testimonio» y columnas de F1 -----------------
ALTER TABLE correo_entrada DROP CONSTRAINT IF EXISTS correo_entrada_categoria_check;
ALTER TABLE correo_entrada ADD CONSTRAINT correo_entrada_categoria_check
  CHECK (categoria IN ('solicitud','conversacion','newsletter','testimonio','tramite','aviso','ruido','via','sin_clasificar'));

ALTER TABLE correo_remitentes DROP CONSTRAINT IF EXISTS correo_remitentes_categoria_check;
ALTER TABLE correo_remitentes ADD CONSTRAINT correo_remitentes_categoria_check
  CHECK (categoria IN ('solicitud','conversacion','newsletter','testimonio','tramite','aviso','ruido'));

-- tipo = lo que ve Alain en la tarjeta (en los correos de una vía, `categoria` sigue siendo 'via').
ALTER TABLE correo_entrada ADD COLUMN IF NOT EXISTS tipo text
  CHECK (tipo IS NULL OR tipo IN ('solicitud','conversacion','newsletter','testimonio','tramite','aviso','ruido'));
ALTER TABLE correo_entrada ADD COLUMN IF NOT EXISTS etiquetas text[] NOT NULL DEFAULT '{}';
ALTER TABLE correo_entrada ADD COLUMN IF NOT EXISTS pide_respuesta boolean;
ALTER TABLE correo_entrada ADD COLUMN IF NOT EXISTS idioma text;
ALTER TABLE correo_entrada ADD COLUMN IF NOT EXISTS pendiente_sugerido jsonb;   -- {titulo, fecha, frase}
ALTER TABLE correo_entrada ADD COLUMN IF NOT EXISTS accion_ficha text
  CHECK (accion_ficha IS NULL OR accion_ficha IN ('rechazo','ampa','pide_documento'));
ALTER TABLE correo_entrada ADD COLUMN IF NOT EXISTS accion_dato text;           -- motivo, email del AMPA…
ALTER TABLE correo_entrada ADD COLUMN IF NOT EXISTS pregunta_origen text;       -- newsletter: pregunta del mail al que contesta
ALTER TABLE correo_entrada ADD COLUMN IF NOT EXISTS newsletter_asunto text;
ALTER TABLE correo_entrada ADD COLUMN IF NOT EXISTS texto_en timestamptz;
ALTER TABLE correo_entrada ADD COLUMN IF NOT EXISTS procesado_en timestamptz;
ALTER TABLE correo_entrada ADD COLUMN IF NOT EXISTS cerrado_en timestamptz;
ALTER TABLE correo_entrada ADD COLUMN IF NOT EXISTS cerrado_motivo text;        -- visto | hecho | respondido en Mail | …
CREATE INDEX IF NOT EXISTS correo_entrada_abiertas_idx ON correo_entrada (estado, fecha DESC) WHERE estado <> 'cerrado';

-- 2) Pendientes de correo (solo en el panel; sin espejo al vault ni nota diaria) -
CREATE TABLE IF NOT EXISTS correo_pendientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  fecha_limite date,
  correo_id uuid REFERENCES correo_entrada(id) ON DELETE SET NULL,
  message_id text,                       -- para abrir el correo en Mail (message://)
  via text,                              -- charlas | magia | entrenatzaile | general
  estado text NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto','hecho')),
  hecho_en timestamptz,
  aviso_vispera date,                    -- día en que se mandó el aviso de «mañana»
  aviso_hoy date,                        -- día en que se mandó el aviso de «hoy»
  creado_por text NOT NULL DEFAULT 'alain' CHECK (creado_por IN ('alain','ia','regla')),
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS correo_pendientes_estado_idx ON correo_pendientes (estado, fecha_limite);

-- 3) Testimonios -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS testimonios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correo_id uuid REFERENCES correo_entrada(id) ON DELETE SET NULL,
  message_id text,
  fecha date,                            -- día en que llegó
  quien text,                            -- puede ir vacío
  centro text,                           -- centro o cliente
  centro_id uuid,                        -- ficha de charlas, si la hay
  via text NOT NULL CHECK (via IN ('charlas','entrenatzaile','magia')),
  idioma text,
  permiso text NOT NULL CHECK (permiso IN ('solo_anonimo','con_nombre','no_consta')),
  donde text[] NOT NULL DEFAULT '{}',    -- objecion | dossier | cierre | web
  texto text NOT NULL,
  espejado_en timestamptz,               -- lo vuelca scripts/crm/espejo-correo.mjs en la pasada horaria
  vault_nota text,                       -- nota del vault donde quedó (o «ya volcado a mano»)
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS testimonios_correo_idx ON testimonios (message_id) WHERE message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS testimonios_via_idx ON testimonios (via, permiso);

-- 4) Respuestas de suscriptores a la newsletter ---------------------------------
CREATE TABLE IF NOT EXISTS correo_respuestas_news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correo_id uuid REFERENCES correo_entrada(id) ON DELETE SET NULL,
  message_id text UNIQUE,
  fecha date,
  remitente text,
  nombre text,
  newsletter_asunto text,
  pregunta text,
  respuesta text NOT NULL,
  espejado_en timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now()
);

-- 5) Fichas de charlas: etiquetas y motivo de rechazo ---------------------------
ALTER TABLE charlas_centros ADD COLUMN IF NOT EXISTS etiquetas text[] NOT NULL DEFAULT '{}';   -- p. ej. 'pide documento'
ALTER TABLE charlas_centros ADD COLUMN IF NOT EXISTS motivo_rechazo text;

ALTER TABLE correo_pendientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE testimonios ENABLE ROW LEVEL SECURITY;
ALTER TABLE correo_respuestas_news ENABLE ROW LEVEL SECURITY;

-- 6) Reglas por remitente pedidas el 28-11 (confirmadas por Alain en el encargo) ----
INSERT INTO correo_remitentes (patron, tratamiento, categoria, nota, creado_por) VALUES
  ('hacienda@gipuzkoa.eus',       'solo_fecha', 'tramite', 'Hacienda Foral de Gipuzkoa: cuerpo 30 días, saca el plazo o la acción', 'alain'),
  ('@agenciatributaria.gob.es',   'solo_fecha', 'tramite', 'AEAT', 'alain'),
  ('@red.es',                     'solo_fecha', 'tramite', 'Red.es (Kit Digital)', 'alain'),
  ('@seg-social.es',              'solo_fecha', 'tramite', 'Seguridad Social', 'alain'),
  ('sarrera@urduliz.eus',         'completo',   'aviso',   'Autorrespuesta del ayuntamiento: no vale como solicitud ni como respuesta del centro', 'alain')
ON CONFLICT (patron) DO UPDATE SET tratamiento = EXCLUDED.tratamiento, categoria = EXCLUDED.categoria, nota = EXCLUDED.nota, creado_por = 'alain', actualizado_en = now();

-- Tope diario de IA de la bandeja general (Arquitectura v4 §7), en USD.
INSERT INTO charlas_config (clave, valor) VALUES ('general_tope_dia_usd', '1'::jsonb) ON CONFLICT (clave) DO NOTHING;
-- Días hacia atrás que entran en «Por revisar» (el histórico de F0 llega a 30).
INSERT INTO charlas_config (clave, valor) VALUES ('correo_panel_dias', '7'::jsonb) ON CONFLICT (clave) DO NOTHING;
