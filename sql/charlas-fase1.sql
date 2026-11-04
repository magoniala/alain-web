-- ============================================================
-- Sistema automático · carril charlas · FASE 1: bandeja asistida (2026-10-29)
-- Ejecutar a mano en el SQL editor de Supabase, DESPUÉS de charlas.sql.
-- Idempotente: se puede volver a ejecutar sin romper nada.
-- ============================================================

-- ------------------------------------------------------------
-- Conocimiento: lo que el redactor lee antes de escribir. Guiones,
-- objeciones, dossier, ejemplos reales de respuestas aprobadas y las
-- reglas aprendidas de las correcciones de Alain. Se edita sin
-- redesplegar: cambia la fila, cambia lo que escribe el sistema.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS charlas_conocimiento (
  clave text PRIMARY KEY,                 -- flujo | mail_1 | mail_2 | … | ejemplos_23-10 | reglas_aprendidas
  titulo text NOT NULL,
  tipo text NOT NULL DEFAULT 'guion' CHECK (tipo IN ('guion','ejemplos','reglas','contexto')),
  texto text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  orden int NOT NULL DEFAULT 100,
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Estado del lector IMAP: hasta qué UID se ha leído de cada carpeta.
-- Si cambia uidvalidity (el servidor reindexó la carpeta) se relee por
-- fecha y los duplicados se descartan por Message-ID.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS charlas_imap_estado (
  carpeta text PRIMARY KEY,               -- INBOX | Sent (nombre real del servidor)
  uidvalidity text,
  ultimo_uid bigint NOT NULL DEFAULT 0,
  ultima_lectura timestamptz
);

-- ------------------------------------------------------------
-- Uso de la IA: una fila por llamada, para ver el coste real en el panel.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS charlas_ia_uso (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  creado_en timestamptz NOT NULL DEFAULT now(),
  modelo text NOT NULL,
  proposito text NOT NULL,                -- procesar_entrante | regenerar | aprender
  mensaje_id uuid,
  tokens_entrada int NOT NULL DEFAULT 0,
  tokens_salida int NOT NULL DEFAULT 0,
  tokens_cache_escritura int NOT NULL DEFAULT 0,
  tokens_cache_lectura int NOT NULL DEFAULT 0,
  coste_usd numeric(10,5) NOT NULL DEFAULT 0,
  duracion_ms int,
  error text
);
CREATE INDEX IF NOT EXISTS charlas_ia_uso_fecha_idx ON charlas_ia_uso (creado_en DESC);

-- ------------------------------------------------------------
-- Mensajes: de qué carpeta y UID vienen, y en qué intento de proceso van.
-- ------------------------------------------------------------
ALTER TABLE charlas_mensajes ADD COLUMN IF NOT EXISTS carpeta text;
ALTER TABLE charlas_mensajes ADD COLUMN IF NOT EXISTS uid bigint;
ALTER TABLE charlas_mensajes ADD COLUMN IF NOT EXISTS intentos int NOT NULL DEFAULT 0;
ALTER TABLE charlas_mensajes ADD COLUMN IF NOT EXISTS resumen text;          -- una línea, para el Registro y la bandeja
ALTER TABLE charlas_mensajes ADD COLUMN IF NOT EXISTS match_por text;        -- hilo | email | dominio | manual

-- El estado de un mensaje entrante: nuevo → procesado (tarea creada) | ignorado | error.
-- 'pendiente_asignar' = no se sabe de qué centro es; espera a que Alain lo asigne.
ALTER TABLE charlas_mensajes DROP CONSTRAINT IF EXISTS charlas_mensajes_estado_check;
ALTER TABLE charlas_mensajes ADD CONSTRAINT charlas_mensajes_estado_check
  CHECK (estado IN ('nuevo','procesado','ignorado','error','pendiente_asignar'));

-- ------------------------------------------------------------
-- Tareas: cambios que se aplicarán al CRM cuando Alain apruebe.
-- ------------------------------------------------------------
ALTER TABLE charlas_tareas ADD COLUMN IF NOT EXISTS cambios_crm jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE charlas_tareas ADD COLUMN IF NOT EXISTS destinatario text;
ALTER TABLE charlas_tareas ADD COLUMN IF NOT EXISTS nota_para_alain text;    -- lo que el sistema quiere que sepa antes de enviar
ALTER TABLE charlas_tareas ADD COLUMN IF NOT EXISTS editado boolean NOT NULL DEFAULT false;

-- ------------------------------------------------------------
-- Configuración nueva de la fase 1.
--   modo_prueba: mientras sea true, "Enviar" manda el correo a Alain en vez
--   de al centro, y NO toca el CRM. Se apaga desde el panel tras comprobar
--   que lo que llega es correcto.
-- ------------------------------------------------------------
INSERT INTO charlas_config (clave, valor) VALUES
  ('modo_prueba', 'true'),
  ('remitente', '"Alain Zulaika <alain@alainzulaika.com>"'),
  ('modelo', '"claude-sonnet-5-5"'),
  ('lectura_inicial_dias', '10'),
  ('procesar_por_ejecucion', '4'),
  ('lector_activo', 'true')
ON CONFLICT (clave) DO NOTHING;

-- El buzón que se lee es alain@: info@ redirige allí.
UPDATE charlas_config SET valor = '"alain@alainzulaika.com"', actualizado_en = now() WHERE clave = 'buzon';

ALTER TABLE charlas_conocimiento ENABLE ROW LEVEL SECURITY;
ALTER TABLE charlas_imap_estado  ENABLE ROW LEVEL SECURITY;
ALTER TABLE charlas_ia_uso       ENABLE ROW LEVEL SECURITY;
