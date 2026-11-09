-- Canal de entrada de quien se apunta a «tu misión» (/tumision, /es/tumision).
-- Sale del parámetro ?e= de la URL: librillo (QR de los librillos de los talleres),
-- y los que se vayan añadiendo. Null = entró sin ?e= (tarjeta del show, enlaces antiguos).
-- Ejecutar a mano en el SQL editor de Supabase. Idempotente.
alter table mision_contactos add column if not exists canal text;
