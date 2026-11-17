// Copiar al portapapeles sin window.prompt(): el panel en la app de escritorio
// de Claude no admite prompt() y el «Cópialo desde aquí» fallaba sin avisar.
// Primero la API del portapapeles; si no deja, el método clásico con un
// textarea oculto. Devuelve si se ha podido copiar.
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    /* se prueba el método clásico */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = texto;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
