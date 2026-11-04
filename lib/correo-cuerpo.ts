// Sin dependencias de servidor: lo usan el envío (lib/charlas-correo.ts) y la
// vista previa de las bandejas del panel.
// Cuerpo del correo: el panel escribe en texto con **negritas** (lo que propone
// la IA y lo que edita Alain). Sale como multipart: HTML (negrita de verdad,
// párrafos con su aire, enlaces clicables) + texto plano sin asteriscos, para
// los clientes que no leen HTML. Los dos acaban con una línea en blanco: así
// el dossier adjunto queda debajo, aparte, y no pegado a la última frase.
// ---------------------------------------------------------------------------
const escaparHtml = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function lineaHtml(l: string): string {
  let h = escaparHtml(l);
  h = h.replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>");
  h = h.replace(/(^|[\s(])(https?:\/\/[^\s<)]+[^\s<).,;:!?])/g, '$1<a href="$2">$2</a>');
  h = h.replace(/(^|[\s(])([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/g, '$1<a href="mailto:$2">$2</a>');
  return h;
}

const limpiar = (texto: string) => texto.replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").trim();

/** Los párrafos en HTML (lo mismo que verá el destinatario). También para la vista previa del panel. */
export function parrafosHtml(texto: string): string {
  return limpiar(texto)
    .split(/\n{2,}/)
    .map((p) => {
      const lineas = p.split("\n").map((l) => l.replace(/^[ \t]*[-*] +/, "• "));
      return `<p style="margin:0 0 1em 0;">${lineas.map(lineaHtml).join("<br>\n")}</p>`;
    })
    .join("\n");
}

/** ¿Lleva formato que en texto plano se vería raro (negritas, viñetas)? */
export const tieneFormato = (texto: string) => /\*\*[^*\n]+\*\*|^[ \t]*[-*] +/m.test(texto);

export function cuerpoCorreo(texto: string): { text: string; html: string } {
  const plano = limpiar(texto).replace(/\*\*([^*\n]+?)\*\*/g, "$1").replace(/^[ \t]*[-*] +/gm, "• ");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><div style="font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a;">\n${parrafosHtml(texto)}\n</div><br></body></html>`;
  return { text: `${plano}\n\n`, html };
}
