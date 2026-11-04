-- ============================================================
-- Paso de la secuencia nurture a la newsletter cuando el lead reserva la
-- Hoja de Ruta (botón en /admin → Nurture → Contactos).
-- Ejecutar a mano en el SQL editor de Supabase.
-- ============================================================
--
-- Todas nacen vacías: para cualquier contacto que no haya pasado por el
-- botón, nada cambia.
--
--   hoja_ruta_reservada_en     la marca. También hace idempotente el botón.
--   transicion_para            día (Europe/Madrid) en que toca el mail de
--                              transición, a las 19:15.
--   transicion_enviada_en      solo tras confirmarlo Mailjet. Hasta el día
--                              siguiente a esta fecha no recibe newsletter.
--   transicion_enviando_desde  candado anti-duplicado del envío.

ALTER TABLE newsletter_contactos
  ADD COLUMN IF NOT EXISTS hoja_ruta_reservada_en timestamptz,
  ADD COLUMN IF NOT EXISTS transicion_para date,
  ADD COLUMN IF NOT EXISTS transicion_enviada_en timestamptz,
  ADD COLUMN IF NOT EXISTS transicion_enviando_desde timestamptz;

-- El mail de transición: nurture, posición -3 (fuera de la progresión
-- normal, como el -1 y el -2). Se edita luego desde el panel; si ya existe
-- no se pisa.
INSERT INTO secuencia_mails (secuencia, idioma, posicion, asunto, cuerpo_html, formato, remitente, activo)
VALUES (
  'nurture',
  'es',
  -3,
  'Lo que te va a llegar a partir de ahora',
  E'{{saludo}},\n\nComo ya tienes tu Hoja de Ruta reservada te he sacado de los correos que te animaban a pedirla.\nNo tiene sentido que te sigan llegando.\n\nA partir de mañana te llegará lo que escribo cada día.\nPorque escribo cada día, sí.\nLos temas cambian, vete a saber lo que te encuentras mañana.\nPor eso te aviso.\n\nTe las enviaré desde newsletter@alainzulaika.com\nAñádela a tus contactos para que no se te vaya a spam.\n\n\nSi en algún momento no te interesa, abajo tienes el botón para darte de baja en un clic.\nNos vemos en la llamada.',
  'texto',
  'newsletter@alainzulaika.com',
  true
)
ON CONFLICT (secuencia, posicion, idioma) DO NOTHING;
