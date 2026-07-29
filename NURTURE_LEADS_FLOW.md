# Secuencia de nurture + captación de leads (Meta Ads)

Documentación técnica del sistema montado para la campaña de Facebook/Meta
Ads "Espalda 45-65 / jul2026" — una secuencia automática de 10 mails que
arranca en cuanto alguien rellena el formulario de anuncios, más la
infraestructura de captación que la alimenta.

**No tiene nada que ver con `/guias`** — esa landing sigue con su propio
email de bienvenida de siempre, sin tocar.

---

## 1. Visión general del flujo

```
Meta Lead Ads (formulario nativo)
        │
        ▼
Make.com: "Meta leads → Entrenatzaile"
  Facebook Lead Ads (Watch Leads) ──▶ HTTP POST
        │                              │
        │ cada 15 min                  ▼
        │                    /api/leads/entrada
        │                              │
        │                    ┌─────────┴─────────┐
        │                    │                    │
        │              email nuevo          email ya existe
        │                    │                    │
        │           alta + Mail 0            ¿unsubscribed?
        │           inmediato                     │
        │                    │            ┌────────┴────────┐
        │                    │           sí                 no
        │                    │            │                  │
        │                    │      reactivar +         mail "Ya
        │                    │      Mail 0              estabas
        │                    │      inmediato           aquí" (1 vez)
        │                    ▼            ▼                  ▼
        └──────────▶  /api/newsletter/cron (cron-job.org, cada 15 min)
                       - procesarNurture(): M1-M9, ventana fija 14:30
                       - procesarRecordatorioValoracion(): 19:14, mismo
                         día que M7
```

---

## 2. Base de datos

### `newsletter_contactos` — columnas añadidas

| Columna | Tipo | Para qué |
|---|---|---|
| `recibe_secuencia` | boolean | Si está activamente en alguna secuencia |
| `posicion_secuencia` | int | Qué mail le toca (0-9, o completado) |
| `secuencia_completada` | boolean | Ya recibió todos los mails de la secuencia |
| `fecha_ultimo_mail_secuencia` | timestamptz | Fecha del último envío **confirmado** (nunca antes de confirmar) |
| `enviando_secuencia_desde` | timestamptz | Candado anti-carrera de la secuencia principal (caduca a los 5 min) |
| `recordatorio_valoracion_enviado` | boolean | Si ya recibió el recordatorio puntual |
| `recordatorio_valoracion_enviando_desde` | timestamptz | Candado del recordatorio |
| `mail_duplicado_ads_enviado` | boolean | Si ya recibió el mail "Ya estabas aquí" |
| `mail_duplicado_ads_enviando_desde` | timestamptz | Candado del mail de duplicados |
| `edad` | int | Capturada del formulario de ads (opcional, puede ser `null`) |
| `leadgen_id` | text | ID del lead de Meta que dio de alta a este contacto (único, parcial) |
| `form_id` | text | ID del formulario de Meta |

### `secuencia_mails` — contenido de la secuencia

| Columna | Tipo |
|---|---|
| `posicion` | int (PK) |
| `asunto` | text |
| `cuerpo_html` | text (el `<p>...</p>` interior; el wrapper con firma/baja lo añade `wrapNurture()` en el envío) |
| `activo` | boolean |
| `remitente` | text (`entrenatzaile@alainzulaika.com` o `newsletter@alainzulaika.com`) |

**Posiciones especiales (sentinels, fuera de la progresión 0-9):**
- `-1` = recordatorio puntual ("Quedan unas horas")
- `-2` = mail de cortesía para quien ya estaba en la lista ("Ya estabas aquí")

Ninguna de las dos avanza `posicion_secuencia` — se buscan por su propia
lógica, no por la cola normal.

### `leads_ads_duplicados` — métricas de leads que no entran en la secuencia

| Columna | Tipo |
|---|---|
| `id` | uuid (PK) |
| `email` | text |
| `leadgen_id` | text (único, parcial) |
| `fecha` | timestamptz |
| `mail_enviado` | boolean |
| `mail_error` | text (motivo si no se envió: omitido por baja, ya enviado antes, error de Mailjet, error de base de datos...) |

Cuenta cada vez que alguien que **ya estaba en la lista** (y activo) vuelve
a entrar por el anuncio — para que la campaña de Meta pueda medir el
volumen real de conversiones, aunque esa persona no reciba la secuencia
completa.

---

## 3. Calendario de la secuencia

Hora de Madrid (Europe/Madrid). Remitente `entrenatzaile@alainzulaika.com`
salvo donde se indica.

