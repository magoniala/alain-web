-- ============================================================
-- Entrenatzaile · Cuestionario PAR-Q+ (2026-10-20)
-- Página  entrenatzaile.alainzulaika.com/parq
-- Ejecutar a mano en el SQL editor de Supabase.
-- ============================================================
--
-- Quien lo rellena NO entra en la newsletter: la casilla solo cubre valorar
-- si puede entrenar y escribirle sobre ello.

CREATE TABLE IF NOT EXISTS parq_respuestas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  nombre   text NOT NULL,
  email    text NOT NULL,
  telefono text NOT NULL,

  -- apto | aptoTrasSeguimiento | consultar. Calculado en el servidor.
  resultado text NOT NULL,

  -- Las preguntas que se le hicieron, en orden, con su enunciado y su
  -- respuesta: [{ "id": "g1", "pregunta": "…", "respuesta": "si" }, …].
  -- Datos de salud (art. 9 RGPD).
  respuestas jsonb NOT NULL,

  consent_datos           boolean DEFAULT false,
  consent_datos_en        timestamptz,
  consent_datos_texto     text,
  consentimientos_version text,

  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  utm_content  text,
  utm_term     text,
  referrer     text,

  enviado_en timestamptz DEFAULT now(),

  aviso_enviado boolean DEFAULT false,
  aviso_error   text
);

CREATE INDEX IF NOT EXISTS parq_respuestas_email_idx ON parq_respuestas (email);

-- Sin políticas: solo la service key (el endpoint) lee y escribe.
ALTER TABLE parq_respuestas ENABLE ROW LEVEL SECURITY;
