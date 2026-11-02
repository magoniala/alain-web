-- ============================================================
-- Sistema automático · FASE 7a: app de ENTRENATZAILE (lado de Alain) · 2026-11-02
-- Ejecutar a mano en el SQL editor de Supabase. Idempotente.
--
-- Clientes de entrenamiento con su plan (trimestre o bloque), sus sesiones
-- tipo, las semanas programadas con sus sesiones y ejercicios, lo que registra
-- el cliente (series y formularios), la cola de avisos del protocolo y, para
-- la fase 7c, las propuestas de la IA y las correcciones de Alain.
-- Diseño: "Sistema · Arquitectura v3 — app de Entrenatzaile".
-- Nada de esto envía nada: los avisos quedan en cola hasta la fase 7b.
-- ============================================================

CREATE TABLE IF NOT EXISTS ent_clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  email text,
  telefono text,
  idioma text NOT NULL DEFAULT 'es',             -- es | eu
  estado text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','pausa','baja')),
  zonas_riesgo text,                             -- "espalda, clavícula, codos"
  reglas text[] NOT NULL DEFAULT '{}',           -- frases que la IA respeta siempre ("Fuera la búlgara")
  material text,                                 -- lo que tiene en casa / gimnasio
  aviso_canal text NOT NULL DEFAULT 'push' CHECK (aviso_canal IN ('push','whatsapp','email','ninguno')),
  token text UNIQUE,                             -- enlace personal de la app (fase 7b)
  ficha_vault text,                              -- nombre de la nota del cliente en el vault
  notas text,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

-- Plan vigente: trimestre (Juanan T2) o bloque (Olatz B2).
CREATE TABLE IF NOT EXISTS ent_planes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES ent_clientes(id) ON DELETE CASCADE,
  nombre text NOT NULL,                          -- "T2", "B2"
  inicio date NOT NULL,
  fin date,
  frecuencia text,
  activo boolean NOT NULL DEFAULT true,
  metas jsonb NOT NULL DEFAULT '[]'::jsonb,      -- [{meta, ahora, hitos:[...], minimo}]
  fases jsonb NOT NULL DEFAULT '[]'::jsonb,      -- [{semanas:"1-4", fechas, fase, que_pasa}]
  reglas_carga text,                             -- Markdown
  markdown text,                                 -- la nota del plan tal cual (brújula para la IA)
  nota_vault text,                               -- nombre de la nota en el vault
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, nombre)
);

-- Sesiones tipo del plan (A Fuerza, B Músculo, C Una pierna…).
CREATE TABLE IF NOT EXISTS ent_sesiones_tipo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES ent_planes(id) ON DELETE CASCADE,
  clave text NOT NULL,                           -- A | B | C
  nombre text NOT NULL,                          -- "A · Fuerza"
  dia_habitual smallint,                         -- 1 = lunes … 7 = domingo
  duracion_min int,
  foco text,
  orden int NOT NULL DEFAULT 0,
  UNIQUE (plan_id, clave)
);

-- Semana programada. Una semana no está "programada" hasta que tiene sus
-- avisos (regla fija del protocolo desde el 2-11-2026).
CREATE TABLE IF NOT EXISTS ent_semanas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES ent_planes(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES ent_clientes(id) ON DELETE CASCADE,
  numero int NOT NULL,                           -- semana 1, 2… del plan
  lunes date NOT NULL,
  fase text,
  rir_objetivo text,                             -- "3", "1-2"
  titulo text,                                   -- "Reentrada"
  notas text,                                    -- Markdown: intro de la semana, calentamiento común…
  estado text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador','programada','cerrada')),
  programada_en timestamptz,
  resumen text,                                  -- resumen del domingo, cuando se escribe
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, numero)
);
CREATE INDEX IF NOT EXISTS ent_semanas_cliente_idx ON ent_semanas (cliente_id, lunes);

