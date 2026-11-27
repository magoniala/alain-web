-- ============================================================
-- Plataforma /magia-tailerrak: castellano (2026-11-27)
-- Ejecutar a mano en el SQL editor de Supabase. Idempotente: se puede
-- ejecutar más de una vez. Solo rellena campos VACÍOS, así que no pisa lo que
-- se haya corregido después en /admin › Magia-tailerrak.
-- ============================================================
--
-- Cada juego (y el regalo) guarda su texto y su vídeo en castellano al lado
-- del euskera. Columna vacía = la web en castellano muestra el euskera; sin
-- vídeo en castellano = muestra el de euskera con un aviso (y al revés).
-- Mientras no se ejecute, la web funciona igual que antes (todo en euskera,
-- también con el selector en ES) y el panel avisa.

ALTER TABLE magia_edukiak    ADD COLUMN IF NOT EXISTS izenburua_es text;
ALTER TABLE magia_edukiak    ADD COLUMN IF NOT EXISTS etiketa_es   text;
ALTER TABLE magia_edukiak    ADD COLUMN IF NOT EXISTS sarrera_es   text;
ALTER TABLE magia_edukiak    ADD COLUMN IF NOT EXISTS materiala_es text;
ALTER TABLE magia_edukiak    ADD COLUMN IF NOT EXISTS youtube_es   text;  -- id de 11 caracteres
ALTER TABLE magia_liburutxoak ADD COLUMN IF NOT EXISTS etiketa_es  text;  -- «6-7 años»

-- ---------- Librillos ----------
UPDATE magia_liburutxoak SET etiketa_es = '6-7 años'  WHERE slug = '6-7'  AND etiketa_es IS NULL;
UPDATE magia_liburutxoak SET etiketa_es = '8-10 años' WHERE slug = '8-10' AND etiketa_es IS NULL;
UPDATE magia_liburutxoak SET etiketa_es = '+11 años'  WHERE slug = '11'   AND etiketa_es IS NULL;

-- ---------- Regalo (el vaso) ----------
-- Hasta hoy, el único vídeo del vaso (en castellano) estaba en el campo del
-- euskera. Pasa al de castellano; en euskera se verá ese con el aviso hasta
-- que Alain grabe el del euskera y lo pegue en el panel.
UPDATE magia_edukiak SET youtube_es = youtube, youtube = NULL
  WHERE slug = 'opari-basoa' AND youtube = 'YeVxIkatxlw' AND youtube_es IS NULL;

-- ---------- Textos y vídeos en castellano ----------
-- (slug, título, etiqueta, qué ve el público, material, vídeo)
WITH es(slug, izenburua_es, etiketa_es, sarrera_es, materiala_es, youtube_es) AS (VALUES
  ('opari-basoa', 'La desaparición inesperada', 'Un regalo extra',
   'Un vaso. Papel de aluminio. Tres minutos.',
   NULL, NULL),
  ('estrella', 'La estrella de palillos', 'Física mágica',
   '¡Esto no es un truco: es física mágica! Haz una apuesta: convertir cinco palillos en una estrella sin que nadie los empuje con nada.',
   '5 palillos de madera · una gota de agua (en un vaso o un recipiente pequeño)', 'XMs37vZXytA'),
  ('vaso', 'Desaparece la moneda', 'Magia con dinero',
   'Cuando el mago tapa una moneda con un vaso, la moneda desaparece. Al quitar el vaso, vuelve a aparecer.',
   'un vaso de plástico · papel blanco · pegamento · una moneda (o un dibujo de una) · un folio blanco como mesa', 'HW3isY2ARXY'),
  ('emakume', 'La mujer cortada', 'Magia clásica',
   'Un clásico de la magia, en pequeño: meten a la mujer en una caja, la atraviesan por la mitad... ¡y sale entera! Aquí, el billete es la mujer, el pósit es la caja y el bolígrafo, la espada.',
   'un billete o, si no, un trozo de papel del tamaño de un billete con una bella ayudante dibujada · un pósit · un bolígrafo o un lápiz', 'nDlruv4xk3E'),
  ('platos', 'Monedas con platos', 'Magia con dinero',
   'Pasas una moneda de un plato a otro y, en el segundo plato, ¡hay dos! Al repetirlo, ¡tres!',
   '2 platos · 3 monedas · un folio blanco · celo · tijeras', 'FPCyD77O8CY'),
  ('goma-saltaria', 'La goma saltarina', 'Magia con gomas',
   '¡Hipnotizamos objetos! Hipnotizas la goma y hace lo que le dices, aunque sea imposible: salta de unos dedos a otros.',
   '2 gomas (una para el juego y otra para la barrera)', '_96xM33h2Nk'),
  ('pulgar', 'Goma atraviesa el pulgar', 'Gomas imposibles · 1',
   'Una goma rodea el pulgar y, al tirar, ¡atraviesa el pulgar! Fíjate bien en las manos y en las fotos.',
   'una goma', 'HPUdl75LhBc'),
  ('palillo', 'Palillo que desaparece', 'Magia con palillos',
   'Tienes un palillo en la mano, haces un gesto mágico y... ¡ha desaparecido! Vuelve a aparecer, lo «coges» con la otra mano y desaparece otra vez.',
   'un palillo · un poco de celo', 'incDk5g9LjM'),
  ('reloj', 'El reloj', 'Magia con cartas',
   'La baraja es un calendario (4 palos = 4 estaciones, 12 figuras = 12 meses...) ¡y también un reloj! Un espectador piensa una hora, tú la adivinas... y tenías su carta predicha de antemano.',
   'una baraja · un rotulador del mismo color que el dorso · un papelito para dibujar la flecha', 'DXPVF3eF38E'),
  ('billete', 'El billete atraviesa las gomas', 'Gomas imposibles · 2',
   'Un espectador pone un billete doblado sobre la goma de arriba y, por arte de magia, el billete baja de goma en goma hasta la de abajo.',
   '2 gomas · un billete (o un trozo de papel del tamaño de un billete)', 'nYkpMtFlzWM'),
  ('uno', 'Adivina el futuro', 'Magia con cartas',
   'Vas a adivinar tres cosas de antemano: cómo caerá una moneda, qué saldrá en los dados y qué carta elegirá el espectador. ¡Al final, los tres papeles han acertado!',
   'una baraja · un vaso · 3 papelitos · un lápiz · una moneda · 2 dados', 'zikP2I2ppeA')
)
UPDATE magia_edukiak m SET
  izenburua_es = COALESCE(m.izenburua_es, es.izenburua_es),
  etiketa_es   = COALESCE(m.etiketa_es,   es.etiketa_es),
  sarrera_es   = COALESCE(m.sarrera_es,   es.sarrera_es),
  materiala_es = COALESCE(m.materiala_es, es.materiala_es),
  youtube_es   = COALESCE(m.youtube_es,   es.youtube_es),
  updated_at   = now()
FROM es
WHERE m.slug = es.slug;

-- Comprobación: debe salir 10 juegos con vídeo ES y el regalo con vídeo ES.
SELECT slug, izenburua, izenburua_es, youtube, youtube_es FROM magia_edukiak ORDER BY ordena;
