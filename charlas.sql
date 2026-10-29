-- ============================================================
-- Sistema automático · carril charlas (2026-10-29)
-- Fase 0: base de datos. Ejecutar a mano en el SQL editor de Supabase.
-- Diseño: 01 - PROYECTOS/🤖 Sistema automático/Sistema · Arquitectura v1 — carril charlas.md
-- ============================================================
--
-- Supabase pasa a ser la fuente de verdad del CRM de charlas. El vault de
-- Obsidian se regenera desde aquí (scripts/charlas/espejo-vault.mjs); las
-- fichas se tocan desde el panel, no a mano. Todas las tablas llevan el
-- prefijo charlas_ para convivir con el resto del proyecto.
--
-- Idempotente: se puede volver a ejecutar sin romper nada.

-- ------------------------------------------------------------
-- Centros: una fila por ficha de Centros/. Mismos campos que el
-- frontmatter actual, con los mismos nombres, para que el espejo sea
-- literal. Lo nuevo: nivel_autonomia, notas, secciones_extra y la
-- trazabilidad (actualizado_por).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS charlas_centros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,            -- = nombre del fichero .md, sin extensión

  codigo text,                            -- código oficial del centro (Open Data)
  territorio text,                        -- Gipuzkoa | Bizkaia | Araba | Navarra | Cantabria…
  localidad text,
  tipo text,                              -- público | religioso | ikastola | privado…
  tipo_centro text,                       -- CPEIPS, IES, BHI…
  modelo_linguistico text,
  euskera text,                           -- sí | parcial | no
  etapas text[] NOT NULL DEFAULT '{}',
  etapas_confirmadas text,
  direccion text,
  telefono text,
  email_centro text,
  web text,
  prioridad text,

  estado text NOT NULL DEFAULT '0 Por llamar',
  origen text,
  via text,                               -- contacto | generico
  responsable text,
  responsable_cargo text,
  responsable_email text,
  responsable_tel text,
  ampa text,
  ampa_contacto text,
  ampa_email text,
  calendario_abierto text,
  intentos_llamada int NOT NULL DEFAULT 0,
  mails_enviados int NOT NULL DEFAULT 0,
  fecha_ultimo_contacto date,
  proxima_accion text,
  bloqueado_por text,
  fecha_proxima_accion date,
  fecha_creacion date,
  ficha_cliente text,                     -- "[[Nombre]]" de Prospectos/ si ya es cliente

  notas text,                             -- sección ## Notas de la ficha
  secciones_extra jsonb NOT NULL DEFAULT '{}'::jsonb, -- otras secciones ## sueltas

  -- A = el sistema envía solo · B = el sistema redacta y Alain aprueba ·
  -- C = solo Alain. Ver §4 de la arquitectura. Por defecto B; los centros
  -- en 6 En conversación pasan a C automáticamente (ver trigger).
  nivel_autonomia text NOT NULL DEFAULT 'B' CHECK (nivel_autonomia IN ('A','B','C')),

  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_por text NOT NULL DEFAULT 'vault'   -- vault | panel | sistema | manual
);

CREATE INDEX IF NOT EXISTS charlas_centros_estado_idx ON charlas_centros (estado);
CREATE INDEX IF NOT EXISTS charlas_centros_fpa_idx ON charlas_centros (fecha_proxima_accion);
CREATE INDEX IF NOT EXISTS charlas_centros_territorio_idx ON charlas_centros (territorio);
CREATE INDEX IF NOT EXISTS charlas_centros_resp_email_idx ON charlas_centros (lower(responsable_email));
CREATE INDEX IF NOT EXISTS charlas_centros_email_centro_idx ON charlas_centros (lower(email_centro));