| Mail | Posición | Cuándo | Asunto |
|---|---|---|---|
| M0 | 0 | Inmediato al entrar (nuevo lead o reactivación) | Aquí tienes tu guía (+2 de regalo) |
| M1 | 1 | +1 día, 14:30 | Me señaló desde el otro lado del gimnasio |
| M2 | 2 | +1 día, 14:30 | Lo que Dora la Exploradora sabe de tu espalda |
| M3 | 3 | +1 día, 14:30 | "No quiero dejar entrar al viejo." |
| M4 | 4 | +1 día, 14:30 | Su mujer se cae. Y él la levanta. |
| M5 | 5 | +1 día, 14:30 | El problema no es que no sepas qué hacer. |
| M6 | 6 | +1 día, 14:30 | Da igual si es pilates, yoga o pesas. |
| M7 | 7 | +1 día, 14:30 | El tema del que ninguno habla |
| Recordatorio | -1 | Mismo día que M7, 19:14 | Quedan unas horas |
| M8 | 8 | +1 día tras M7, 14:30 | Ya no hay prisa. |
| M9 | 9 | +1 día tras M8, 14:30 | "Adivinar lo dejamos para los magos" — **remitente `newsletter@alainzulaika.com`** |
| Duplicado | -2 | Al detectar que ya estaba en la lista (1 vez) | Ya estabas aquí |

Tras M9: `secuencia_completada = true` → el contacto vuelve a ser elegible
para los envíos normales de newsletter (pestaña Newsletter del panel), pero
eso sigue siendo **manual** — no hay ningún sistema que escriba y programe
el correo diario solo.

Los enlaces a Calendly en M0-M7 y el recordatorio llevan UTM propio:
`?utm_source=secuencia&utm_medium=email&utm_campaign=espalda&utm_content=mailN`
(o `=recordatorio`). M8 y M9 no tienen enlace a Calendly (su copy no lo
menciona).

---

## 4. Regla dura de envío (por qué existe)

**`posicion_secuencia`, `fecha_ultimo_mail_secuencia` y los flags de
"enviado" (`recordatorio_valoracion_enviado`, `mail_duplicado_ads_enviado`)
solo se tocan después de que `sendEmail()` confirme el envío sin lanzar
excepción — nunca antes.**

El candado anti-carrera (para que el cron y un envío inmediato no dupliquen
un mail si coinciden) vive en columnas aparte (`..._enviando_desde`), con
caducidad de 5 minutos por si un intento se queda a medias por un cuelgue
del proceso. Si Mailjet falla, el contacto queda exactamente como estaba —
el cron lo recoge solo en la siguiente pasada porque para él no ha
cambiado nada.

Esto se corrigió durante el desarrollo tras un fallo real: antes se
marcaba "enviado" *antes* de intentar el envío, así que un error de
Mailjet quedaba invisible.

**Toda esta lógica vive en `lib/nurture.ts`** (`enviarMailSecuencia()`,
`wrapNurture()`, `CANDADO_STALE_MS`), compartida entre el cron y el
endpoint de leads para que no haya dos caminos de envío separados que
puedan pisarse.

---

## 5. `POST /api/leads/entrada`

Endpoint de entrada real para la campaña. Autenticado con
`Authorization: Bearer <LEADS_SECRET>`.

**Body esperado:**
```json
{
  "email": "...",
  "edad": 52,
  "leadgen_id": "...",
  "form_id": "...",
  "created_time": "..."
}
```
`edad` es opcional (puede faltar o venir vacío, se guarda como `null`).

**Lógica, en orden:**

1. Valida el email — si no es válido, `200` + se descarta (para no
   provocar reintentos infinitos de un dato que nunca va a valer).
2. Deduplica por `leadgen_id` — mira tanto `newsletter_contactos` como
   `leads_ads_duplicados`. Si ya existe, `200` sin hacer nada más.
3. Normaliza el email (`normalizarEmail()`): en Gmail/Googlemail ignora
   puntos y cualquier `+tag`, para detectar de verdad a la misma persona
   aunque rellene el formulario con variantes de su dirección. **Solo
   aplica en este endpoint** — el resto de formularios del sitio no
   normalizan.
4. Busca si el email ya existe en `newsletter_contactos`:
   - **Existe y está `unsubscribed`** → se reactiva del todo
     (`unsubscribed=false`, `recibe_secuencia=true`,
     `posicion_secuencia=0`, `origen=meta_ads`) y entra en la secuencia
     desde el M0, exactamente como un lead nuevo. Decisión explícita del
     usuario: rellenar el formulario de ads es señal de interés renovado.
   - **Existe y está activo** → no se toca su suscripción ni
     `recibe_secuencia`. Se registra el toque en `leads_ads_duplicados`
     (cuenta para métricas de campaña) y se le manda el mail "Ya estabas
     aquí" — una sola vez por contacto, nunca a alguien `unsubscribed`.
   - **No existe** → alta nueva: `origen=meta_ads`, `recibe_secuencia=true`,
     `posicion_secuencia=0`, guarda `edad`/`leadgen_id`/`form_id`/
     `fecha_alta` (de `created_time` si viene).
