-- ============================================================
-- Sistema automático · FASE 6a: carril de MAGIA (prospectos) · 2026-11-02
-- Ejecutar a mano en el SQL editor de Supabase. Idempotente.
--
-- Esquema genérico crm_* con columna `carril` ('magia' ahora; 'entrenatzaile'
-- después). Las tablas charlas_* no se tocan. Mismo patrón que el carril de
-- charlas: fichas + interacciones (Registro) + mensajes de correo + hilos +
-- tareas (la bandeja) + correcciones (aprendizaje) + conocimiento (guiones).
-- ============================================================

CREATE TABLE IF NOT EXISTS crm_fichas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carril text NOT NULL DEFAULT 'magia',
  nombre text NOT NULL,
  negocio text,                           -- magia | contenido
  segmento text,                          -- antiguo | intermediario | recuperar | charlas | referido
  tipo_entidad text,                      -- ayuntamiento | empresa | asociación | particular | hostelería | centro educativo | otro
  territorio text,
  localidad text,
  telefono text,
  email text,
  web text,
  prioridad text,                         -- A | B | C
  estado text NOT NULL DEFAULT '0 Por contactar',
  origen text,
  responsable text,
  responsable_cargo text,
  responsable_email text,
  responsable_tel text,
  ultimo_evento text,
  fecha_ultimo_evento date,
  mes_temporada int,                      -- mes en que suele contratar (antiguos)
  canal text,                             -- WhatsApp | Mail | …
  idioma text,                            -- eu | es
  enviado boolean,                        -- casilla de tanda (antiguos); el sistema la deja en false
  ficha_charlas text,                     -- enlace a la ficha del CRM de charlas, si es la misma entidad
  intentos_llamada int NOT NULL DEFAULT 0,
  mails_enviados int NOT NULL DEFAULT 0,
  fecha_ultimo_contacto date,
  proxima_accion text,
  bloqueado_por text,
  fecha_proxima_accion date,
  fecha_creacion date,
  nivel_autonomia text NOT NULL DEFAULT 'B' CHECK (nivel_autonomia IN ('A','B','C')),
  -- Cuerpo de la nota del vault, tal cual, para regenerarla idéntica:
  frontmatter_raw text,                   -- las líneas originales del frontmatter (para conservar comillas y orden)
  cuerpo_antes text,                      -- lo que va entre el frontmatter y "## Registro" (título, bloque mensaje-listo…)
  cuerpo_despues text,                    -- lo que va después del Registro (Eventos, Notas, Tarifas…)
  datos jsonb NOT NULL DEFAULT '{}'::jsonb, -- claves de frontmatter no previstas
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_por text NOT NULL DEFAULT 'vault',
  UNIQUE (carril, nombre)
);
CREATE INDEX IF NOT EXISTS crm_fichas_estado_idx ON crm_fichas (carril, estado);
CREATE INDEX IF NOT EXISTS crm_fichas_fpa_idx ON crm_fichas (carril, fecha_proxima_accion);
CREATE INDEX IF NOT EXISTS crm_fichas_email_idx ON crm_fichas (lower(email));
CREATE INDEX IF NOT EXISTS crm_fichas_resp_email_idx ON crm_fichas (lower(responsable_email));

CREATE TABLE IF NOT EXISTS crm_interacciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ficha_id uuid NOT NULL REFERENCES crm_fichas(id) ON DELETE CASCADE,
  fecha date,
  canal text,                             -- Llamada | Mail | WhatsApp | Reunión | Recibido | Sistema | Manual
  texto text NOT NULL,
  raw text,
  orden int NOT NULL DEFAULT 0,
  origen text NOT NULL DEFAULT 'vault',   -- vault | panel | sistema | manual
  mensaje_id uuid,
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_interacciones_ficha_idx ON crm_interacciones (ficha_id, fecha, orden);

CREATE TABLE IF NOT EXISTS crm_hilos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ficha_id uuid NOT NULL REFERENCES crm_fichas(id) ON DELETE CASCADE,
  canal text NOT NULL DEFAULT 'principal',
  asunto text,
  message_id_raiz text,
  ultimo_message_id text,
  ultimo_mensaje_en timestamptz,
  UNIQUE (ficha_id, canal)
);

