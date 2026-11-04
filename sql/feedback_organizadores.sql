-- ============================================================
-- Magia · Valoraciones de organizadores (2026-10-26)
-- Página  alainzulaika.com/quetal   ·   Panel  /admin → Opiniones eventos
-- Ejecutar a mano en el SQL editor de Supabase.
-- ============================================================
--
-- Dos tablas: los enlaces que genero desde /admin, uno por evento, y las
-- respuestas. Una respuesta puede venir sin enlace (quien entra en /quetal
-- a pelo), así que link_id admite null.

CREATE TABLE IF NOT EXISTS feedback_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  -- 24 caracteres base64url de crypto.randomBytes(18): no se adivina.
  token text NOT NULL UNIQUE,

  tipo_evento     text NOT NULL CHECK (tipo_evento IN ('familiar','taller','fiestas','empresa','feria','externo','hosteleria','centro','privado')),
  nombre_evento   text NOT NULL,
  fecha_evento    date,
  entidad         text NOT NULL,
  contacto_nombre text NOT NULL,
  idioma          text NOT NULL DEFAULT 'eu' CHECK (idioma IN ('es','eu')),

  created_at    timestamptz DEFAULT now(),
  -- Se marca después de guardar la respuesta, nunca antes: si el insert
  -- falla, el enlace sigue sirviendo. Lo que impide dos respuestas es el
  -- índice único de feedback_organizadores.link_id.
  usado         boolean NOT NULL DEFAULT false,
  respondido_at timestamptz
);

CREATE TABLE IF NOT EXISTS feedback_organizadores (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),

  link_id uuid REFERENCES feedback_links (id) ON DELETE SET NULL,
  idioma  text NOT NULL CHECK (idioma IN ('es','eu')),

  tipo_evento   text NOT NULL CHECK (tipo_evento IN ('familiar','taller','fiestas','empresa','feria','externo','hosteleria','centro','privado')),
  nombre_evento text NOT NULL,
  fecha_evento  date,

  nombre  text NOT NULL,
  cargo   text,
  entidad text NOT NULL,
  email   text,

  nps           int  NOT NULL CHECK (nps BETWEEN 0 AND 10),
  testimonio    text NOT NULL,
  momento       text,
  dudas_previas text,

  -- Las preguntas del tipo de evento, en orden, con el enunciado y la
  -- respuesta tal como se mostraron, en el idioma en que se contestó:
  -- [{ "id": "fam_ninos", "pregunta": "…", "respuesta": "…" }, …]
  respuestas_tipo jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- 1–5; null = «No aplica» o sin contestar.
  val_comunicacion int CHECK (val_comunicacion BETWEEN 1 AND 5),
  val_promocional  int CHECK (val_promocional  BETWEEN 1 AND 5),
  val_puntualidad  int CHECK (val_puntualidad  BETWEEN 1 AND 5),
  val_adaptacion   int CHECK (val_adaptacion   BETWEEN 1 AND 5),
  comentario_trato text,

  repetir text CHECK (repetir IN ('proxima','otro_tipo','puede','no')),
  referido_nombre          text,
  referido_contacto        text,
  referido_permiso_mencion boolean NOT NULL DEFAULT false,

  -- Solo lo lee Alain. No se publica.
  mejora_privada text,

  permiso_publicacion text NOT NULL CHECK (permiso_publicacion IN ('completo','entidad','anonimo','no')),
  permiso_logo        boolean NOT NULL DEFAULT false,
  permiso_fotos       boolean NOT NULL DEFAULT false,
  privacidad_aceptada boolean NOT NULL CHECK (privacidad_aceptada),

  aviso_enviado boolean DEFAULT false,
  aviso_error   text,

  -- Solo del admin.
  estado             text NOT NULL DEFAULT 'nuevo' CHECK (estado IN ('nuevo','revisado','aprobado_por_cliente','publicado','archivado')),
  destacado          boolean NOT NULL DEFAULT false,
  testimonio_editado text,
  notas_internas     text
);

-- Una respuesta por enlace. Los null no chocan entre sí, así que las
-- respuestas sin enlace no tienen límite.
CREATE UNIQUE INDEX IF NOT EXISTS feedback_organizadores_link_id_key ON feedback_organizadores (link_id);
CREATE INDEX IF NOT EXISTS feedback_organizadores_created_at_idx ON feedback_organizadores (created_at DESC);

-- Sin políticas: solo la service key (los endpoints) lee y escribe.
ALTER TABLE feedback_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_organizadores ENABLE ROW LEVEL SECURITY;
