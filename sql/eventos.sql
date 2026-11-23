-- Eventos de magia y su checklist del protocolo (23-11-2026).
--
-- El evento vive aquí y el vault (🎩 MAGIA/📅 EVENTOS) es su espejo
-- (scripts/crm/espejo-eventos.mjs, en la pasada horaria). Las reglas de los
-- pasos están en lib/eventos-protocolo.ts; el cron del servidor
-- (/api/charlas/cron → lib/eventos.ts) crea los pasos, las tarjetas de los
-- mensajes en la Bandeja de Magia y los avisos al móvil.
--
-- Quién manda en cada dato:
--   fecha_evento y estado_evento → el último que cambió (panel o vault); se
--     compara actualizado_en con espejado_en.
--   cada paso → igual, con eventos_pasos.actualizado_en.
--   el resto del frontmatter (pagos, show, testimonio…) → el vault; aquí solo
--     se guarda una copia en `frontmatter` para enseñarlo en el panel.
-- scripts/crm/post-evento.mjs sigue leyendo el vault: no cambia nada.

CREATE TABLE IF NOT EXISTS eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,              -- nombre de la nota del vault, sin .md ("AAAA-MM-DD Cliente — título")
  carril text NOT NULL DEFAULT 'magia',
  ficha_id uuid REFERENCES crm_fichas(id) ON DELETE SET NULL,
  cliente_ficha text,                       -- nombre de la ficha (el [[enlace]] del vault)
  fecha_evento date NOT NULL,
  estado_evento text NOT NULL DEFAULT 'confirmado',
  tipo text NOT NULL DEFAULT 'show' CHECK (tipo IN ('show', 'recurrente')),
  fecha_cierre date,                        -- de aquí cuentan el mensaje 1 y el cartel
  frontmatter jsonb NOT NULL DEFAULT '{}'::jsonb,
  creado_desde text NOT NULL DEFAULT 'vault' CHECK (creado_desde IN ('vault', 'panel')),
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  espejado_en timestamptz
);
CREATE INDEX IF NOT EXISTS eventos_fecha_idx ON eventos (fecha_evento);
CREATE INDEX IF NOT EXISTS eventos_ficha_idx ON eventos (ficha_id);

CREATE TABLE IF NOT EXISTS eventos_pasos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  clave text NOT NULL,                      -- mensaje_1 | cartel | pago_80 | guion | material | compartido | mensaje_7dias | ensayo | mensaje_vispera | maleta | post
  tipo text NOT NULL CHECK (tipo IN ('mensaje', 'interno')),
  titulo text NOT NULL,
  fecha_ideal date NOT NULL,
  fecha_limite date NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'hecho', 'no_aplica')),
  hecho_en date,
  hecho_por text,                           -- panel | bandeja | vault | sistema
  tarea_id uuid REFERENCES crm_tareas(id) ON DELETE SET NULL,
  aplazado_hasta date,
  aviso_limite_en timestamptz,
  nota text,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evento_id, clave)
);
CREATE INDEX IF NOT EXISTS eventos_pasos_pend_idx ON eventos_pasos (estado, fecha_ideal);

ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos_pasos ENABLE ROW LEVEL SECURITY;
