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
-- Las tres vistas
-- ============================================================
-- Se tiran y se rehacen enteras en cada pasada. CREATE OR REPLACE VIEW solo
-- admite columnas nuevas por la cola, así que para quitar una —o para poner
-- las que hay en orden de lectura— no hay otra. No se pierde nada: las
-- vistas no guardan datos, se recalculan de espalda_eventos.
DROP VIEW IF EXISTS espalda_embudo_pct;
DROP VIEW IF EXISTS espalda_embudo;
DROP VIEW IF EXISTS espalda_embudo_sesiones;


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

  -- Los pasos, en el orden en que ocurren. Primero cuánto aguantan con la
  -- página delante, luego el formulario, y al final el salto a la Hoja de
  -- Ruta desde /gracias.
  bool_or(e.evento = 'time_3s')         AS time_3s,
  bool_or(e.evento = 'time_10s')        AS time_10s,
  bool_or(e.evento = 'time_30s')        AS time_30s,
  bool_or(e.evento = 'hero_cta_click')  AS hero_cta_click,
  bool_or(e.evento = 'form_visible')    AS form_visible,
  bool_or(e.evento = 'form_start')      AS form_start,
  bool_or(e.evento = 'q1_done')         AS q1_done,
  bool_or(e.evento = 'q2_done')         AS q2_done,
  bool_or(e.evento = 'q3_done')         AS q3_done,
  bool_or(e.evento = 'datos_done')      AS datos_done,
  bool_or(e.evento = 'perfil_done')     AS perfil_done,
  bool_or(e.evento = 'consent_done')    AS consent_done,
  bool_or(e.evento = 'submit_ok')       AS submit_ok,
  bool_or(e.evento = 'submit_error')    AS submit_error,
  bool_or(e.evento = 'hoja_ruta_click') AS hoja_ruta_click,

  -- El formulario aparece dos veces en la página. Esto dice desde cuál de
  -- los dos se envió: 'top' (encima del cuerpo) o 'bottom' (al final).
  -- Solo hay un envío bueno por sesión, así que max() devuelve el que hubo.
  max(e.detalle) FILTER (WHERE e.evento = 'submit_ok') AS submit_desde,

  -- Códigos de los envíos que fallaron, si hubo alguno.
  string_agg(DISTINCT e.detalle, ',') FILTER (WHERE e.evento = 'submit_error') AS errores
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
  count(*)::int                                  AS sesiones,
  count(*) FILTER (WHERE time_3s)::int           AS time_3s,
  count(*) FILTER (WHERE time_10s)::int          AS time_10s,
  count(*) FILTER (WHERE time_30s)::int          AS time_30s,
  count(*) FILTER (WHERE hero_cta_click)::int    AS hero_cta_click,
  count(*) FILTER (WHERE form_visible)::int      AS form_visible,
  count(*) FILTER (WHERE form_start)::int        AS form_start,
  count(*) FILTER (WHERE q1_done)::int           AS q1_done,
  count(*) FILTER (WHERE q2_done)::int           AS q2_done,
  count(*) FILTER (WHERE q3_done)::int           AS q3_done,
  count(*) FILTER (WHERE datos_done)::int        AS datos_done,
  count(*) FILTER (WHERE perfil_done)::int       AS perfil_done,
  count(*) FILTER (WHERE consent_done)::int      AS consent_done,
  count(*) FILTER (WHERE submit_ok)::int         AS submit_ok,
  count(*) FILTER (WHERE submit_error)::int      AS submit_error,
  count(*) FILTER (WHERE hoja_ruta_click)::int   AS hoja_ruta_click,

  -- Cuál de los dos formularios convierte. No son pasos del embudo, son el
  -- desglose del último: submit_ok_top + submit_ok_bottom = submit_ok,
  -- salvo envíos anteriores a que existieran los dos formularios, que no
  -- llevan detalle y no caen en ninguno de los dos.
  count(*) FILTER (WHERE submit_ok AND submit_desde = 'top')::int    AS submit_ok_top,
  count(*) FILTER (WHERE submit_ok AND submit_desde = 'bottom')::int AS submit_ok_bottom
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
--
-- Ojo al leer hero_cta_click: al formulario se llega también bajando, así
-- que ese escalón suele GANAR gente en vez de perderla y su caida_pct sale
-- negativa. No es un error.
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
  -- Aquí los pasos son FILAS, no columnas, así que se leen en orden.
  CROSS JOIN LATERAL (VALUES
    ( 1, 'page_view',       b.sesiones),
    ( 2, 'time_3s',         b.time_3s),
    ( 3, 'time_10s',        b.time_10s),
    ( 4, 'time_30s',        b.time_30s),
    ( 5, 'hero_cta_click',  b.hero_cta_click),
    ( 6, 'form_visible',    b.form_visible),
    ( 7, 'form_start',      b.form_start),
    ( 8, 'q1_done',         b.q1_done),
    ( 9, 'q2_done',         b.q2_done),
    (10, 'q3_done',         b.q3_done),
    (11, 'datos_done',      b.datos_done),
    (12, 'perfil_done',     b.perfil_done),
    (13, 'consent_done',    b.consent_done),
    (14, 'submit_ok',       b.submit_ok),
    (15, 'hoja_ruta_click', b.hoja_ruta_click)
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