5. Intenta enviar el mail correspondiente **al instante** (M0, o el de
   duplicados) usando `enviarMailSecuencia()`. Si falla, no pasa nada
   especial: el cron de `/api/newsletter/cron` lo recoge en su siguiente
   pasada (máx. 15 min) porque usa la misma función y el mismo criterio
   ("¿tiene ya un envío confirmado?").
6. Responde `200` en prácticamente todos los casos — solo `401` si falla
   la autenticación, o `500` si hay un error real de base de datos al
   guardar (para que el emisor del webhook sepa que debe reintentar algo
   que sí podría funcionar la próxima vez).

---

## 6. Escenario de Make.com

Nombre: **"Meta leads → Entrenatzaile"**.

**Módulos, en este orden:**
1. **Facebook Lead Ads — Watch Leads**: conectado a la página
   "Entrenatzaile", formulario de Lead Ads de la campaña (`Espalda 45-65 /
   jul2026 2.0` a día de hoy — se duplicó la versión original para poder
   editar la pantalla de agradecimiento, que Meta bloquea en formularios
   ya publicados). Corre cada 15 minutos.
2. **HTTP — Make a request**: `POST` a
   `https://www.alainzulaika.com/api/leads/entrada` (con `www`, sin él
   puede fallar por redirect). Header `Authorization: Bearer
   <LEADS_SECRET>`. Body JSON con los 4 campos mapeados a las variables
   reales del módulo anterior (email, Lead ID → `leadgen_id`, Form ID →
   `form_id`, Date created → `created_time`).

**Gotcha real que costó varias vueltas**: al insertar una variable de Make
dentro de un campo de texto JSON, es fácil que el chip se "coma" las
comillas de alrededor y el JSON quede inválido (`"email": valor` en vez de
`"email": "valor"`). La forma fiable de evitarlo: escribir la comilla de
apertura, insertar el chip justo después, y escribir la comilla de cierre
inmediatamente — campo a campo, no rellenando un molde ya escrito con
comillas vacías.

**Pantalla de agradecimiento del formulario de Meta**: los formularios de
Lead Ads ya publicados y en uso no se pueden editar in situ en Meta Ads
Manager — hay que duplicarlos. Se duplicó para poder avisar de que el
email (con las guías) puede tardar hasta 15 minutos en llegar.

---

## 7. Secretos / variables de entorno

Todas en `.env.local` (local) y Vercel → Environment Variables
(Production + Preview, Sensitive). Ver también memoria del proyecto
(`project_secrets.md`) para los valores exactos.

- `CRON_SECRET` — autentica a cron-job.org contra `/api/newsletter/cron` y `/api/sequence/cron`.
- `ADMIN_PASSWORD` — login único del panel `/admin`.
- `LEADS_SECRET` — autentica a Make contra `/api/leads/entrada`.

`cron-job.org` dispara ambos crons cada 15 minutos sobre
`https://www.alainzulaika.com/...` (con `www`). Vercel Cron no gestiona
nada de esto (`vercel.json` no tiene crons).

---

## 8. Panel `/admin`

Pestaña **Nurture**: lista de contactos activos en cualquier secuencia,
con su posición, próximo mail y fecha del último envío. Botón "Marcar
como reservado" → `recibe_secuencia=false` (saca de la secuencia, NO da de
baja de la newsletter — vuelve a los envíos normales automáticamente).
Botón "Reactivar" para deshacerlo. Todo esto es manual: no hay ninguna
integración con Calendly ni con respuestas de email que lo dispare solo.

---

## 9. Limitaciones conocidas / cosas a recordar

- El correo diario normal (después de que alguien completa la secuencia)
  sigue siendo 100% manual — lo escribe y programa el usuario desde la
  pestaña Newsletter, como siempre.
- "Marcar como reservado" solo pasa si el usuario lo hace a mano en el
  panel — ni Calendly ni una respuesta de email lo activan solos.
- La normalización de email de Gmail solo vive en `/api/leads/entrada` —
  los demás formularios del sitio (`/guias`, `/comodin`, etc.) no la
  tienen, así que podría haber duplicados antiguos de antes de esta fecha
  si alguien entró por rutas distintas con variantes de su Gmail.
- El mail de duplicados (`-2`) y el recordatorio (`-1`) no tienen un
  barrido periódico propio tipo "reintentar pendientes" — solo el intento
  inmediato en el momento del evento que los dispara, con su candado de 5
  min. Si ese intento falla y nadie vuelve a disparar el mismo evento, no
  se reintenta solo (a diferencia de M0-M9, que si se quedan a medias los
  recoge el cron en la siguiente pasada de forma indefinida).
- El bug de `/guias` (contactos que no reciben la etiqueta de variante si
  ya existían antes del sistema de tags) se corrigió aparte y no tiene
  relación con este flujo.
