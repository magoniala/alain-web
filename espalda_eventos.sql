-- ============================================================
-- Entrenatzaile · Embudo de /espalda (2026-09-04, ampliado el 2026-09-05)
-- Ejecutar a mano en el SQL editor de Supabase. El fichero entero se
-- puede volver a pasar sin miedo: crea lo que falte y reemplaza las
-- vistas, sin tocar los datos ya registrados.
--
-- Ampliación del 2026-09-05: tiempo en la página (3, 10 y 30 segundos con
-- la pestaña delante), clic en el botón del hero y clic hacia la Hoja de
-- Ruta desde /gracias. Este último ocurre en otra página pero con la misma
-- sesión, que viaja en la URL: por eso cae dentro del mismo embudo.
-- ============================================================
--
-- Mide EN QUÉ PASO se cae la gente, y nada más. Aquí no entra jamás el
-- contenido de una respuesta: las respuestas son datos de salud (art. 9
-- RGPD), viven en espalda_leads y tienen su propio consentimiento. Esta
-- tabla solo sabe que un paso se completó.
--
-- El identificador de sesión se genera en memoria al cargar la página: no
-- hay cookie ni localStorage detrás, se pierde al cerrar la pestaña y no
-- vale para reconocer a nadie entre visitas. Por eso es medición técnica
-- anónima y no depende del banner de cookies para dispararse.

CREATE TABLE IF NOT EXISTS espalda_eventos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Sesión: un identificador aleatorio por carga de página. Es lo que
  -- cose los eventos de una misma persona en un embudo.
  sesion  text NOT NULL,
  landing text NOT NULL DEFAULT 'espalda',
  evento  text NOT NULL,

  -- Único campo libre, y está capado en el servidor a un código corto
  -- (el status HTTP de un envío fallido). Nunca texto del formulario.
  detalle text,

  -- Origen de la campaña. Igual que en espalda_leads.
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  utm_content  text,
  utm_term     text,
  referrer     text,

  -- Derivados del user-agent en el servidor. No se guarda el user-agent
  -- crudo: para saber si el que abandona viene de móvil basta con esto.
  dispositivo text,
  navegador   text,

  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS espalda_eventos_landing_fecha_idx
  ON espalda_eventos (landing, creado_en);
CREATE INDEX IF NOT EXISTS espalda_eventos_sesion_idx
  ON espalda_eventos (sesion);


-- ============================================================
-- Vista 1 · una fila por sesión, con los pasos que alcanzó
-- ============================================================
-- Es el ladrillo de las otras dos. Se puede consultar sola para mirar
-- sesiones concretas ("¿quién llegó al consentimiento y no envió?").
--
-- Las tres vistas van con security_invoker: por defecto una vista se
-- ejecuta con los permisos de quien la creó, lo que la convierte en una
-- puerta trasera a la tabla para quien no tendría acceso a ella. Con esto
-- se ejecutan con los permisos de quien consulta, y quien consulta es
-- siempre el panel de /admin con la service key.
CREATE OR REPLACE VIEW espalda_embudo_sesiones
WITH (security_invoker = true) AS
SELECT
  e.sesion,
  e.landing,
  (min(e.creado_en) AT TIME ZONE 'Europe/Madrid')::date AS dia,
  min(e.creado_en) AS primer_evento,
  max(e.creado_en) AS ultimo_evento,

  -- Los UTM son constantes dentro de una sesión, así que min() devuelve
  -- el valor y de paso resuelve las filas donde no venía nada.
  coalesce(min(e.utm_source),   '(directo)')  AS utm_source,
  coalesce(min(e.utm_medium),   '(sin dato)') AS utm_medium,
  coalesce(min(e.utm_campaign), '(sin dato)') AS utm_campaign,
  coalesce(min(e.utm_content),  '(sin dato)') AS utm_content,
  coalesce(min(e.dispositivo),  '(sin dato)') AS dispositivo,
  coalesce(min(e.navegador),    '(sin dato)') AS navegador,

  bool_or(e.evento = 'form_visible') AS form_visible,
  bool_or(e.evento = 'form_open')    AS form_open,
  bool_or(e.evento = 'form_start')   AS form_start,
  bool_or(e.evento = 'q1_done')      AS q1_done,
  bool_or(e.evento = 'q2_done')      AS q2_done,
  bool_or(e.evento = 'q3_done')      AS q3_done,
  bool_or(e.evento = 'datos_done')   AS datos_done,
  bool_or(e.evento = 'perfil_done')  AS perfil_done,
  bool_or(e.evento = 'consent_done') AS consent_done,
  bool_or(e.evento = 'submit_ok')    AS submit_ok,
  bool_or(e.evento = 'submit_error') AS submit_error,

  -- Códigos de los envíos que fallaron, si hubo alguno.
  string_agg(DISTINCT e.detalle, ',') FILTER (WHERE e.evento = 'submit_error') AS errores,

  -- Los pasos añadidos después van al final, aunque en el embudo se lean
  -- antes: CREATE OR REPLACE VIEW solo admite columnas nuevas por la cola,
  -- y así este fichero se sigue pudiendo pasar entero sin borrar nada. El
  -- orden de lectura lo pone PASOS_EMBUDO en el código, y la vista 3.
  bool_or(e.evento = 'time_3s')         AS time_3s,
  bool_or(e.evento = 'time_10s')        AS time_10s,
  bool_or(e.evento = 'time_30s')        AS time_30s,
  bool_or(e.evento = 'hero_cta_click')  AS hero_cta_click,
  bool_or(e.evento = 'hoja_ruta_click') AS hoja_ruta_click
