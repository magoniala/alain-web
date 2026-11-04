-- ============================================================
-- Dos tipos de cita sobre la MISMA agenda (2026-09-15)
-- Landing existente  entrenatzaile.alainzulaika.com/hoja-de-ruta
-- Landing nueva      creadores.alainzulaika.com
-- Ejecutar a mano en el SQL editor de Supabase.
--
-- Hasta ahora todas las reservas eran del mismo tipo y la regla era una
-- sola: una llamada al día. Ahora hay dos páginas distintas que reservan
-- sobre la misma agenda, con reglas de bloqueo distintas, y lo que no puede
-- pasar bajo ningún concepto es que se pueda coger un hueco desde una que la
-- otra ya había inutilizado.
--
-- Sigue sin haber tabla de huecos: escribir `hueco` en la fila ES apartar el
-- hueco, igual que antes. Lo que cambia es quién decide si ese hueco se
-- puede escribir.
--
--   Hoja de Ruta  → Hoja de Ruta    su día natural ENTERO.
--   Hoja de Ruta  → infoproductos   solo su MEDIO día (mañana o tarde).
--   Infoproductos → los dos         de 1 h antes a 2 h después.
--
-- Ojo a las asimetrías, que son deliberadas: un infoproducto NO cierra el día
-- para la Hoja de Ruta, solo sus tres horas; y una Hoja de Ruta no cierra el
-- día para los infoproductos, solo la mitad en la que cae. Así ni una llamada
-- corta te tumba la de 90 € de la tarde, ni la de 90 € de la mañana te deja
-- la tarde entera sin poder usarla.
-- ============================================================

-- ============================================================
-- Qué tipo de cita es cada reserva
-- ============================================================
--
-- Con DEFAULT, y a propósito: las filas que ya existen son todas Hoja de
-- Ruta, y cualquier inserción que no nombre la columna lo sigue siendo. El
-- día que se olvide poner el tipo en algún sitio, la reserva sale del lado
-- conservador (bloquea más, no menos).
ALTER TABLE hoja_ruta_reservas
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'hoja-de-ruta';