-- ------------------------------------------------------------
-- Contactos: las personas de cada centro. El responsable y el AMPA del
-- frontmatter se vuelcan aquí también, y aquí se añaden los que vayan
-- apareciendo (secretaría, el compañero al que "lo pasan"…).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS charlas_contactos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centro_id uuid NOT NULL REFERENCES charlas_centros(id) ON DELETE CASCADE,
  nombre text,
  cargo text,
  email text,
  telefono text,
  rol text NOT NULL DEFAULT 'otro' CHECK (rol IN ('responsable','ampa','secretaria','direccion','otro')),
  origen text NOT NULL DEFAULT 'vault',   -- vault | panel | correo | web | llamada
  creado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (centro_id, lower(email))
);
CREATE INDEX IF NOT EXISTS charlas_contactos_email_idx ON charlas_contactos (lower(email));

-- ------------------------------------------------------------
-- Interacciones: el Registro de la ficha, una fila por línea.
-- `raw` guarda la línea tal cual estaba en el vault; `texto` es lo
-- que se muestra. Las que vienen del vault llevan origen='vault' y se
-- reemplazan en bloque al reimportar; las demás nunca se tocan.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS charlas_interacciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centro_id uuid NOT NULL REFERENCES charlas_centros(id) ON DELETE CASCADE,
  fecha date,
  canal text,                             -- Llamada | Mail | Mail AMPA | WhatsApp | Reunión | Recibido | Sistema | Manual
  texto text NOT NULL,
  raw text,
  orden int NOT NULL DEFAULT 0,           -- posición dentro del día, para conservar el orden del Registro
  origen text NOT NULL DEFAULT 'vault',   -- vault | panel | sistema | manual
  mensaje_id uuid,                        -- FK blanda a charlas_mensajes (se añade abajo)
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS charlas_interacciones_centro_idx ON charlas_interacciones (centro_id, fecha, orden);

-- ------------------------------------------------------------
-- Hilos de correo: uno por centro y canal. Guarda el Message-ID del
-- primer correo para que todo lo demás salga como respuesta (regla del
-- Flujo: un solo hilo por centro).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS charlas_hilos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centro_id uuid NOT NULL REFERENCES charlas_centros(id) ON DELETE CASCADE,
  canal text NOT NULL DEFAULT 'principal' CHECK (canal IN ('principal','ampa')),
  asunto text,
  message_id_raiz text,
  ultimo_message_id text,
  ultimo_mensaje_en timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (centro_id, canal)
);

-- ------------------------------------------------------------
-- Mensajes: cada correo que entra o sale. Los entrantes los crea el
-- lector IMAP; los salientes, el emisor. La clasificación y los datos
-- extraídos los pone Claude; la confianza decide si sube de nivel.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS charlas_mensajes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centro_id uuid REFERENCES charlas_centros(id) ON DELETE SET NULL, -- null = huérfano, pendiente de asignar
  hilo_id uuid REFERENCES charlas_hilos(id) ON DELETE SET NULL,
  direccion text NOT NULL CHECK (direccion IN ('entrante','saliente')),

  message_id text UNIQUE,
  in_reply_to text,
  referencias text[],
  de text,
  para text[],
  cc text[],
  asunto text,
  texto text,
  html text,
  adjuntos jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{nombre, tipo, tamaño, ruta}]
  fecha timestamptz,
  idioma text,                            -- es | eu | mixto

  -- Entrantes
  clasificacion text,                     -- calendario_abierto | calendario_cerrado | pide_info | da_mes |
                                          -- pregunta_precio | lo_decide_otro | reenviado_a | pide_contacto_ayuntamiento |
                                          -- no_interesa | acuse_automatico | fuera_de_oficina | otro
  clasificacion_confianza numeric(3,2),
  datos_extraidos jsonb NOT NULL DEFAULT '{}'::jsonb, -- {mes, persona, email, n_grupos, nivel, motivo…}
  estado text NOT NULL DEFAULT 'nuevo' CHECK (estado IN ('nuevo','procesado','ignorado','error')),

  -- Salientes
  tarea_id uuid,                          -- la tarea que lo generó (FK blanda)
  tipo_salida text,                       -- recordatorio_1 | recordatorio_2 | mail_cierre | dossier | reactivacion | respuesta | mail_1 | mail_b…
  error text,

  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS charlas_mensajes_centro_idx ON charlas_mensajes (centro_id, fecha DESC);
