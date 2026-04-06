"use client";

import { useState, useEffect, useCallback } from "react";

const FOTOS = [
  "1.jpg", "2.JPG", "3.JPG", "4.jpg", "5.jpg", "6.jpg",
  "7.JPG", "8.jpg", "9.JPG", "10.jpg", "11.jpg", "12.jpg",
  "13.JPG", "14.jpg", "15.jpg", "16.jpg", "17.jpg",
];

const SHOWS: { fecha: string; texto: string }[] = [
  { fecha: "21 feb",  texto: "El estreno fue en Arrigorriaga." },
  { fecha: "23 mar",  texto: "Después estuvimos en el teatro Amaia de Irun participando en una Gala de Magia." },
  { fecha: "1 may",   texto: "Zarautz fue el siguiente hogar de Twobascos, en el Modelo." },
  { fecha: "16 may",  texto: "La Kutxa Fundazioa de Donostia nos abrió sus puertas." },
  { fecha: "14 jun",  texto: "Y con ganas de más... volvimos a Donostia, al teatro Imanol Larzabal. Otra Gala de Magia." },
  { fecha: "2 oct",   texto: "En el café-teatro San Agustín de Azpeitia también nació un nuevo pueblo." },
  { fecha: "5 nov",   texto: "El último fue en el Auditorium Itsas Etxea de Hondarribia." },
  { fecha: "27 dic",  texto: "Y para cerrar el año, de vuelta al teatro Amaia de Irun." },
];

const PRENSA = [
  {
    texto: "Twobascos en Herri Irratia",
    href: "https://radiopopular.com/podcast/twobascos-un-espectaculo-bilingue-que-reinventa-la-magia-en-euskal-herria",
    meta: null,
    sub: null,
  },
  {
    texto: "Twobascos en Distrito Euskadi, EITB",
    href: "https://www.eitb.eus/es/nahieran/radio/radio-euskadi/distrito-euskadi/detalle/9926832/",
    meta: "1:28:45",
    sub: { texto: "Vídeo de la magia", href: "https://x.com/DistritoEuskadi/status/1902388472180052378" },
  },
  {
    texto: "Twobascos seleccionados en el Katapulta Tour Gipuzkoa",
    href: "https://katapulta.org/portfolio/twobascos/",
    meta: "+150 artistas",
    sub: null,
  },
  {
    texto: "Twobascos en Tele 7",
    href: "https://www.youtube.com/watch?v=U3bSEXWUAl4&t=2692s",
    meta: "42:55",
    sub: null,
  },
];

const RED = "#CC2828";
const RED_HOVER = "rgba(204,40,40,0.6)";

