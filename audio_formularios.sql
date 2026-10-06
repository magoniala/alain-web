-- ============================================================
-- Entrenatzaile · Formulario de audio (2026-10-06)
-- Página  entrenatzaile.alainzulaika.com/audio
-- Ejecutar a mano en el SQL editor de Supabase.
-- ============================================================
--
-- Quien rellena este formulario NO entra en la newsletter ni en ninguna
-- secuencia: la casilla solo cubre preparar y enviar el audio, así que no hay
-- alta en newsletter_contactos ni columnas de secuencia aquí.

CREATE TABLE IF NOT EXISTS audio_formularios (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Contacto. El teléfono no es un extra: es el canal por el que se entrega
  -- el audio, y por eso es obligatorio en el formulario.
  nombre   text NOT NULL,
  email    text NOT NULL,
  telefono text NOT NULL,

  -- Opciones cerradas. Se guardan como el texto que se mostró, no como un
  -- código, para que una fila se pueda leer sin tener que mirar el código.
  edad_rango     text,
  frecuencia     text,
  ejercicio      text,
  tiempo_semanal text,

  -- Días a la semana que entrena. Vacío cuando dijo que no hace nada.
  dias_semana int,
  -- Qué deporte, solo cuando eligió "Otro deporte".
  ejercicio_detalle text,

  -- Texto libre. Puede contener datos de salud (art. 9 RGPD): no sale nunca
  -- de esta tabla ni del correo de aviso.
  ultimo_episodio text,
  deseo           text,
  extra           text,

  -- Señales de alarma marcadas, tal cual. Array porque se pueden marcar
  -- varias; bandera_roja es la lectura rápida: true si marcó cualquiera que
  -- no sea "Ninguna".
  banderas     jsonb,
  bandera_roja boolean DEFAULT false,

  -- Texto literal de los enunciados tal y como los vio, para que dentro de un
  -- año se pueda leer una respuesta y saber a qué contestaba aunque el copy
  -- haya cambiado.
  preguntas_mostradas jsonb,

  -- Una sola casilla, sin premarcar, obligatoria. Se guarda el valor, cuándo
  -- se marcó y el texto exacto que se le mostró.
  consent_datos           boolean DEFAULT false,
  consent_datos_en        timestamptz,
  consent_datos_texto     text,
  consentimientos_version text,

  -- Origen. Las respuestas nunca viajan por aquí: solo UTM y referrer.
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  utm_content  text,
  utm_term     text,
  referrer     text,

  enviado_en timestamptz DEFAULT now(),

  -- Qué salió de los dos correos. Si el aviso falla, la fila lo dice: es la
  -- única forma de enterarse de que hay un formulario sin contestar.
  confirmacion_enviada boolean DEFAULT false,
  aviso_enviado        boolean DEFAULT false,
  aviso_error          text
);

CREATE INDEX IF NOT EXISTS audio_formularios_email_idx ON audio_formularios (email);

-- Los que hay que atender primero.
CREATE INDEX IF NOT EXISTS audio_formularios_bandera_idx
  ON audio_formularios (bandera_roja) WHERE bandera_roja;
