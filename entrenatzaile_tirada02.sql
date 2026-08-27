-- ============================================================
-- Entrenatzaile · Tirada 02 (2026-08-24)
-- Landing de entrada  entrenatzaile.alainzulaika.com/espalda
-- Landing de reserva  entrenatzaile.alainzulaika.com/hoja-de-ruta
-- Ejecutar a mano en el SQL editor de Supabase.
-- ============================================================

-- El teléfono se pide por primera vez en estas dos landings. El
-- consentimiento para usarlo por WhatsApp NO vive aquí: vive en la fila del
-- formulario que lo recogió (espalda_leads), junto al texto literal de la
-- casilla que la persona marcó.
ALTER TABLE newsletter_contactos
  ADD COLUMN IF NOT EXISTS telefono text;

-- ============================================================
-- Leads de la landing /espalda
-- ============================================================
CREATE TABLE IF NOT EXISTS espalda_leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  email    text NOT NULL,
  telefono text,
  edad     int,
  genero   text,

  -- Las tres respuestas de texto libre. Pueden contener datos de salud
  -- (art. 9 RGPD): no salen nunca de esta tabla ni del email de aviso.
  respuesta_1 text,
  respuesta_2 text,
  respuesta_3 text,

  -- Texto literal de las tres preguntas tal y como las vio el lead, para
  -- que dentro de un año se pueda leer una respuesta y saber a qué
  -- contestaba aunque el copy de la landing haya cambiado.
  preguntas_mostradas jsonb,

  -- Tres casillas separadas, sin premarcar. De cada una se guarda el valor,
  -- cuándo se marcó y el texto exacto que se le mostró.
  consent_datos            boolean DEFAULT false,
  consent_datos_en         timestamptz,
  consent_datos_texto      text,
  consent_whatsapp         boolean DEFAULT false,
  consent_whatsapp_en      timestamptz,
  consent_whatsapp_texto   text,
  consent_newsletter       boolean DEFAULT false,
  consent_newsletter_en    timestamptz,
  consent_newsletter_texto text,
  consentimientos_version  text,

  -- Origen. Las respuestas nunca viajan por aquí: solo UTM y referrer.
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  utm_content  text,
  utm_term     text,
  referrer     text,

  enviado_en timestamptz DEFAULT now(),

  -- Contacto de newsletter_contactos con el que se correspondió el alta, y
  -- qué pasó de verdad con el disparo del M0 (visible con una consulta, sin
  -- depender de los logs de Vercel).
  contacto_id  uuid,
  alta_estado  text,
  m0_enviado   boolean DEFAULT false,
  m0_error     text
);

CREATE INDEX IF NOT EXISTS espalda_leads_email_idx ON espalda_leads (email);

-- ============================================================
-- Reservas de la landing /hoja-de-ruta
-- ============================================================
CREATE TABLE IF NOT EXISTS hoja_ruta_reservas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  nombre   text,
  email    text NOT NULL,
  telefono text,

  -- Qué versión de la landing estaba viendo: 'ventana' (?ventana=1) o
  -- 'evergreen'. Es lo que vio el lead, no su elegibilidad real.
  variante text,

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

  -- El lead se guarda ANTES de que elija hueco: si abandona el calendario,
  -- la fila existe igual.
  creado_en timestamptz DEFAULT now(),

  -- Hueco elegido (cadena opaca: sirve igual para un selector propio que
  -- para el identificador que devuelva Calendly) y cuándo lo eligió.
  hueco    text,
  hueco_en timestamptz,

  -- Elegibilidad calculada en servidor contra newsletter_contactos. No se
  -- le muestra al lead ni bloquea nada: solo viaja en el asunto del aviso.
  -- 'elegible' | 'fuera_ventana' | 'no_en_lista'
  elegibilidad        text,
  dias_desde_alta     int,
  fecha_alta_contacto timestamptz,
  -- Día de su ventana (1 = mismo día del alta … 8 = último) en que reserva.
  ventana_dia         int,

  aviso_enviado boolean DEFAULT false,
  aviso_error   text,

  -- Aviso al propio lead que empezó a reservar y no llegó a elegir hueco.
  -- Igual que en el resto del sistema, el marcador de "enviado de verdad"
  -- (aviso_abandono_enviado) va separado del candado anti-carrera
  -- (aviso_abandono_enviando_desde) y solo se pone a true tras confirmar
  -- el envío, nunca antes.
  aviso_abandono_enviado       boolean DEFAULT false,
  aviso_abandono_en            timestamptz,
  aviso_abandono_enviando_desde timestamptz,
  aviso_abandono_error         text
);