export default function TwobascosPage() {
  const [lightbox, setLightbox] = useState<number | null>(null);

  const cerrar = useCallback(() => setLightbox(null), []);
  const anterior = useCallback(() =>
    setLightbox((i) => (i !== null ? (i - 1 + FOTOS.length) % FOTOS.length : null)), []);
  const siguiente = useCallback(() =>
    setLightbox((i) => (i !== null ? (i + 1) % FOTOS.length : null)), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (lightbox === null) return;
      if (e.key === "Escape") cerrar();
      if (e.key === "ArrowLeft") anterior();
      if (e.key === "ArrowRight") siguiente();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, cerrar, anterior, siguiente]);

  return (
    <main style={{ minHeight: "100vh", background: "#0B0B0C", color: "#F2F2F0" }}>

      {/* Header */}
      <header style={{ padding: "1.75rem 2rem", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <p style={{ fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.35em", color: RED }}>
          Twobascos
        </p>
        <div style={{ position: "absolute", right: "2rem", display: "flex", alignItems: "center", border: "1px solid rgba(242,242,240,0.16)", fontSize: "0.75rem", letterSpacing: "0.1em" }}>
          <a href="/twobascos-prentsa" style={{ padding: "0.3rem 0.65rem", color: "rgba(242,242,240,0.55)", textDecoration: "none", transition: "color 0.2s" }} onMouseEnter={e => (e.currentTarget.style.color = "rgba(242,242,240,0.90)")} onMouseLeave={e => (e.currentTarget.style.color = "rgba(242,242,240,0.55)")}>EUS</a>
          <span style={{ width: "1px", alignSelf: "stretch", background: "rgba(242,242,240,0.12)" }} />
          <span style={{ padding: "0.3rem 0.65rem", color: "#2ED3E6", background: "rgba(46,211,230,0.06)" }}>ES</span>
        </div>
      </header>

      <section style={{ maxWidth: "1100px", margin: "0 auto", padding: "1rem 1.5rem 6rem" }}>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
          <h1 style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1.08, marginBottom: "1rem" }}>
            Alain Zulaika y Sergio Martínez.
          </h1>
          <p style={{ fontSize: "clamp(1rem, 1.4vw, 1.1rem)", color: "rgba(242,242,240,0.42)", letterSpacing: "0.04em" }}>
            De dos mundos, nace un pueblo.
          </p>
        </div>

        {/* Galería */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: "0.6rem",
          marginBottom: "6rem",
        }}>
          {FOTOS.map((foto, i) => (
            <div
              key={foto}
              onClick={() => setLightbox(i)}
              style={{
                aspectRatio: "4/3",
                overflow: "hidden",
                cursor: "pointer",
                background: "rgba(242,242,240,0.04)",
              }}
            >
              <img
                src={`/twobascos/${foto}`}
                alt={`Twobascos foto ${i + 1}`}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                  transition: "transform 0.35s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
              />
            </div>
          ))}
        </div>

        {/* Espectáculos 2025 */}
        <div style={{ maxWidth: "680px", margin: "0 auto 6rem" }}>
          <p style={{ fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.35em", color: RED, marginBottom: "2.5rem" }}>
            Espectáculos 2025
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}>
            {SHOWS.map((show, i) => (
              <div key={i} style={{ display: "flex", gap: "2rem", alignItems: "baseline" }}>
                <span style={{
                  fontSize: "0.78rem",
                  color: "rgba(242,242,240,0.28)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  width: "3.5rem",
                }}>
                  {show.fecha}
                </span>
                <p style={{ fontSize: "1rem", lineHeight: 1.75, color: "rgba(242,242,240,0.70)", margin: 0 }}>
                  {show.texto}
                </p>
              </div>
            ))}
          </div>
          <div style={{ borderTop: "1px solid rgba(242,242,240,0.07)", marginTop: "2.5rem", paddingTop: "2rem" }}>
            <p style={{ fontSize: "1.05rem", color: "rgba(242,242,240,0.55)", lineHeight: 1.75, marginBottom: "0.5rem" }}>
              Esto solo ha sido el principio.
            </p>
            <p style={{ fontSize: "0.9rem", color: "rgba(242,242,240,0.28)", fontStyle: "italic" }}>
              Afilando hachas para 2026-2027...
            </p>
          </div>
        </div>

        {/* Prensa */}
        <div style={{ maxWidth: "680px", margin: "0 auto 6rem" }}>
          <p style={{ fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.35em", color: RED, marginBottom: "2.5rem" }}>
            Prensa
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
            {PRENSA.map((item, i) => (
              <div key={i}>
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", flexWrap: "wrap" }}>
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: "1rem",
                      color: "#F2F2F0",
                      textDecoration: "none",
                      borderBottom: "1px solid rgba(242,242,240,0.2)",
                      paddingBottom: "1px",
                      transition: "color 0.2s, border-color 0.2s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = RED; e.currentTarget.style.borderColor = RED_HOVER; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "#F2F2F0"; e.currentTarget.style.borderColor = "rgba(242,242,240,0.2)"; }}
                  >
                    {item.texto}
                  </a>
                  {item.meta && (
                    <span style={{ fontSize: "0.82rem", color: "rgba(242,242,240,0.32)" }}>{item.meta}</span>
                  )}
                </div>
                {item.sub && (
                  <div style={{ marginTop: "0.5rem", paddingLeft: "1rem" }}>
                    <a
                      href={item.sub.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: "0.9rem",
                        color: "rgba(242,242,240,0.45)",
                        textDecoration: "none",
                        borderBottom: "1px solid rgba(242,242,240,0.12)",
                        paddingBottom: "1px",
                        transition: "color 0.2s, border-color 0.2s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = RED; e.currentTarget.style.borderColor = RED_HOVER; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(242,242,240,0.45)"; e.currentTarget.style.borderColor = "rgba(242,242,240,0.12)"; }}
                    >
                      {item.sub.texto}
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "clamp(1.4rem, 2.2vw, 1.8rem)", fontWeight: 500, letterSpacing: "-0.02em", marginBottom: "0.75rem" }}>
            Preparados para crear un pueblo juntos.
          </p>
          <p style={{ fontSize: "0.95rem", color: "rgba(242,242,240,0.40)", marginBottom: "2rem" }}>
            Para más información:
          </p>
          <a
            href="mailto:contacto@niala.es?subject=Twobascos%20ikuskizunari%20buruz"
            style={{
              display: "inline-block",
              border: "1px solid rgba(242,242,240,0.2)",
              padding: "1rem 2.5rem",
              fontSize: "0.95rem",
              letterSpacing: "0.06em",
              color: "#F2F2F0",
              textDecoration: "none",
              transition: "border-color 0.3s, color 0.3s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = RED_HOVER; e.currentTarget.style.color = RED; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(242,242,240,0.2)"; e.currentTarget.style.color = "#F2F2F0"; }}
          >
            Aquí
          </a>
        </div>

      </section>

      {/* Lightbox */}
      {lightbox !== null && (
        <div
          onClick={cerrar}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.93)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 100, cursor: "zoom-out",
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); anterior(); }}
            style={{
              position: "absolute", left: "1.25rem",
              background: "none", border: "none",
              color: "rgba(242,242,240,0.55)", fontSize: "2.5rem",
              cursor: "pointer", padding: "1rem", lineHeight: 1,
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#F2F2F0")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(242,242,240,0.55)")}
          >
            ‹
          </button>

          <img
            src={`/twobascos/${FOTOS[lightbox]}`}
            alt={`Twobascos foto ${lightbox + 1}`}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxHeight: "90vh", maxWidth: "88vw",
              objectFit: "contain", cursor: "default",
            }}
          />

          <button
            onClick={(e) => { e.stopPropagation(); siguiente(); }}
            style={{
              position: "absolute", right: "1.25rem",
              background: "none", border: "none",
              color: "rgba(242,242,240,0.55)", fontSize: "2.5rem",
              cursor: "pointer", padding: "1rem", lineHeight: 1,
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#F2F2F0")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(242,242,240,0.55)")}
          >
            ›
          </button>

          <button
            onClick={cerrar}
            style={{
              position: "absolute", top: "1.25rem", right: "1.5rem",
              background: "none", border: "none",
              color: "rgba(242,242,240,0.45)", fontSize: "1.5rem",
              cursor: "pointer", padding: "0.5rem", lineHeight: 1,
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#F2F2F0")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(242,242,240,0.45)")}
          >
            ×
          </button>

          <p style={{
            position: "absolute", bottom: "1.25rem",
            fontSize: "0.78rem", color: "rgba(242,242,240,0.28)",
            letterSpacing: "0.12em", textTransform: "uppercase",
          }}>
            {lightbox + 1} / {FOTOS.length}
          </p>
        </div>
      )}

      {/* Footer */}
      <footer style={{ textAlign: "center", padding: "1.75rem 2rem", borderTop: "1px solid rgba(242,242,240,0.06)" }}>
        <p style={{ fontSize: "0.82rem", color: "rgba(242,242,240,0.25)" }}>© Alain Zulaika</p>
      </footer>

    </main>
  );
}
