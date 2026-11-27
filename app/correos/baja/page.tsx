// Baja de los envíos a grupos (pie de esos mails). Una sola página, idioma en
// ?h= (eu por defecto). El enlace del mail trae el correo y su firma; aquí se
// pide confirmar con un botón, que es lo que apunta la baja (ver
// app/api/grupos/baja).
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

const T = {
  eu: {
    titulo: "Horrelako mezurik ez jasotzeko",
    texto: (e: string) => `Baieztatzen baduzu, ez dizut horrelako mezu gehiago bidaliko ${e} helbidera.`,
    boton: "Baieztatu",
    hecho: "Eginda. Ez duzu horrelako mezu gehiago jasoko.",
    error: "Ezin izan da egin. Idatzi info@alainzulaika.com helbidera eta neuk egingo dut.",
  },
  es: {
    titulo: "Dejar de recibir correos como este",
    texto: (e: string) => `Si confirmas, no te volveré a enviar correos como este a ${e}.`,
    boton: "Confirmar",
    hecho: "Hecho. No volverás a recibir correos como este.",
    error: "No se ha podido hacer. Escríbeme a contacto@alainzulaika.com y lo hago yo.",
  },
} as const;

export default async function BajaCorreos({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const h = q.h === "es" ? "es" : "eu";
  const t = T[h];
  const email = (q.e ?? "").trim();
  const mensaje = q.hecho ? t.hecho : q.error || (!email && !q.hecho) ? t.error : null;

  return (
    <main style={{ minHeight: "100vh", background: "#0B0B0C", color: "#F2F2F0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", textAlign: "center" }}>
      <p style={{ fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.35em", color: "#2ED3E6", marginBottom: "2.5rem" }}>Alain Zulaika</p>
      {mensaje ? (
        <p style={{ fontSize: "1.25rem", maxWidth: "460px", lineHeight: 1.75 }}>{mensaje}</p>
      ) : (
        <>
          <p style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", fontWeight: 500, letterSpacing: "-0.02em", marginBottom: "1.5rem" }}>{t.titulo}</p>
          <p style={{ fontSize: "1.1rem", color: "rgba(242,242,240,0.65)", maxWidth: "440px", lineHeight: 1.75, marginBottom: "2rem" }}>{t.texto(email)}</p>
          <form method="POST" action="/api/grupos/baja">
            <input type="hidden" name="e" value={email} />
            <input type="hidden" name="t" value={q.t ?? ""} />
            <input type="hidden" name="h" value={h} />
            <input type="hidden" name="m" value={q.m ?? ""} />
            <button type="submit" style={{ border: "1px solid #F2F2F0", background: "transparent", color: "#F2F2F0", padding: "0.85rem 1.8rem", fontSize: "1rem", letterSpacing: "0.04em", cursor: "pointer" }}>{t.boton}</button>
          </form>
        </>
      )}
    </main>
  );
}
