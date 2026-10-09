"use client";

import { useRef, useState } from "react";
import { whopTrack } from "@/lib/whop";
import { ALIVIO_FORMULARIO as F, ALIVIO_PDF } from "@/lib/alivio";

/* ---------------------------------------------------------------------------
   Botón de la guía y el desplegable que pide el correo.

   Dos clics y fuera: abres, escribes el correo, envías. Sin nombre y sin
   salir de la página — antes mandaba al checkout de Whop, que volvía a pedir
   el correo, y eran dos formularios seguidos para una guía gratis.

   Va con <dialog> nativo y no con un div flotante porque trae gratis lo que
   hay que hacer bien en un modal: cierre con Esc, foco atrapado dentro y el
   resto de la página marcada como inerte para los lectores de pantalla.
   --------------------------------------------------------------------------- */

const CAMPO =
  "min-h-12 w-full rounded-xl border border-[#0F2240]/20 bg-[#F7F1E6] px-4 text-base text-[#0F2240] outline-none transition placeholder:text-[#0F2240]/35 focus:border-[#C47800]";

const BOTON_ENVIAR =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0F2240] px-7 font-semibold text-[#F7F1E6] transition hover:brightness-110 disabled:opacity-60";

const TITULAR = "font-[family-name:var(--font-fraunces)]";

function Flecha() {
  return (
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
  );
}

export default function BotonGuia({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const campo = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);

  function abrir() {
    whopTrack("add_to_cart", { content_name: "alivia_tu_lumbago_hoy" });
    dialogo.current?.showModal();
    // El foco al campo, no al aspa: la idea es abrir, escribir y darle. Sin
    // esto <dialog> enfoca el primer elemento del DOM, que es el de cerrar.
    campo.current?.focus();
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Ese email no parece válido.");
      return;
    }

    setEnviando(true);
    try {
      const res = await fetch("/api/entrenatzaile/alivio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Algo ha ido mal. Inténtalo de nuevo.");
        return;
      }
      whopTrack("complete_registration", { content_name: "alivia_tu_lumbago_hoy" });
      setListo(true);
    } catch {
      setError("Algo ha ido mal. Inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <button type="button" onClick={abrir} className={className}>
        {children}
      </button>

      <dialog
        ref={dialogo}
        onClick={(e) => {
          // Clic en el fondo: el <dialog> ocupa toda la ventana, así que el
          // propio dialogo es el "fuera" de la tarjeta.
          if (e.target === dialogo.current) dialogo.current?.close();
        }}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-[#E0D4C0] bg-[#EFE6D4] p-0 text-[#0F2240] backdrop:bg-[#0F2240]/60"
      >
        <div className="p-7 md:p-8">
          <button
            type="button"
            onClick={() => dialogo.current?.close()}
            aria-label="Cerrar"
            className="float-right -mt-2 -mr-2 p-2 text-2xl leading-none text-[#4A5C73] transition hover:text-[#0F2240]"
          >
            ×
          </button>

          {listo ? (
            <>
              <h2 className={`${TITULAR} text-2xl font-semibold tracking-tight`}>
                {F.listoTitulo}
              </h2>
              <p className="mt-3 text-[#4A5C73]">
                Te la he mandado a <strong className="text-[#0F2240]">{email.trim().toLowerCase()}</strong>.
              </p>
              <a
                href={`/api/nurture-pdf/${ALIVIO_PDF.slug}`}
                className={`${BOTON_ENVIAR} mt-6`}
              >
                {F.listoDescarga}
                <Flecha />
              </a>
              <p className="mt-4 text-center text-sm text-[#4A5C73]">{F.listoSpam}</p>
            </>
          ) : (
            <>
              <h2 className={`${TITULAR} text-2xl font-semibold tracking-tight`}>{F.titulo}</h2>
              <p className="mt-3 text-[#4A5C73]">{F.entrada}</p>

              <form onSubmit={enviar} className="mt-6 space-y-3">
                <input
                  ref={campo}
                  type="email"
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  placeholder={F.placeholder}
                  autoComplete="email"
                  className={CAMPO}
                />

                {error && <p className="text-sm text-[#B3261E]">{error}</p>}

                <button type="submit" disabled={enviando} className={BOTON_ENVIAR}>
                  {enviando ? F.enviando : F.boton}
                  {!enviando && <Flecha />}
                </button>
              </form>

              <p className="mt-4 text-center text-sm text-[#4A5C73]">{F.letraPequena}</p>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
