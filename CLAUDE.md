# alain-web — guía para Claude

Web de Alain Zulaika (alainzulaika.com) en **Next.js + Supabase + Vercel**. Es a la vez web pública (magia, Entrenatzaile, landings), panel de administración (`/admin`) y motor de CRM, newsletter y embudos. Responde siempre en castellano.

## Next.js
Esta versión de Next tiene cambios que no conoces (ver `AGENTS.md`). **Antes de usar una API de Next de la que no estés seguro** (routing, caché, params, middleware, server actions), consulta solo la guía concreta en `node_modules/next/dist/docs/`. No leas la documentación entera en cada sesión ni para cambios de lógica, texto o estilos.

@AGENTS.md

## Mapa (ir directo, no explorar)
- `app/<ruta>/page.tsx` → páginas públicas. Euskera en la raíz, castellano bajo `app/es/…`. Un cambio de texto suele tocar **las dos** versiones.
- `app/api/<ruta>/route.ts` → endpoints. Los `cron` (`charlas/cron`, `newsletter/cron`, `sequence/cron`) son tareas programadas.
- `app/admin/_components/<X>Tab.tsx` → pestañas del panel (Charlas, Correo = «Bandeja general», Newsletter, Entrenatzaile, HojaDeRuta, Mirariak, Valoracion, Parq, Quetal, Nurture, Magia…). Su API está en `app/api/admin/<x>/`.
- `lib/` → lógica por dominio, un fichero por tema con prefijo: `charlas-*`, `correo-general` (bandeja general: apunta todo lo que entra en el buzón; enganchada en `leerBuzon`), `entrenatzaile-*`, `ent-*`, `crm-*`, `newsletter-*`, `secuencia*`, `acompanamiento*`, `hoja-ruta-*`, `quetal*`, `parq*`, `mirariak`, `stripe`, `email-*`. Busca primero aquí.
- `scripts/charlas/` y `scripts/crm/` → espejo **Supabase → vault de Obsidian** (`espejo-vault.mjs`, `espejo-prospectos.mjs`) e importadores. Supabase manda; el vault es copia. **Excepción, las altas:** `espejo-vault.mjs` llama primero a `scripts/crm/altas-vault.mjs`, que sube a Supabase las fichas nuevas del vault (`Prospectos/` → `crm_fichas` · `Centros/` e `Instituciones/` → `charlas_centros`) con guardia de duplicados. La conversión ficha → fila está en `prospectos-lib.mjs` (`filaDesdeFicha`) y `centros-lib.mjs`; no duplicar esa lógica.
- `app/magia-tailerrak/` → plataforma de magia del QR de los librillos (solo euskera). Catálogo en Supabase (`magia_liburutxoak`, `magia_edukiak`), editable en `/admin` › Magia-tailerrak (`MagiaTailerrakTab.tsx`, API `app/api/admin/magia-tailerrak/`); lógica en `lib/magia-*` (`magia-edukiak` = catálogo vivo con fallback a `magia-catalogo`; `magia-plataforma` = sesión, códigos, correos). Un cambio de texto o vídeo de un juego NO se hace en código: se hace en el panel.
- `sql/` → migraciones ya aplicadas a mano en Supabase, una por funcionalidad. Solo se miran si la tarea toca ese esquema.

## Cómo trabajar
- Localiza con `grep -rn` en `app/` y `lib/` y abre solo los ficheros implicados. No leas carpetas enteras.
- No leas `.next/`, `node_modules/` (salvo docs de Next), `public/` (imágenes), `*.tgz`, `scripts/charlas/vault-export.json`, `scripts/charlas/_conocimiento/`.
- Secretos en `.env.local` y `_vapid_para_vercel.txt`: no los imprimas ni los copies en código.
- Comprobar tipos: `npx tsc --noEmit`. Servidor local: `npm run dev` (puerto 3000).
- Commits en castellano, una línea que diga qué cambia para Alain (estilo del `git log`). No hacer push sin que lo pida.

## Economía
**Aviso de modelo:** si la tarea es un cambio pequeño (texto, estilo, arreglo acotado) y el modelo es Opus o Fable, avisa a Alain en una línea de que con Sonnet basta. Si es diseñar una funcionalidad nueva o un bug difícil y está en Sonnet o Haiku, avisa de que conviene Opus.

Una tarea por sesión. Si se alarga, deja el estado en el mensaje de commit o en una nota del vault y empieza sesión nueva. Usa `/clear` al cambiar de tema.