CREATE INDEX IF NOT EXISTS charlas_mensajes_estado_idx ON charlas_mensajes (estado) WHERE estado = 'nuevo';
CREATE INDEX IF NOT EXISTS charlas_mensajes_de_idx ON charlas_mensajes (lower(de));

-- ------------------------------------------------------------
-- Tareas: la cola. El motor de decisión las crea (recordatorios,
-- cierres, reactivaciones) y el lector también (responder a lo que
-- entra). El nivel dice quién decide; el estado, dónde está.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS charlas_tareas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centro_id uuid NOT NULL REFERENCES charlas_centros(id) ON DELETE CASCADE,
  tipo text NOT NULL,                     -- recordatorio_1 | recordatorio_2 | mail_cierre | dossier | seguimiento_dossier |
                                          -- reactivacion | mail_1 | mail_b | respuesta | llamada_alain | revisar_bloqueo | otro
  nivel text NOT NULL CHECK (nivel IN ('A','B','C')),
  fecha_prevista date NOT NULL DEFAULT current_date,
  estado text NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','revisar','aprobada','enviada','hecha','descartada','error')),
  idioma text,
  mensaje_entrante_id uuid REFERENCES charlas_mensajes(id) ON DELETE SET NULL, -- a qué responde, si responde a algo
  contexto jsonb NOT NULL DEFAULT '{}'::jsonb,  -- lo que el redactor usó: resumen, clasificación, datos
  borrador_asunto text,
  borrador_texto text,
  texto_final text,                       -- lo que de verdad salió (= borrador si no se editó)
  adjuntar_dossier boolean NOT NULL DEFAULT false,
  mensaje_salida_id uuid REFERENCES charlas_mensajes(id) ON DELETE SET NULL,
  motivo text,                            -- al descartar: por qué
  error text,
  creado_en timestamptz NOT NULL DEFAULT now(),
  resuelto_en timestamptz,
  resuelto_por text                       -- sistema | alain
);
CREATE INDEX IF NOT EXISTS charlas_tareas_cola_idx ON charlas_tareas (estado, fecha_prevista);
CREATE INDEX IF NOT EXISTS charlas_tareas_centro_idx ON charlas_tareas (centro_id, creado_en DESC);