CREATE TABLE IF NOT EXISTS ent_sesiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semana_id uuid NOT NULL REFERENCES ent_semanas(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES ent_clientes(id) ON DELETE CASCADE,
  sesion_tipo_id uuid REFERENCES ent_sesiones_tipo(id) ON DELETE SET NULL,
  clave text,                                    -- A | B | C (copia, por si cambia el tipo)
  nombre text NOT NULL,
  fecha date NOT NULL,
  duracion_min int,
  foco text,                                     -- el foco del día en una frase (va en el recordatorio)
  calentamiento text,
  notas text,                                    -- para el cliente
  estado text NOT NULL DEFAULT 'programada' CHECK (estado IN ('programada','hecha','incompleta','saltada','movida')),
  hecha_en timestamptz,
  -- Formulario post-sesión (resumen; las respuestas completas van en ent_formularios):
  rpe numeric(3,1),
  minutos int,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ent_sesiones_semana_idx ON ent_sesiones (semana_id, fecha);
CREATE INDEX IF NOT EXISTS ent_sesiones_cliente_idx ON ent_sesiones (cliente_id, fecha);

-- Ejercicios prescritos en una sesión, con los campos que se le piden al cliente.
CREATE TABLE IF NOT EXISTS ent_ejercicios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sesion_id uuid NOT NULL REFERENCES ent_sesiones(id) ON DELETE CASCADE,
  orden int NOT NULL DEFAULT 0,
  nombre text NOT NULL,
  series int,
  reps text,                                     -- "6", "5 por pierna", "8-12", "3 dejando 2-3"
  carga text,                                    -- "50 kg", "~10 kg por mano", "mochila ~15 kg"
  tempo text,                                    -- "baja en 3 s, pausa 1 s"
  descanso text,                                 -- "2-3'", "90\""
  rir text,
  notas text,                                    -- indicaciones al cliente
  video boolean NOT NULL DEFAULT false,          -- hay que grabar
  superserie text,                               -- etiqueta común para ejercicios en superserie
  campos text[] NOT NULL DEFAULT '{reps,peso,rir}', -- qué registra el cliente: reps, peso, rir, tempo, nota, video, tiempo, lado
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ent_ejercicios_sesion_idx ON ent_ejercicios (sesion_id, orden);

-- Lo que registra el cliente, serie a serie (fase 7b).
CREATE TABLE IF NOT EXISTS ent_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ejercicio_id uuid NOT NULL REFERENCES ent_ejercicios(id) ON DELETE CASCADE,
  sesion_id uuid NOT NULL REFERENCES ent_sesiones(id) ON DELETE CASCADE,
  serie int NOT NULL,
  lado text,                                     -- izq | der (ejercicios a una pierna / brazo)
  reps numeric(5,1),
  peso numeric(6,2),
  rir numeric(3,1),
  tiempo_s int,
  tempo text,
  nota text,
  video_url text,
  origen text NOT NULL DEFAULT 'cliente',        -- cliente | alain | importado
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ent_series_ejercicio_idx ON ent_series (ejercicio_id, serie);

-- Formularios post-sesión y de recuperación (D+1 14:00).
CREATE TABLE IF NOT EXISTS ent_formularios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES ent_clientes(id) ON DELETE CASCADE,
  sesion_id uuid REFERENCES ent_sesiones(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('post','recuperacion')),
  respuestas jsonb NOT NULL DEFAULT '{}'::jsonb,
  alerta text,                                   -- lo que dispara una regla del protocolo (molestia ≥4, agujetas 4-5…)
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ent_formularios_cliente_idx ON ent_formularios (cliente_id, creado_en DESC);

-- Cola de avisos del protocolo. En la fase 7a solo se generan; se envían desde la 7b.
CREATE TABLE IF NOT EXISTS ent_avisos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES ent_clientes(id) ON DELETE CASCADE,
  semana_id uuid REFERENCES ent_semanas(id) ON DELETE CASCADE,
  sesion_id uuid REFERENCES ent_sesiones(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('aviso_dia_antes','recordatorio_dia','si_no_registra','formulario_post','formulario_recuperacion','resumen_domingo','manual')),
  programado_para timestamptz NOT NULL,
  canal text NOT NULL DEFAULT 'push' CHECK (canal IN ('push','whatsapp','email','app')),
  texto text,
  estado text NOT NULL DEFAULT 'programado' CHECK (estado IN ('borrador','programado','enviado','omitido','cancelado','error')),
  editado boolean NOT NULL DEFAULT false,
  enviado_en timestamptz,
  error text,
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ent_avisos_cola_idx ON ent_avisos (estado, programado_para);
CREATE INDEX IF NOT EXISTS ent_avisos_semana_idx ON ent_avisos (semana_id, programado_para);

-- Fase 7c: propuesta de la siguiente sesión (IA) y lo que Alain cambia.
CREATE TABLE IF NOT EXISTS ent_propuestas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES ent_clientes(id) ON DELETE CASCADE,
  sesion_origen_id uuid REFERENCES ent_sesiones(id) ON DELETE SET NULL,   -- la sesión cerrada que la dispara
  sesion_destino_id uuid REFERENCES ent_sesiones(id) ON DELETE SET NULL,  -- la que se crea al aprobar
  propuesta jsonb NOT NULL,                      -- {nombre, fecha, ejercicios:[...], por_que:[...]}
  final jsonb,                                   -- lo que Alain aprobó
  estado text NOT NULL DEFAULT 'revisar' CHECK (estado IN ('revisar','aprobada','descartada','error')),
  motivo text,
  error text,
  creado_en timestamptz NOT NULL DEFAULT now(),
  resuelto_en timestamptz
);
CREATE TABLE IF NOT EXISTS ent_correcciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES ent_clientes(id) ON DELETE SET NULL,
  propuesta_id uuid REFERENCES ent_propuestas(id) ON DELETE SET NULL,
  ejercicio text,
  antes text,
  despues text,
  motivo text,
  creado_en timestamptz NOT NULL DEFAULT now()
);

