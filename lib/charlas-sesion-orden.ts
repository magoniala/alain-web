// Qué entra en la sesión de llamadas de charlas y en qué orden (decidido 24-nov-2026).
// Funciones puras, sin dependencias, para poder probarlas con `npm test`.

/** Fase de un estado de centro ("3.9 reenviado - pendiente" → 3, "0 Sin contactar" → 0). */
function fase(estado: string | null | undefined): number {
  const m = /^(\d+(?:\.\d+)?)/.exec(estado ?? "");
  return m ? Math.floor(Number(m[1])) : -1;
}

/** Rango dentro de la sesión: 0 = 3.9 reenviado (primero), 1 = sin correo (fase 0-2), null = no es llamada de sesión. */
export function rangoSesion(estado: string | null | undefined): 0 | 1 | null {
  if ((estado ?? "").startsWith("3.9")) return 0;
  const f = fase(estado);
  return f >= 0 && f <= 2 ? 1 : null;
}

/** Reordena `lista` poniendo las llamadas de sesión en los huecos que ya ocupaban, 3.9 primero y luego fase 0-2
 *  (dentro de cada grupo se mantiene el orden de entrada: fecha_proxima_accion). El resto no se mueve. */
export function ordenarParaSesion<T extends { estado: string }>(lista: T[]): T[] {
  const huecos: number[] = [];
  const llamadas: T[] = [];
  lista.forEach((c, i) => {
    if (rangoSesion(c.estado) !== null) {
      huecos.push(i);
      llamadas.push(c);
    }
  });
  llamadas.sort((a, b) => (rangoSesion(a.estado) as number) - (rangoSesion(b.estado) as number)); // sort estable
  const salida = [...lista];
  huecos.forEach((h, k) => (salida[h] = llamadas[k]));
  return salida;
}