CREATE TABLE IF NOT EXISTS crm_mensajes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ficha_id uuid REFERENCES crm_fichas(id) ON DELETE SET NULL,
  direccion text NOT NULL CHECK (direccion IN ('entrante','saliente')),
  message_id text UNIQUE,
  in_reply_to text,
  referencias text[],
  de text,
  para text[],
  asunto text,
  texto text,
  fecha timestamptz,
  idioma text,
  clasificacion text,
  clasificacion_confianza numeric(3,2),
  datos_extraidos jsonb NOT NULL DEFAULT '{}'::jsonb,
  resumen text,
  estado text NOT NULL DEFAULT 'nuevo' CHECK (estado IN ('nuevo','procesado','ignorado','error')),
  intentos int NOT NULL DEFAULT 0,
  tarea_id uuid,
  tipo_salida text,
  error text,
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_mensajes_ficha_idx ON crm_mensajes (ficha_id, fecha DESC);
CREATE INDEX IF NOT EXISTS crm_mensajes_estado_idx ON crm_mensajes (estado) WHERE estado = 'nuevo';

CREATE TABLE IF NOT EXISTS crm_tareas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ficha_id uuid NOT NULL REFERENCES crm_fichas(id) ON DELETE CASCADE,
  carril text NOT NULL DEFAULT 'magia',
  tipo text NOT NULL,                     -- reactivacion | recordatorio_1 | recordatorio_2 | recuperacion | check_in | propuesta | seguimiento | cierre | post_evento | respuesta | llamada_alain | revisar_correo | aparcar
  canal text NOT NULL DEFAULT 'mail' CHECK (canal IN ('mail','whatsapp','llamada','ninguno')),
  nivel text NOT NULL CHECK (nivel IN ('A','B','C')),
  urgencia smallint NOT NULL DEFAULT 1,
  urgencia_motivo text,
  estado text NOT NULL DEFAULT 'revisar'
    CHECK (estado IN ('pendiente','revisar','aprobada','enviada','hecha','descartada','error')),
  idioma text,
  mensaje_entrante_id uuid REFERENCES crm_mensajes(id) ON DELETE SET NULL,
  contexto jsonb NOT NULL DEFAULT '{}'::jsonb,
  borrador_asunto text,
  borrador_texto text,
  texto_final text,
  destinatario text,                      -- correo o teléfono según canal
  cambios_crm jsonb NOT NULL DEFAULT '{}'::jsonb,
  nota_para_alain text,
  editado boolean NOT NULL DEFAULT false,
  mensaje_salida_id uuid REFERENCES crm_mensajes(id) ON DELETE SET NULL,
  motivo text,
  error text,
  notificada_en timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now(),
  resuelto_en timestamptz,
  resuelto_por text
);
CREATE INDEX IF NOT EXISTS crm_tareas_cola_idx ON crm_tareas (carril, estado, urgencia DESC, creado_en);
CREATE INDEX IF NOT EXISTS crm_tareas_ficha_idx ON crm_tareas (ficha_id, creado_en DESC);

CREATE TABLE IF NOT EXISTS crm_correcciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carril text NOT NULL DEFAULT 'magia',
  tarea_id uuid REFERENCES crm_tareas(id) ON DELETE SET NULL,
  tipo_mensaje text NOT NULL,
  idioma text,
  borrador text NOT NULL,
  final text NOT NULL,
  motivo text,
  creado_en timestamptz NOT NULL DEFAULT now()
);

-- Guiones y reglas del carril (Guía comercial, flujos, plantillas, mensajes aprobados).
CREATE TABLE IF NOT EXISTS crm_conocimiento (
  clave text NOT NULL,
  carril text NOT NULL DEFAULT 'magia',
  titulo text,
  tipo text NOT NULL DEFAULT 'guion',     -- guion | reglas | ejemplos | condiciones
  texto text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  orden int NOT NULL DEFAULT 50,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (carril, clave)
);

-- Config del carril (en la tabla de config común, con prefijo magia_).
INSERT INTO charlas_config (clave, valor) VALUES
  ('magia_activo', 'true'),               -- el motor crea tareas para las fichas de magia
  ('magia_por_dia', '10'),                -- tope de tareas nuevas del motor al día (una tanda razonable)
  ('magia_espejo', 'true')                -- el espejo regenera Prospectos/ desde Supabase
ON CONFLICT (clave) DO NOTHING;

-- Fecha de actualización automática.
CREATE OR REPLACE FUNCTION crm_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.actualizado_en = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS crm_fichas_touch ON crm_fichas;
CREATE TRIGGER crm_fichas_touch BEFORE UPDATE ON crm_fichas FOR EACH ROW EXECUTE FUNCTION crm_touch();

ALTER TABLE crm_fichas ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_interacciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_hilos ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_mensajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_tareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_correcciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_conocimiento ENABLE ROW LEVEL SECURITY;