-- Enlaces blandos declarados ahora que existen las dos tablas.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'charlas_interacciones_mensaje_fk') THEN
    ALTER TABLE charlas_interacciones
      ADD CONSTRAINT charlas_interacciones_mensaje_fk FOREIGN KEY (mensaje_id) REFERENCES charlas_mensajes(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'charlas_mensajes_tarea_fk') THEN
    ALTER TABLE charlas_mensajes
      ADD CONSTRAINT charlas_mensajes_tarea_fk FOREIGN KEY (tarea_id) REFERENCES charlas_tareas(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ------------------------------------------------------------
-- Correcciones: cada vez que Alain edita un borrador antes de enviarlo.
-- Es la memoria de aprendizaje del redactor (§5 de la arquitectura).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS charlas_correcciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarea_id uuid REFERENCES charlas_tareas(id) ON DELETE SET NULL,
  tipo_mensaje text NOT NULL,
  idioma text,
  borrador text NOT NULL,
  final text NOT NULL,
  motivo text,                            -- una frase de Alain
  propuesta_prompt text,                  -- lo que el proceso semanal propone cambiar
  aplicada_en timestamptz,                -- cuándo entró en el prompt (null = aún no)
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS charlas_correcciones_tipo_idx ON charlas_correcciones (tipo_mensaje, creado_en DESC);

-- ------------------------------------------------------------
-- Cambios de estado: para medir el embudo en el tiempo sin releer
-- registros (de dónde a dónde, cuándo, quién lo movió).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS charlas_estado_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  centro_id uuid NOT NULL REFERENCES charlas_centros(id) ON DELETE CASCADE,
  de text,
  a text NOT NULL,
  origen text NOT NULL DEFAULT 'sistema',
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS charlas_estado_log_centro_idx ON charlas_estado_log (centro_id, creado_en);

-- ------------------------------------------------------------
-- Eventos: una fila por ficha de Eventos/ (cada contratación).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS charlas_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centro_id uuid REFERENCES charlas_centros(id) ON DELETE SET NULL,
  nombre text NOT NULL UNIQUE,            -- "Centro — AAAA-MM-DD"
  fecha_evento date,
  estado_evento text,                     -- confirmado | ejecutado | cancelado
  via_pago text,                          -- reserva | contrato
  formato text,                           -- aula | auditorio | 360
  n_sesiones int,
  importe_base numeric(10,2),
  importe_total numeric(10,2),
  importe_neto numeric(10,2),
  pago_reserva date,
  pago_resto date,
  factura_emitida date,
  vencimiento_factura date,
  fecha_cobro date,
  contacto_dia text,
  negocio text DEFAULT 'charlas',
  cuerpo text,                            -- el markdown de la ficha, debajo del frontmatter
  frontmatter jsonb NOT NULL DEFAULT '{}'::jsonb,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Métricas diarias: foto del embudo cada noche (las cinco hipótesis
-- en vivo sin recalcular en cada carga del panel).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS charlas_metricas_diarias (
  fecha date PRIMARY KEY,
  datos jsonb NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Configuración del sistema: topes, horarios, prompts. Clave → valor.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS charlas_config (
  clave text PRIMARY KEY,
  valor jsonb NOT NULL,
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

INSERT INTO charlas_config (clave, valor) VALUES
  ('tope_envios_dia', '40'),
  ('max_envios_centro_7d', '2'),
  ('horario_envio', '{"desde": "09:00", "hasta": "18:00", "dias": [1,2,3,4,5]}'),
  ('buzon', '"info@alainzulaika.com"'),
  ('umbral_confianza', '0.8'),
  ('racha_para_automatico', '20')
ON CONFLICT (clave) DO NOTHING;

-- ------------------------------------------------------------
-- Triggers: actualizado_en al vuelo, log de cambios de estado y
-- nivel C automático al entrar en conversación.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION charlas_touch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS charlas_centros_touch ON charlas_centros;
CREATE TRIGGER charlas_centros_touch BEFORE UPDATE ON charlas_centros
  FOR EACH ROW EXECUTE FUNCTION charlas_touch();

DROP TRIGGER IF EXISTS charlas_eventos_touch ON charlas_eventos;
CREATE TRIGGER charlas_eventos_touch BEFORE UPDATE ON charlas_eventos
  FOR EACH ROW EXECUTE FUNCTION charlas_touch();

CREATE OR REPLACE FUNCTION charlas_log_estado() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.estado IS DISTINCT FROM OLD.estado THEN
    INSERT INTO charlas_estado_log (centro_id, de, a, origen)
      VALUES (NEW.id, CASE WHEN TG_OP = 'UPDATE' THEN OLD.estado END, NEW.estado, NEW.actualizado_por);
    -- En conversación → solo Alain. No se baja solo: lo baja Alain desde el panel.
    IF NEW.estado LIKE '6%' THEN
      NEW.nivel_autonomia := 'C';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS charlas_centros_estado ON charlas_centros;
CREATE TRIGGER charlas_centros_estado BEFORE INSERT OR UPDATE ON charlas_centros
  FOR EACH ROW EXECUTE FUNCTION charlas_log_estado();

-- Sin políticas: solo la service key escribe y lee, como en el resto.
ALTER TABLE charlas_centros          ENABLE ROW LEVEL SECURITY;
ALTER TABLE charlas_contactos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE charlas_interacciones    ENABLE ROW LEVEL SECURITY;
ALTER TABLE charlas_hilos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE charlas_mensajes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE charlas_tareas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE charlas_correcciones     ENABLE ROW LEVEL SECURITY;
ALTER TABLE charlas_estado_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE charlas_eventos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE charlas_metricas_diarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE charlas_config           ENABLE ROW LEVEL SECURITY;