CREATE INDEX IF NOT EXISTS hoja_ruta_reservas_email_idx ON hoja_ruta_reservas (email);

-- Un hueco, una reserva. Es la base de datos quien impide la doble reserva
-- si dos personas eligen el mismo hueco a la vez; el endpoint devuelve un
-- 409 y le pide que elija otro, en vez de aceptar los dos en silencio.
CREATE UNIQUE INDEX IF NOT EXISTS hoja_ruta_reservas_hueco_key
  ON hoja_ruta_reservas (hueco)
  WHERE hueco IS NOT NULL;

-- ============================================================
-- Ampliación 2026-08-24 (2): disponibilidad real
-- Máximo una videollamada al día y cinco por semana natural.
-- ============================================================

-- El tope de "una al día" lo impone la base de datos, no solo el endpoint:
-- dos personas eligiendo huecos DISTINTOS del MISMO día a la vez pasarían el
-- índice de arriba sin problema.
--
-- Se indexa left(hueco, 10) y no una conversión de zona horaria porque
-- `hueco::timestamptz AT TIME ZONE ...` no es IMMUTABLE (el cast depende del
-- TimeZone de la sesión) y Postgres no lo admite en un índice. No hace falta:
-- huecoISO() escribe siempre 'YYYY-MM-DDTHH:MM:SS±HH:MM' con la fecha ya en
-- hora de Madrid, así que esos diez primeros caracteres SON el día natural.
--
-- Eso ata este índice al formato que genera lib/entrenatzaile-huecos.ts: si
-- algún día se guardan huecos en UTC ('...Z'), este índice contaría mal.
CREATE UNIQUE INDEX IF NOT EXISTS hoja_ruta_reservas_dia_key
  ON hoja_ruta_reservas ((left(hueco, 10)))
  WHERE hueco IS NOT NULL;

-- Llamadas anuladas desde el panel. No se borra la fila: se libera el hueco
-- y se deja constancia. Es importante que el cron de "reservas a medias" las
-- excluya, o al anular una llamada le llegaría al lead un correo diciéndole
-- que se dejó la reserva sin terminar.
ALTER TABLE hoja_ruta_reservas
  ADD COLUMN IF NOT EXISTS cancelada_en       timestamptz,
  ADD COLUMN IF NOT EXISTS cancelacion_motivo text;

-- Bloqueos manuales desde el panel: un día entero (hora_desde y hora_hasta a
-- NULL) o una franja concreta de ese día.
CREATE TABLE IF NOT EXISTS hoja_ruta_bloqueos (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  dia        date NOT NULL,
  hora_desde time,
  hora_hasta time,
  motivo     text,
  creado_en  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hoja_ruta_bloqueos_dia_idx ON hoja_ruta_bloqueos (dia);

-- ============================================================
-- Ampliación 2026-08-27: qué pasó de verdad con el evento de Meta.
--
-- Sin esto, un envío omitido por falta de consentimiento y uno rechazado por
-- Meta son igual de invisibles: los dos "no aparecen" y no hay forma de
-- distinguirlos sin acceso a los logs.
-- ============================================================

ALTER TABLE espalda_leads       ADD COLUMN IF NOT EXISTS meta_evento text;
ALTER TABLE hoja_ruta_reservas  ADD COLUMN IF NOT EXISTS meta_evento text;

-- Nombre del lead: el formulario de /espalda no lo pedía al principio.
ALTER TABLE espalda_leads ADD COLUMN IF NOT EXISTS nombre text;