FROM espalda_eventos e
GROUP BY e.sesion, e.landing;


-- ============================================================
-- Vista 2 · el embudo en crudo, por día y por utm_content
-- ============================================================
-- Compacta a propósito: una fila por día y anuncio. Es la que consume el
-- panel de /admin, y la que conviene si quieres exportar a una hoja.
CREATE OR REPLACE VIEW espalda_embudo
WITH (security_invoker = true) AS
SELECT
  dia,
  landing,
  utm_content,
  count(*)::int                                      AS sesiones,
  count(*) FILTER (WHERE form_visible)::int          AS form_visible,
  count(*) FILTER (WHERE form_open)::int             AS form_open,
  count(*) FILTER (WHERE form_start)::int            AS form_start,
  count(*) FILTER (WHERE q1_done)::int               AS q1_done,
  count(*) FILTER (WHERE q2_done)::int               AS q2_done,
  count(*) FILTER (WHERE q3_done)::int               AS q3_done,
  count(*) FILTER (WHERE datos_done)::int            AS datos_done,
  count(*) FILTER (WHERE perfil_done)::int           AS perfil_done,
  count(*) FILTER (WHERE consent_done)::int          AS consent_done,
  count(*) FILTER (WHERE submit_ok)::int             AS submit_ok,
  count(*) FILTER (WHERE submit_error)::int          AS submit_error,
  -- Igual que arriba: por la cola para no romper el CREATE OR REPLACE.
  count(*) FILTER (WHERE time_3s)::int               AS time_3s,
  count(*) FILTER (WHERE time_10s)::int              AS time_10s,
  count(*) FILTER (WHERE time_30s)::int              AS time_30s,
  count(*) FILTER (WHERE hero_cta_click)::int        AS hero_cta_click,
  count(*) FILTER (WHERE hoja_ruta_click)::int       AS hoja_ruta_click
FROM espalda_embudo_sesiones
GROUP BY dia, landing, utm_content;


-- ============================================================
-- Vista 3 · el embudo con el porcentaje de caída, paso a paso
-- ============================================================
-- Esta es la de leer con los ojos. Una fila por paso, en orden, con
-- cuántos llegan, qué porcentaje del total son y cuánto se ha caído
-- respecto al paso anterior.
--
--   select * from espalda_embudo_pct
--   where dia >= current_date - 14
--   order by dia desc, utm_content, orden;
CREATE OR REPLACE VIEW espalda_embudo_pct
WITH (security_invoker = true) AS
WITH largo AS (
  SELECT
    b.dia,
    b.landing,
    b.utm_content,
    b.sesiones,
    p.orden,
    p.paso,
    p.llegan
  FROM espalda_embudo b
  -- Aquí los pasos son FILAS, no columnas, así que el orden es el de
  -- verdad: primero cuánta gente aguanta en la página, luego el formulario,
  -- y al final el salto a la Hoja de Ruta desde /gracias.
  CROSS JOIN LATERAL (VALUES
    ( 1, 'page_view',       b.sesiones),
    ( 2, 'time_3s',         b.time_3s),
    ( 3, 'time_10s',        b.time_10s),
    ( 4, 'time_30s',        b.time_30s),
    ( 5, 'hero_cta_click',  b.hero_cta_click),
    ( 6, 'form_visible',    b.form_visible),
    ( 7, 'form_open',       b.form_open),
    ( 8, 'form_start',      b.form_start),
    ( 9, 'q1_done',         b.q1_done),
    (10, 'q2_done',         b.q2_done),
    (11, 'q3_done',         b.q3_done),
    (12, 'datos_done',      b.datos_done),
    (13, 'perfil_done',     b.perfil_done),
    (14, 'consent_done',    b.consent_done),
    (15, 'submit_ok',       b.submit_ok),
    (16, 'hoja_ruta_click', b.hoja_ruta_click)
  ) AS p(orden, paso, llegan)
)
SELECT
  dia,
  landing,
  utm_content,
  orden,
  paso,
  llegan,
  round(100.0 * llegan / nullif(sesiones, 0), 1) AS pct_del_total,
  lag(llegan) OVER w AS llegan_paso_anterior,
  round(100.0 - 100.0 * llegan / nullif(lag(llegan) OVER w, 0), 1) AS caida_pct
FROM largo
WINDOW w AS (PARTITION BY dia, landing, utm_content ORDER BY orden);
