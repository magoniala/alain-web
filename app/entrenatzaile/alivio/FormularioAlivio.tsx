"use client";

import { useState } from "react";
import { ALIVIO_CHECKOUT, ALIVIO_TEXTOS } from "@/lib/alivio";

/* ---------------------------------------------------------------------------
   El botón de descarga no descarga: primero da de alta en la newsletter con
   las etiquetas "lumbago" y "alivio", y acto seguido manda al checkout de
   Whop, que es donde está subida la guía y donde se entrega el acceso. El
   correo de bienvenida lleva el mismo enlace, por si cierran la pestaña.
   --------------------------------------------------------------------------- */

type Whop = { track: (evento: string, datos?: unknown) => void };

function track(evento: string, datos?: unknown) {
  if (typeof window === "undefined") return;
  (window as unknown as { whop?: Whop }).whop?.track(evento, datos);
}

const CAMPO =
  "min-h-12 w-full rounded-xl border border-[#0F2240]/15 bg-[#F7F1E6] px-4 text-base text-[#0F2240] outline-none transition placeholder:text-[#0F2240]/35 focus:border-[#C47800]";

export default function FormularioAlivio() {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!nombre.trim() || !email.trim()) {
      setError("Por favor, rellena tu nombre y tu email.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Introduce un email válido.");
      return;
    }

    setEnviando(true);
    try {
      const res = await fetch("/api/entrenatzaile/alivio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Algo ha ido mal. Inténtalo de nuevo.");
        return;
      }
      track("complete_registration", { content_name: "alivia_tu_lumbago_hoy" });
      setListo(true);
      // A por la guía. El estado "listo" queda detrás con el enlace visible
      // por si el navegador bloquea la redirección.
      window.location.href = ALIVIO_CHECKOUT;
    } catch {
      setError("Algo ha ido mal. Inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  if (listo) {
    return (
      <div className="mt-9">
        <p className="text-lg leading-relaxed text-[#0F2240]">
          Listo, {nombre.trim().split(" ")[0]}. Te llevo a la guía…
        </p>
        <a
          href={ALIVIO_CHECKOUT}
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0F2240] px-7 font-semibold text-[#F7F1E6] transition hover:brightness-110"
        >
          Si no se abre sola, entra aquí
        </a>
        <p className="mt-4 text-center text-sm text-[#4A5C73]">
          También te la mando a {email.trim().toLowerCase()}.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="mt-9 space-y-3">
      <input
        type="text"
        value={nombre}
        onChange={(ev) => setNombre(ev.target.value)}
        placeholder="Tu nombre"
        autoComplete="given-name"
        className={CAMPO}
      />
      <input
        type="email"
        value={email}
        onChange={(ev) => setEmail(ev.target.value)}
        placeholder="Tu email"
        autoComplete="email"
        className={CAMPO}
      />

      {error && <p className="text-sm text-[#B3261E]">{error}</p>}

      <button
        type="submit"
        disabled={enviando}
        onClick={() => track("add_to_cart", { content_name: "alivia_tu_lumbago_hoy" })}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0F2240] px-7 font-semibold text-[#F7F1E6] transition hover:brightness-110 disabled:opacity-60"
      >
        {enviando ? "Enviando…" : ALIVIO_TEXTOS.descarga.boton}
        {!enviando && (
          <svg
            className="size-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        )}
      </button>

      <p className="pt-1 text-center text-sm text-[#4A5C73]">
        {ALIVIO_TEXTOS.descarga.letraPequena} Te apuntas a la newsletter; te das de baja en un clic.
      </p>
    </form>
  );
}