-- Config (en la tabla común, prefijo ent_).
INSERT INTO charlas_config (clave, valor) VALUES
  ('ent_avisos_envio', 'false'),                 -- true en la fase 7b: el cron envía los avisos que tocan
  ('ent_horas', '{"dia_antes":"20:00","recordatorio":"09:00","si_no_registra":"21:00","recuperacion":"14:00","resumen_domingo":"19:00"}')
ON CONFLICT (clave) DO NOTHING;

-- Fecha de actualización automática.
CREATE OR REPLACE FUNCTION ent_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.actualizado_en = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS ent_clientes_touch ON ent_clientes;
CREATE TRIGGER ent_clientes_touch BEFORE UPDATE ON ent_clientes FOR EACH ROW EXECUTE FUNCTION ent_touch();
DROP TRIGGER IF EXISTS ent_planes_touch ON ent_planes;
CREATE TRIGGER ent_planes_touch BEFORE UPDATE ON ent_planes FOR EACH ROW EXECUTE FUNCTION ent_touch();
DROP TRIGGER IF EXISTS ent_semanas_touch ON ent_semanas;
CREATE TRIGGER ent_semanas_touch BEFORE UPDATE ON ent_semanas FOR EACH ROW EXECUTE FUNCTION ent_touch();
DROP TRIGGER IF EXISTS ent_sesiones_touch ON ent_sesiones;
CREATE TRIGGER ent_sesiones_touch BEFORE UPDATE ON ent_sesiones FOR EACH ROW EXECUTE FUNCTION ent_touch();

-- Todo cerrado al público: el panel y la app entran por el servidor con la clave de servicio.
ALTER TABLE ent_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ent_planes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ent_sesiones_tipo ENABLE ROW LEVEL SECURITY;
ALTER TABLE ent_semanas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ent_sesiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE ent_ejercicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE ent_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE ent_formularios ENABLE ROW LEVEL SECURITY;
ALTER TABLE ent_avisos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ent_propuestas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ent_correcciones ENABLE ROW LEVEL SECURITY;
