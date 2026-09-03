-- ============================================================
-- Hoja de Ruta · cobro con Stripe (2026-09-02)
-- Landing de pago    entrenatzaile.alainzulaika.com/hoja-de-ruta
-- Landing de pago    entrenatzaile.alainzulaika.com/hoja-de-ruta/capacidades
-- Ejecutar a mano en el SQL editor de Supabase.
--
-- Hasta ahora el cobro era un Payment Link escrito en el correo de reserva y
-- una promesa ("te guardo el hueco 24 horas") que no cumplía nadie: no había
-- forma de saber quién había pagado ni de liberar el hueco de quien no. Esto
-- añade el estado del pago a la reserva que YA existe.
--
-- No se crea ninguna tabla de huecos. Los huecos siguen siendo un cálculo
-- (lib/entrenatzaile-huecos.ts) y el apartado atómico lo siguen imponiendo
-- los dos índices únicos de hoja_ruta_reservas: escribir `hueco` en la fila
-- ES apartar el hueco. Aquí no se toca nada de eso.
-- ============================================================

-- ============================================================
-- Estado del pago en la reserva
-- ============================================================
--
-- pago_estado es NULL cuando el cobro NO aplica: la llamada gratuita de la
-- ventana de bienvenida. Un NULL y un 'pendiente' no son lo mismo y conviene
-- poder distinguirlos de un vistazo: el primero no espera dinero, el segundo
-- sí. Por eso no hay DEFAULT.
--
--   NULL                   gratuita (variante 'ventana' y elegibilidad real)
--   'pendiente'            hueco apartado, sesión de Checkout viva
--   'pagado'               confirmado POR EL WEBHOOK, nunca por la página de gracias
--   'expirado'             no pagó a tiempo; el hueco se ha liberado
--   'pagado_fuera_de_plazo' pagó justo después de liberarse el hueco (ver abajo)
--
ALTER TABLE hoja_ruta_reservas
  ADD COLUMN IF NOT EXISTS pago_estado              text,
  ADD COLUMN IF NOT EXISTS pago_importe_cent        int,
  ADD COLUMN IF NOT EXISTS stripe_session_id        text,
  ADD COLUMN IF NOT EXISTS stripe_session_url       text,
  ADD COLUMN IF NOT EXISTS stripe_session_expira_en timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent    text,
  ADD COLUMN IF NOT EXISTS pagado_en                timestamptz,
  ADD COLUMN IF NOT EXISTS pago_error               text;

-- Marcador de "ya se le mandó el correo de pago confirmado", separado del
-- estado del pago. Es la misma norma que ya siguen aviso_enviado y
-- aviso_abandono_enviado en esta tabla: el estado dice qué pasó con el
-- dinero, esto dice qué se envió. Si Mailjet falla, el pago sigue siendo
-- 'pagado' y el correo se puede reintentar sin tocar el estado.
ALTER TABLE hoja_ruta_reservas
  ADD COLUMN IF NOT EXISTS pago_confirmacion_enviada boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pago_confirmacion_error   text;

-- Correo de "he liberado tu hueco", que sale al expirar sin pagar. Mismo
-- patrón: marcador de enviado aparte del estado.
ALTER TABLE hoja_ruta_reservas
  ADD COLUMN IF NOT EXISTS aviso_liberado_enviado boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS aviso_liberado_en      timestamptz,
  ADD COLUMN IF NOT EXISTS aviso_liberado_error   text;

