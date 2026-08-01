"use client";

import Link from "next/link";
import { useEffect } from "react";
import type { Testimonial } from "@/lib/magic-config";

const MAILTO = `mailto:alain@alainzulaika.com?subject=${encodeURIComponent(
  "Event enquiry"
)}&body=${encodeURIComponent(
  "What the event is:\nRoughly when:\nWhere:\nHow many people:"
)}`;

interface MagicClientProps {
  showSchedule: boolean;
  testimonials: Testimonial[];
}

export default function MagicClient({ showSchedule, testimonials }: MagicClientProps) {
  useEffect(() => {
    const elements = document.querySelectorAll(".fade-in");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("visible");
        });
      },
      { threshold: 0.12 }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <main className="min-h-screen bg-[#0B0B0C] text-[#F2F2F0]">

      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0B0B0C]/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-8 py-4 md:px-16">
          <Link href="/" className="text-[0.82rem] md:text-[0.96rem] uppercase tracking-[0.1em] md:tracking-[0.35em] text-[#2ED3E6]">
            Niala
          </Link>
        </div>
      </header>

      {/* BLOQUE 0 — Horarios (temporal, desaparece el 9 de agosto de 2026, hora de Bruselas) */}
      {showSchedule && (
        <section className="fade-in border-b border-white/10">
          <div className="mx-auto max-w-[1400px] px-8 py-6 md:px-16">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.95rem] md:text-[1rem]">
              <span className="live-dot text-[#2ED3E6]" aria-hidden="true" />
              <span className="font-medium">This week: Parkkaffe, Ghent</span>
              <span className="text-[#F2F2F0]/35">·</span>
              <span className="font-medium">6, 7 and 8 August</span>
            </div>
            <p className="mt-3 text-[0.9rem] text-[#F2F2F0]/60">
              Three 30-minute experiences every night: <span className="text-[#F2F2F0]/85">20:00 · 21:00 · 22:00</span>
            </p>
            <p className="mt-1 text-[0.85rem] text-[#F2F2F0]/45">Free. Limited seating. Come early.</p>
          </div>
        </section>
      )}

      {/* HERO */}
      <section
        className={`mx-auto flex max-w-[1400px] flex-col justify-center px-8 md:px-16 ${
          showSchedule ? "min-h-[70vh]" : "min-h-screen"
        }`}
      >
        <div className="relative -translate-y-8 md:-translate-y-10">
          <div className="absolute left-0 top-0 w-[2px] bg-white/15" style={{ height: "141px" }} />
          <div className="pl-5 md:pl-10">
            <p className="hero-fade-1 mb-8 text-[0.82rem] tracking-[0.35em] text-[#2ED3E6] uppercase">
              Niala · Magician
            </p>
            <h1 className="hero-fade-2 max-w-[860px] text-[clamp(2.8rem,5vw,4.8rem)] font-medium leading-[1.03] tracking-[-0.03em]">
              He fell off his chair.
            </h1>
            <div className="hero-fade-3 mt-8 max-w-[680px]">
              <p className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/75">
                Literally. Backwards. Chair and all.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* BLOQUE 1 — La historia */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-28 md:px-16 md:pb-36">
        <div className="max-w-[760px]">
          <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}
            className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72">
            <p>He wasn&rsquo;t drunk.<br />Nobody pushed him.</p>
            <p>A few of us from school were sitting at a table in a friend&rsquo;s garden on a quiet afternoon. Jon among them.<br />We see each other less every year.<br />There was a pool, and the afternoon was long — so I took out a deck of cards.</p>
            <p>I hadn&rsquo;t done magic for Jon in years.</p>
            <p>When the impossible moment came, his body reacted before his head did.<br />He threw his weight back, the chair gave way, and he ended up on the grass looking at the sky.</p>
            <p>We laughed for a long time.</p>
            <p>I started when I was twelve. I&rsquo;ve been doing this for more than half my life — twelve of those years on stage, at more than 200 events.<br />This has happened maybe twice.</p>
            <p>It isn&rsquo;t normal.<br />Most people laugh.<br />Some call me something I can&rsquo;t print here.<br />Some go completely silent.<br />Almost everyone asks to see the deck.</p>
            <p>But every now and then someone reacts with their whole body.<br />They stand up.<br />They walk or run away.<br />They drop whatever they were holding.</p>
            <p>That reaction can&rsquo;t be faked, and it can&rsquo;t be forced.<br />It only shows up when someone believes — even for a second and a half — that they just saw something that cannot happen.</p>
            <p>There aren&rsquo;t many jobs where doing your work well means somebody falls backwards off a chair.</p>
          </div>
        </div>
      </section>

      {/* BLOQUE 2 — Autoridad */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-28 md:px-16 md:pb-36">
        <div className="max-w-[760px]">
          <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}
            className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72">
            <p>Trade fairs, company dinners, open days, theatres, town festivals, private parties.</p>
            <p>I don&rsquo;t have famous logos to show you. What I have is this: almost every job I get comes from someone who saw me at somebody else&rsquo;s event.</p>
            <p>I work in English, Spanish, Basque and even without speaking.</p>
            <p>I&rsquo;m based in northern Spain, and I travel.</p>
          </div>
        </div>
      </section>

      {/* Testimonios — componente ya montado, oculto hasta que haya contenido (admin → Magic) */}
      {testimonials.length > 0 && (
        <section className="fade-in mx-auto max-w-[1400px] px-8 pb-28 md:px-16 md:pb-36">
          <div className="max-w-[760px]" style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            {testimonials.map((t, i) => (
              <blockquote key={i} className="border-l-2 border-white/15 pl-6">
                <p className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/85 italic">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <footer className="mt-3 text-[0.8rem] uppercase tracking-[0.15em] text-[#F2F2F0]/45">
                  {t.author}
                </footer>
              </blockquote>
            ))}
          </div>
        </section>
      )}

      {/* BLOQUE 3 — Para qué me contratan */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-28 md:px-16 md:pb-36">
        <div className="max-w-[760px]">
          <h2 className="text-[clamp(1.85rem,3.1vw,2.8rem)] font-medium leading-[1.08] tracking-[-0.04em] mb-10">
            My job isn&rsquo;t always to entertain
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}
            className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72">
            <p><strong className="text-[#F2F2F0]">At a trade fair</strong> it&rsquo;s to stop the people walking past your stand, get their attention, and hand them to your sales team warm instead of cold. If you&rsquo;re exhibiting in Spain and you need someone local who works in English, this is the most useful thing I do.</p>
            <p><strong className="text-[#F2F2F0]">At an open day or a public-facing event,</strong> getting attention is easy. Getting your message remembered afterwards is another job entirely. I build the magic around your message so it becomes the thing people repeat in the car on the way home.</p>
            <p><strong className="text-[#F2F2F0]">At an internal company event,</strong> the job is getting a room full of colleagues to loosen up and share something together.</p>
            <p><strong className="text-[#F2F2F0]">At a private celebration,</strong> it&rsquo;s whatever you want it to be. Every one is its own thing. Tell me yours.</p>
          </div>
        </div>
      </section>

      {/* BLOQUE 4 — Qué formato necesitas */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-28 md:px-16 md:pb-36">
        <div className="max-w-[760px]">
          <h2 className="text-[clamp(1.85rem,3.1vw,2.8rem)] font-medium leading-[1.08] tracking-[-0.04em] mb-10">
            Which one do you need?
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}
            className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72">
            <p><strong className="text-[#F2F2F0]">Are your guests sitting down and facing forward?</strong> Then it&rsquo;s a show — or a shorter piece built into the programme, if there&rsquo;s a message to land.</p>
            <p><strong className="text-[#F2F2F0]">Are they standing around with a drink in their hand?</strong> Then I move between groups, table to table, corner to corner. Nobody has to stop what they&rsquo;re doing.</p>
            <p>Some events want or need both. Audiences of up to around 600 people. Length always depends on the event.</p>
          </div>
        </div>
      </section>

      {/* BLOQUE 5 — Cómo funciona */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-28 md:px-16 md:pb-36">
        <div className="max-w-[760px]">
          <h2 className="text-[clamp(1.85rem,3.1vw,2.8rem)] font-medium leading-[1.08] tracking-[-0.04em] mb-10">
            How this works
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}
            className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72">
            <p>Every event is different, so I don&rsquo;t sell a fixed package. But it&rsquo;s simple.</p>
            <p><strong className="text-[#F2F2F0]">Step one:</strong> you tell me what the event is, what the space looks like, and what you want to get out of it.</p>
            <p><strong className="text-[#F2F2F0]">Step two:</strong> I tell you what I&rsquo;d do, and what it would cost.</p>
            <p>You don&rsquo;t need a stage, a sound system or anything special. Tell me what you&rsquo;ve got and I&rsquo;ll work with it.</p>
          </div>
        </div>
      </section>

      {/* BLOQUE 6 — CTA */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-40 md:px-16 md:pb-52">
        <div className="max-w-[760px]">
          <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}
            className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#F2F2F0]/72 mb-10">
            <p>I need four things: what the event is, roughly when, where, and how many people you expect.</p>
            <p>You&rsquo;ll get a recommendation for your case and a price. If I&rsquo;m not the right fit for what you&rsquo;re doing, I&rsquo;ll tell you that too.</p>
          </div>
          <a
            href={MAILTO}
            className="inline-block border border-white/20 px-10 py-4 text-[0.98rem] tracking-[0.08em] text-[#F2F2F0] transition-all duration-300 hover:border-white/40 hover:bg-white/[0.03] hover:text-[#2ED3E6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2ED3E6]"
            style={{ textDecoration: "none" }}
          >
            alain@alainzulaika.com
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/6 px-8 py-14 md:px-16">
        <div className="mx-auto max-w-[1400px]">
          <p className="text-[0.9rem] text-[#F2F2F0]/38">© Niala</p>
        </div>
      </footer>

    </main>
  );
}