-- Lista cerrada. El tipo decide cuánta agenda bloquea la fila: un valor
-- suelto por una errata ('infoproducto' en singular) no bloquearía nada y no
-- daría ningún error visible.
DO $$
BEGIN
  ALTER TABLE hoja_ruta_reservas
    ADD CONSTRAINT hoja_ruta_reservas_tipo_chk
    CHECK (tipo IN ('hoja-de-ruta', 'infoproductos'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS hoja_ruta_reservas_tipo_idx ON hoja_ruta_reservas (tipo);

-- ============================================================
-- El índice de "una al día" pasa a ser solo de la Hoja de Ruta
-- ============================================================
--
-- Este es el único cambio destructivo de todo el archivo. El índice actual
-- impone una reserva por día natural CONTANDO TODAS las filas, que hasta hoy
-- era exactamente la regla de la Hoja de Ruta porque no había otra cosa. Con
-- dos tipos ya no vale: bloquearía la segunda cita de infoproductos del día,
-- que sí está permitida.
--
-- Lo que este índice sigue garantizando, y es lo importante, es que no puede
-- haber dos Hojas de Ruta el mismo día ni por una carrera. El resto de
-- reglas cruzadas las impone el trigger de abajo.
DROP INDEX IF EXISTS hoja_ruta_reservas_dia_key;

CREATE UNIQUE INDEX IF NOT EXISTS hoja_ruta_reservas_dia_key
  ON hoja_ruta_reservas ((left(hueco, 10)))
  WHERE hueco IS NOT NULL AND tipo = 'hoja-de-ruta';

-- hoja_ruta_reservas_hueco_key NO se toca. Cubre todas las filas de todos
-- los tipos, así que sigue siendo lo que impide que dos personas cojan el
-- mismo instante desde las dos páginas distintas.

-- ============================================================
-- Las reglas cruzadas, dentro de la transacción
-- ============================================================
--
-- Por qué un trigger y no una restricción declarativa:
--
-- Un EXCLUDE sobre rangos sería lo bonito, pero exige que el rango de cada
-- fila esté indexado, y `hueco` es texto: `hueco::timestamptz` no es
-- IMMUTABLE (el cast depende del TimeZone de la sesión) y Postgres no lo
-- admite en un índice. Es la misma razón por la que el índice de día indexa
-- left(hueco,10) en vez de convertir a fecha. Y aunque se pudiera, un EXCLUDE
-- es simétrico por definición y estas reglas NO lo son: un infoproducto ya
-- puesto no impide una Hoja de Ruta ese día, pero una Hoja de Ruta ya puesta
-- sí impide el infoproducto.
--
-- Por qué el advisory lock:
--
-- Sin él, este trigger comprobaría lo mismo que ya comprueba el endpoint en
-- Node y con el mismo agujero: dos transacciones simultáneas no se ven la una
-- a la otra, así que las dos leerían "no hay nada colindante" y las dos
-- escribirían. El lock serializa por día natural a todo el que quiera
-- escribir un hueco de ese día; la segunda espera, y cuando mira ya ve a la
-- primera. Se suelta solo al terminar la transacción (xact).
--
-- Serializar por DÍA es suficiente porque ninguna ventana cruza la
-- medianoche: la rejilla va de 9:00 a 20:00, así que el bloqueo más temprano
-- que puede existir empieza a las 8:00 y el más tardío acaba a las 22:00. Si
-- algún día se amplía la rejilla hasta más allá de las 22:00, o se alarga la
-- ventana de infoproductos, hay que bloquear también el día siguiente.
-- search_path fijado a vacío, y la tabla cualificada con su esquema.
--
-- No es un formalismo del linter. Esta función decide si un hueco choca, y lo
-- decide leyendo `hoja_ruta_reservas`. Sin fijar el search_path, ese nombre lo
-- resuelve la ruta de quien llama: a quien pudiera colocar por delante otra
-- tabla con ese mismo nombre (el esquema temporal de la sesión va antes que
-- public), la comprobación le miraría una tabla vacía, no encontraría ningún
-- choque y dejaría pasar la doble reserva. Es decir, lo único que esta función
-- existe para impedir.
--
-- Los nombres sin cualificar que quedan (left, hashtext, interval,
-- pg_advisory_xact_lock) son todos de pg_catalog, que Postgres busca siempre
-- aunque el search_path esté vacío. Lo que había que atar era la tabla.
CREATE OR REPLACE FUNCTION public.hoja_ruta_reservas_sin_cruce() RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  dia    text;
  ini    timestamptz;
  choque text;
BEGIN
  -- Liberar un hueco (cancelar, o el cron al expirar un pago) nunca choca.
  IF NEW.hueco IS NULL THEN
    RETURN NEW;
  END IF;

  -- Los updates que no tocan ni el hueco ni el tipo no se revalidan: son la
  -- inmensa mayoría (estado del pago, marcadores de correo enviado) y no
  -- tienen por qué pedir el lock del día ni recorrer la tabla.
  IF TG_OP = 'UPDATE'
     AND OLD.hueco IS NOT DISTINCT FROM NEW.hueco
     AND OLD.tipo  IS NOT DISTINCT FROM NEW.tipo THEN
    RETURN NEW;
  END IF;

  -- Los diez primeros caracteres SON el día natural en Madrid: huecoISO()
  -- escribe siempre 'YYYY-MM-DDTHH:MM:SS±HH:MM' con la fecha ya en hora de
  -- Madrid. Misma dependencia de formato que el índice de día.
  dia := left(NEW.hueco, 10);
  ini := NEW.hueco::timestamptz;

  PERFORM pg_advisory_xact_lock(hashtext('hoja_ruta_reservas'), hashtext(dia));

  -- Lo que estorba a la cita nueva depende de qué tipo sea ella, porque una
  -- Hoja de Ruta ya puesta no les quita lo mismo a las dos: a otra Hoja de
  -- Ruta le quita el día entero, y a un infoproducto solo su mitad.
  IF NEW.tipo = 'hoja-de-ruta' THEN

    SELECT r.hueco INTO choque
      FROM public.hoja_ruta_reservas r
     WHERE r.hueco IS NOT NULL
       AND r.id <> NEW.id
       AND (
             -- Otra Hoja de Ruta ese día. Solo hay una al día.
             (r.tipo = 'hoja-de-ruta' AND left(r.hueco, 10) = dia)
             -- O la ventana de un infoproducto. Cerrada por abajo y abierta
             -- por arriba: a las 12:00 en punto, una cita de las 10:00 ya no
             -- estorba.
          OR (r.tipo = 'infoproductos'
              AND ini >= r.hueco::timestamptz - interval '1 hour'
              AND ini <  r.hueco::timestamptz + interval '2 hours')
           )
     LIMIT 1;

  ELSE

    SELECT r.hueco INTO choque
      FROM public.hoja_ruta_reservas r
     WHERE r.hueco IS NOT NULL
       AND r.id <> NEW.id
       AND (
             (r.tipo = 'hoja-de-ruta' AND left(r.hueco, 10) = dia
              AND (
                    -- La media jornada en la que cae la llamada larga. El
                    -- corte son las 14:00, y tiene que ser el MISMO que el de
                    -- CORTE_MEDIODIA en lib/entrenatzaile-huecos.ts: son las
                    -- dos mitades del mismo cálculo.
                    --
                    -- substring(... from 12 for 5) son los cinco caracteres
                    -- 'HH:MM' del identificador, ya en hora de Madrid. Se
                    -- comparan como texto, que con horas de dos dígitos
                    -- ordena igual que como números.
                    (substring(r.hueco from 12 for 5) < '14:00')
                      = (substring(NEW.hueco from 12 for 5) < '14:00')
                    -- O la hora que dura la llamada, por si se pasa al otro
                    -- lado del mediodía: la Hoja de Ruta de las 13:30 es de
                    -- mañana y termina a las 14:30, así que un infoproducto
                    -- de las 14:00 le caería encima pasando el filtro de
                    -- arriba.
                 OR (ini >= r.hueco::timestamptz
                     AND ini <  r.hueco::timestamptz + interval '1 hour')
                  ))
             -- Y la ventana de otro infoproducto, igual que en el otro caso.
          OR (r.tipo = 'infoproductos'
              AND ini >= r.hueco::timestamptz - interval '1 hour'
              AND ini <  r.hueco::timestamptz + interval '2 hours')
           )
     LIMIT 1;

  END IF;

  IF choque IS NOT NULL THEN
    -- 23505 a propósito: es el código que ya devuelven los índices únicos y
    -- el que los endpoints traducen a un 409 "elige otro hueco". Así un
    -- choque cruzado se le cuenta al lead igual que un choque directo, sin
    -- tocar el manejo de errores de la Hoja de Ruta.
    RAISE EXCEPTION 'hueco ocupado: % choca con la reserva de %', NEW.hueco, choque
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hoja_ruta_reservas_sin_cruce_trg ON public.hoja_ruta_reservas;

CREATE TRIGGER hoja_ruta_reservas_sin_cruce_trg
  BEFORE INSERT OR UPDATE ON public.hoja_ruta_reservas
  FOR EACH ROW EXECUTE FUNCTION public.hoja_ruta_reservas_sin_cruce();

-- ============================================================
-- Consentimiento de la landing de creadores
-- ============================================================
--
-- Las columnas de consentimiento que ya existen (consent_datos,
-- consent_datos_texto, consentimientos_version) sirven igual para las dos
-- páginas: lo que cambia es el texto que se graba, y el texto se graba desde
-- el servidor. No hace falta ninguna columna nueva.
--
-- Lo que NO comparte esta landing es el alta en la newsletter: su casilla
-- solo acepta la política de privacidad, así que quien reserva aquí no entra
-- en newsletter_contactos.

-- ============================================================
-- Comprobación
-- ============================================================
-- SELECT tipo, count(*) FROM hoja_ruta_reservas GROUP BY tipo;
--
-- SELECT indexname, indexdef FROM pg_indexes
--  WHERE tablename = 'hoja_ruta_reservas' ORDER BY indexname;
--
-- Que el trigger corta de verdad (debe fallar con 23505 el segundo insert):
--   INSERT INTO hoja_ruta_reservas (email, tipo, hueco)
--   VALUES ('prueba@ejemplo.com', 'infoproductos', '2030-01-15T10:00:00+01:00');
--   INSERT INTO hoja_ruta_reservas (email, tipo, hueco)
--   VALUES ('prueba2@ejemplo.com', 'hoja-de-ruta', '2030-01-15T11:00:00+01:00');
--   -- y este debe entrar, porque las 12:00 ya están fuera de la ventana:
--   INSERT INTO hoja_ruta_reservas (email, tipo, hueco)
--   VALUES ('prueba3@ejemplo.com', 'hoja-de-ruta', '2030-01-15T12:00:00+01:00');
--
-- Que la Hoja de Ruta solo se lleva media jornada (el tercero debe entrar):
--   INSERT INTO hoja_ruta_reservas (email, tipo, hueco)
--   VALUES ('prueba4@ejemplo.com', 'hoja-de-ruta', '2030-01-16T10:00:00+01:00');
--   -- este NO, es de mañana como la llamada larga:
--   INSERT INTO hoja_ruta_reservas (email, tipo, hueco)
--   VALUES ('prueba5@ejemplo.com', 'infoproductos', '2030-01-16T12:00:00+01:00');
--   -- y este SÍ, porque es de tarde:
--   INSERT INTO hoja_ruta_reservas (email, tipo, hueco)
--   VALUES ('prueba6@ejemplo.com', 'infoproductos', '2030-01-16T17:00:00+01:00');
--
--   DELETE FROM hoja_ruta_reservas WHERE email LIKE 'prueba%@ejemplo.com';