-- Una sesión de Checkout, una reserva. Si por una carrera o un reintento se
-- crearan dos sesiones para la misma reserva, o se intentara colgar una
-- sesión de dos reservas, esto lo corta en la base de datos en vez de
-- dejarlo pasar en silencio. Parcial porque las reservas gratuitas y las que
-- están a medias no tienen sesión.
CREATE UNIQUE INDEX IF NOT EXISTS hoja_ruta_reservas_stripe_session_key
  ON hoja_ruta_reservas (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

-- El cron de cada 15 min busca exactamente esto: pagos pendientes cuya
-- sesión ya venció. Parcial para que el índice sea diminuto: solo contiene
-- las reservas que están esperando dinero ahora mismo.
CREATE INDEX IF NOT EXISTS hoja_ruta_reservas_pago_pendiente_idx
  ON hoja_ruta_reservas (stripe_session_expira_en)
  WHERE pago_estado = 'pendiente';

-- ============================================================
-- Eventos de Stripe ya procesados (idempotencia)
-- ============================================================
--
-- Stripe reenvía los eventos: ante un 500, ante un timeout, y a mano desde el
-- dashboard. Un reenvío no puede volver a mandarle el correo de confirmación
-- al lead.
--
-- La defensa de verdad es esta tabla, no el update condicionado. El update
-- condicionado (... WHERE pago_estado = 'pendiente') protege contra que el
-- MISMO evento se procese dos veces, pero no contra dos eventos DISTINTOS
-- que cuentan lo mismo, ni contra dos entregas simultáneas del mismo evento
-- llegando a dos instancias de la función a la vez.
--
-- El id de Stripe (evt_...) como clave primaria convierte eso en un insert
-- que o entra o choca: si choca, el evento ya está atendido y se responde 200
-- sin hacer nada. Se inserta ANTES de procesar, no después.
CREATE TABLE IF NOT EXISTS stripe_eventos (
  id          text PRIMARY KEY,   -- evt_...
  tipo        text,
  -- Reserva a la que afectó, cuando se pudo resolver. Solo para poder mirar
  -- qué pasó sin salir de Supabase; no se usa para decidir nada.
  reserva_id  uuid,
  recibido_en timestamptz DEFAULT now()
);

-- ============================================================
-- Nota sobre 'pagado_fuera_de_plazo'
-- ============================================================
--
-- Caso real, no teórico: el cron expira la sesión y libera el hueco en el
-- mismo momento en que alguien está terminando de pagar. Llega entonces un
-- checkout.session.completed sobre una reserva que ya está 'expirado' y cuyo
-- hueco puede haberse dado a otra persona.
--
-- Lo que NO se hace es sobrescribir: eso reasignaría un hueco que ya es de
-- otro, o resucitaría una reserva liberada. Se marca así, se guarda el
-- payment_intent para poder devolver el dinero con un clic, y salta el aviso
-- a Alain. Un cobro sin hueco es un problema de dinero y lo resuelve una
-- persona, no un update.

-- ============================================================
-- Comprobación
-- ============================================================
-- SELECT column_name, data_type
--   FROM information_schema.columns
--  WHERE table_name = 'hoja_ruta_reservas'
--    AND (column_name LIKE 'pago%' OR column_name LIKE 'stripe%'
--         OR column_name LIKE 'aviso_liberado%')
--  ORDER BY column_name;

-- ============================================================
-- Ampliación (Bloque 2): liberación de huecos vencidos
-- ============================================================
--
-- Candado del correo de liberación, separado del marcador de "enviado de
-- verdad". Es la misma pareja que ya usan aviso_abandono_enviado /
-- aviso_abandono_enviando_desde: el candado se suelta tanto si el envío sale
-- bien como si falla, y solo lo segundo pone el marcador a true. Sin esto
-- habría que elegir entre marcar antes de enviar (y perder el correo si
-- Mailjet falla) o poder mandarlo dos veces.
ALTER TABLE hoja_ruta_reservas
  ADD COLUMN IF NOT EXISTS aviso_liberado_enviando_desde timestamptz;

-- Qué hueco tenía apartado antes de que se le liberara.
--
-- Liberar pone `hueco` a NULL, que es lo que hace que el calendario vuelva a
-- ofrecerlo. Pero si esa persona paga un segundo después (la sesión de Stripe
-- y el cron cruzándose), el aviso de "cobro sin hueco" tiene que poder decir
-- qué llamada tenía para poder recolocarla; con el hueco ya borrado, ese
-- aviso llegaría diciendo "—" y habría que ir a buscarlo a Stripe.
ALTER TABLE hoja_ruta_reservas
  ADD COLUMN IF NOT EXISTS hueco_liberado text;
