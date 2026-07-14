"use client";

import { useEffect, useState } from "react";
import {
  AMBER,
  NAVY,
  Lines,
  MapaCTA,
  Header,
  Footer,
  inputStyle,
  labelStyle,
  fieldStyle,
  proseP,
  sectionTitle,
  emphasisP,
  cardStyle,
} from "../_ui";

const TURNO_OPTIONS = ["Goizez", "Arratsaldez", "Berdin zait"];

const TOTAL_PLAZAS = 10;

export default function ValoracionEntrenatzaileEuPage() {
  const [formData, setFormData] = useState({
    nombre: "",
    edad: "",
    email: "",
    motivo: "",
    turno: "",
    newsletter: false,
  });
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [hoveredTurno, setHoveredTurno] = useState<string | null>(null);

  useEffect(() => {
    const fetchRemaining = () => {
      fetch("/api/entrenatzaile/valoracion")
        .then((r) => r.json())
        .then((d) => setRemaining(typeof d.remaining === "number" ? d.remaining : null))
        .catch(() => {});
    };
    fetchRemaining();
    const interval = setInterval(fetchRemaining, 20000);
    return () => clearInterval(interval);
  }, []);

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

  const full = remaining !== null && remaining <= 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!formData.nombre.trim() || !formData.edad.trim() || !formData.email.trim() || !formData.motivo.trim()) {
      setError("Bete beharrezko eremu guztiak, mesedez.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      setError("Sartu baliozko helbide elektroniko bat.");
      return;
    }
    const edadNum = Number(formData.edad);
    if (!Number.isFinite(edadNum) || edadNum < 14 || edadNum > 100) {
      setError("Sartu baliozko adin bat.");
      return;
    }
    if (!formData.turno) {
      setError("Adierazi noiz duzun denbora libre gehiago.");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/entrenatzaile/valoracion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, edad: edadNum, idioma: "eu" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Zerbait gaizki joan da. Saiatu berriro edo idatzi niri zuzenean.");
        if (typeof data.remaining === "number") setRemaining(data.remaining);
        return;
      }
      setDone(true);
      if (typeof data.remaining === "number") setRemaining(data.remaining);
    } catch {
      setError("Zerbait gaizki joan da. Saiatu berriro edo idatzi niri zuzenean.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FAF3E8] text-[#0F2240]">
      <Header current="eu" />

      {/* HERO */}
      <section className="w-full bg-[#D4860A] px-8 py-24 md:px-16 md:py-32">
        <div className="relative mx-auto max-w-[1400px]">
          <div className="absolute left-0 top-0 w-[2px] bg-[#1C3A5E]/30 h-[242px] md:h-[287px] xl:h-[329px]" />

          <div className="pl-5 md:pl-10">
            <p className="hero-fade-1 mb-8 text-[0.82rem] tracking-[0.35em] text-[#0F2240]">
              <span className="uppercase">Doako</span> balorazioa
            </p>

            <h1 className="hero-fade-2 max-w-[900px] text-[clamp(1.9rem,5vw,4.8rem)] font-medium leading-[1.03] tracking-[-0.03em] text-[#0F2240]">
              Eta urteak badaramatzazu bueltaka?
            </h1>

            <div className="hero-fade-3 mt-8 max-w-[600px]">
              <p className="text-[clamp(1.35rem,1.8vw,1.65rem)] leading-relaxed text-[#0F2240]/75">
                Ez duzu beste ahaleginik behar. Mapa hobea behar duzu.
              </p>
            </div>

            <div className="hero-fade-3 mt-10">
              <a
                href="#formulario"
                className="inline-block scale-100 bg-[#1C3A5E] px-10 py-4 text-[0.98rem] tracking-[0.08em] text-[#FAF3E8] shadow-md transition-all duration-200 hover:scale-105 hover:bg-[#0F2240] hover:shadow-lg"
              >
                Nire mapa nahi dut
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* GORPUTZ NAGUSIA — maparen metafora */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-24 pt-20 md:px-16 md:pt-28">
        <div className="max-w-[680px]">
          <Lines lines={["Madrildik Minks-era autoz joan nahi duzu.", "Maparik, GPSrik eta konpainiarik gabe."]} />
          <Lines
            lines={[
              "Ez dakizu zein bide hartu.",
              "Kartelei begira zaude.",
              "Bat ikusten duzunean, arnasa hartzen duzu.",
              "Hogei minutu igarotzen dituzunean bat ere ikusi gabe, zalantzaka hasten zara.",
              "“Ondo noa? Lehengo irteera hura hartu behar ote nuen?”",
            ]}
          />
          <Lines
            lines={[
              "Gasolindegi batean gelditu eta galdetzen hasten zara.",
              "Ulertzen ez dituzun argibide batzuk ematen dizkizute.",
              "Jarraitzen duzu.",
              "Hamar kilometrora berriz ere zalantza egiten duzu “bigarrena eskuinera” edo “bigarrena ezkerrera” esan ote zizuten.",
            ]}
          />
          <Lines lines={["Eta horrela denbora guztian.", "Galdetu, zalantzak, atzera egin, zuzendu."]} />
          <Lines
            lines={[
              "Kilometro askoz gehiago.",
              "Ordu askoz gehiago.",
              "Askoz ere gastu handiagoa gasolinan.",
              "Eta “merezi al du jarraitzea?” pentsamenduak.",
              "Asko iristen dira, baina beranduago, nekatuta, planetan ez zegoena jasan izanaren sentsazioarekin.",
            ]}
            mb="6.5rem"
          />

          <p style={emphasisP}>Orain imajinatu gauza bera mapa batekin.</p>
          <Lines
            lines={[
              "Zer ikusirik ez.",
              "Plan batekin ateratzen zara.",
              "Badakizu nondik joan behar duzun.",
              "Noizean behin, begiratu, orientatu eta jarraitu egiten duzu.",
            ]}
          />
          <Lines lines={["Zalantza gutxiago.", "Galdera gutxiago.", "Buelta gutxiago."]} />
          <Lines
            lines={[
              "Hala ere, espero ez zenuen trabaren bat jaten duzu.",
              "Saihets zenezakeen bidesariren bat.",
              "Obren ondoriozko desbideratzeren bat.",
            ]}
          />
          <p style={{ ...emphasisP, marginBottom: "6.5rem" }}>
            Baina iritsi zara. Eta lehenago iristen zara. Ia estresik gabe.
          </p>

          <p style={emphasisP}>Eta gainera kopilotu bat baduzu (edo Google Maps)...</p>
          <Lines
            lines={[
              "Zure ondoan “Biratu hemen, hartu bigarren irteera, kontuz trabak egon ohi diren tarte honekin, erreserba baxua daramazun hurrengo gasolindegian gelditzeko” esaten dizun norbait.",
            ]}
          />
          <Lines
            lines={[
              "Zuk ikusten ez duzunari aurrea hartzen dio.",
              "Ustekabeko zerbait agertzen denean bidea doitzen dizu.",
              "Zurekin doa bide osoan.",
            ]}
          />
          <Lines
            lines={[
              "Gaur egun edonork egiten duena da.",
              "Ikasi dugu maparik eta kopiloturik gabe joatea asko kostatzen zaigula.",
            ]}
            mb="6.5rem"
          />

          <p style={emphasisP}>Edozein aldaketa fisikorekin gauza bera gertatzen da.</p>
          <Lines lines={["Baina askok oraindik uste dute maparik gabe joan daitezkeela arazorik gabe."]} />
          <Lines
            lines={[
              "Ziztu bizian doaz.",
              "Gauza batekin hasten dira, eta, gero, beste batekin, zalantzan jartzen dute korrika egin edo pisua altxatu, eta makina batzuk probatzen dituzte, beraientzat eginak ote diren ez dakitenak.",
            ]}
          />
          <Lines
            lines={[
              "Entrenatzen ari den lankide bati galdetzen diote eta gauza bat esaten diote.",
              "Ondo doakion beste bati galdetu eta kontrakoa esaten diote. Itsumustuan bultzaka.",
            ]}
          />
          <p style={proseP}>
            Askotan urteak pasa ahala emaitzaren bat ikusten dute, baina gidatuta, denbora, esfortzu eta diru
            gutxiagorekin lor zezaketenarekin alderatuta ezer ez.
          </p>
          <Lines
            lines={[
              "Maparekin, badakizu zer lehenetsi eta zer saihestu.",
              "Badakizu zer itxaron 3 hilabete barru. Zer 12 hilabetera.",
              "Zuzen zoaz.",
              "Zuk erabaki behar duzu, baina irizpidez erabakitzen duzu.",
            ]}
          />
          <p style={emphasisP}>
            Maparekin eta kopilotuarekin, gainean norbait duzu bidea doitzen ustekabeko bat agertzen denean —
            molestia bat, aste arraro bat, zure bizitzako aldaketa bat — eta pixka bat gehiago eskatzen,
            konturatu gabe motz gera zintezkeenean.
          </p>
        </div>
      </section>

      {/* HAU ZER DEN */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-24 md:px-16">
        <div className="max-w-[680px]">
          <p style={emphasisP}>Asteak daramatzat mapa hori diseinatzen.</p>
          <p style={proseP}>
            Hasierako balorazio-protokolo bat, zure benetako egoera jasotzen duena (historia, lesioak, ohiturak,
            jarrera-kontrola, gorputz-osaera, indarra, kardioa, mugikortasuna) eta zure plan pertsonalizatua duen
            fitxa bat prestatzen dizuna.
          </p>
          <Lines lines={["Zer lehenetsi.", "Zer saihestu.", "Zer itxaron 3 hilabete barru.", "Zer 12tan."]} />
          <Lines
            lines={[
              "Zure kabuz, nirekin edo beste entrenatzaile batekin jarrai dezakezun mapa pertsonalizatua.",
              "Konpromisorik gabe.",
            ]}
          />
          <p style={emphasisP}>Eta zure 90 minutu baino gutxiagotan egingo dizut.</p>
        </div>
      </section>

      {/* ESKAINTZA + KONTAGAILUA + FORMULARIOA */}
      <section id="formulario" className="fade-in mx-auto max-w-[1400px] px-8 pb-32 md:px-16 md:pb-40">
        <div className="max-w-[680px]">
          <Lines
            lines={[
              "Zerbitzua finkatuta dagoenean, mapa hau egiteak bere prezioa izango du.",
              "Orain hasierako fasean nago eta protokoloa benetako pertsonekin probatu nahi dut itxi aurretik.",
            ]}
          />
          <p style={emphasisP}>Horregatik erabaki dut doan egitea eskatzen didaten lehen 10 pertsonei.</p>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.65rem",
              border: `1px solid ${full ? "rgba(28,58,94,0.18)" : "rgba(212,134,10,0.35)"}`,
              background: full ? "rgba(28,58,94,0.04)" : "rgba(212,134,10,0.08)",
              padding: "0.7rem 1.2rem",
              marginBottom: "2.5rem",
            }}
          >
            <span
              className="live-dot"
              style={{ color: full ? "rgba(28,58,94,0.45)" : AMBER, flexShrink: 0 }}
            />
            <span style={{ fontSize: "clamp(1.1rem,1.5vw,1.35rem)", fontWeight: 500, color: full ? "rgba(28,58,94,0.55)" : AMBER }}>
              {remaining === null
                ? "Plaza kopurua eguneratzen…"
                : full
                ? "Plaza guztiak beteta daude"
                : `${remaining} plaza geratzen dira ${TOTAL_PLAZAS}etik`}
            </span>
          </div>
        </div>

        <div className="max-w-[600px]">
          {done ? (
            <div className="context-fade-in p-6 md:p-10" style={cardStyle}>
              <p style={{ fontSize: "clamp(1.5rem,2.4vw,2rem)", fontWeight: 500, letterSpacing: "-0.02em", marginBottom: "1rem", color: NAVY }}>
                Jasota, {formData.nombre.split(" ")[0]}.
              </p>
              <p style={{ fontSize: "1.1rem", lineHeight: 1.7, color: "rgba(15,34,64,0.80)" }}>
                48 ordu baino gutxiagoan kontaktatuko zaitut.
              </p>
            </div>
          ) : full ? (
            <div className="p-6 md:p-10" style={cardStyle}>
              <p style={{ fontSize: "1.1rem", lineHeight: 1.7, color: "rgba(15,34,64,0.80)" }}>
                Plaza guztiak beteta daude. Etorkizuneko irekierez jakinarazi nahi baduzu, idatzi hona{" "}
                <a href="mailto:contacto@niala.es" style={{ color: AMBER }}>
                  contacto@niala.es
                </a>
                .
              </p>
            </div>
          ) : (
            <div className="p-6 md:p-10" style={cardStyle}>
              <p style={{ fontSize: "clamp(1.15rem,1.45vw,1.35rem)", color: NAVY, marginBottom: "0.6rem", lineHeight: 1.4 }}>
                Eskatu zure doako balorazioa
              </p>
              <p style={{ fontSize: "0.95rem", color: "rgba(15,34,64,0.60)", marginBottom: "2rem", lineHeight: 1.6 }}>
                48 ordu baino gutxiagoan kontaktatzen zaitut 90 minutuko deia egiteko. Amaitzean, zure{" "}
                <strong style={{ textTransform: "uppercase", fontWeight: 700 }}>mapa</strong> pertsonalizatua
                idatziz jasotzen duzu.
              </p>

              <form onSubmit={handleSubmit}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Izena</label>
                  <input
                    type="text"
                    placeholder="Zure izena"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    style={inputStyle}
                    className="placeholder:text-[#1C3A5E]/35"
                  />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Adina</label>
                  <input
                    type="number"
                    placeholder="Zure adina"
                    value={formData.edad}
                    onChange={(e) => setFormData({ ...formData, edad: e.target.value })}
                    style={inputStyle}
                    className="placeholder:text-[#1C3A5E]/35"
                  />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Emaila</label>
                  <input
                    type="email"
                    placeholder="zure@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    style={inputStyle}
                    className="placeholder:text-[#1C3A5E]/35"
                  />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Zerk ekarri zaitu hona?</label>
                  <input
                    type="text"
                    placeholder="Esadazu esaldi batean."
                    value={formData.motivo}
                    onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
                    style={inputStyle}
                    className="placeholder:text-[#1C3A5E]/35"
                  />
                </div>

                <div style={{ marginBottom: "2rem" }}>
                  <label style={labelStyle}>Noiz izaten duzu denbora libre gehiago?</label>
                  <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
                    {TURNO_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setFormData({ ...formData, turno: opt })}
                        onMouseEnter={() => setHoveredTurno(opt)}
                        onMouseLeave={() => setHoveredTurno(null)}
                        style={{
                          padding: "0.55rem 1.1rem",
                          border:
                            formData.turno === opt
                              ? `1px solid ${AMBER}`
                              : "1px solid rgba(28,58,94,0.25)",
                          color:
                            formData.turno === opt
                              ? AMBER
                              : hoveredTurno === opt
                              ? NAVY
                              : "rgba(28,58,94,0.62)",
                          background: formData.turno === opt ? "rgba(212,134,10,0.08)" : "none",
                          fontSize: "0.9rem",
                          cursor: "pointer",
                          transition: "all 0.2s",
                        }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.6rem",
                    marginBottom: "2rem",
                    cursor: "pointer",
                    fontSize: "0.92rem",
                    lineHeight: 1.5,
                    color: "rgba(15,34,64,0.70)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={formData.newsletter}
                    onChange={(e) => setFormData({ ...formData, newsletter: e.target.checked })}
                    style={{ marginTop: "0.2rem" }}
                  />
                  Entrenamenduari eta osasunari buruzko mezuak jaso nahi ditut egunero. Doan, eta nahi dudanean
                  ematen dut baja.
                </label>

                {error && (
                  <p style={{ fontSize: "0.88rem", color: "#B3261E", marginBottom: "1rem" }}>
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={sending}
                  style={{
                    border: "none",
                    padding: "0.9rem 2.5rem",
                    fontSize: "0.98rem",
                    letterSpacing: "0.08em",
                    cursor: sending ? "default" : "pointer",
                    display: "block",
                    opacity: sending ? 0.6 : 1,
                  }}
                  className="scale-100 bg-[#1C3A5E] text-[#FAF3E8] shadow-md transition-all duration-200 hover:scale-105 hover:bg-[#0F2240] hover:shadow-lg"
                >
                  {sending ? "Bidaltzen..." : "Nire doako balorazioa eskatu"}
                </button>
              </form>
            </div>
          )}
        </div>
      </section>

      {/* OHIKO ZALANTZAK */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-24 md:px-16">
        <div className="max-w-[680px]">
          <p style={sectionTitle}>Ohiko zalantzak</p>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {[
              {
                q: "“Ez dut astirik.”",
                a: "Saioa 90 minutu dira, behin bakarrik. Ondoren, mapa idatzita daukazu, nahi duzunean eta nahi duzun moduan jarraitzeko.",
              },
              {
                q: "“Ez dakit honetarako sasoian nagoen.”",
                a: "Horretarako da, hain zuzen ere. Abiapuntuak ez du garrantzirik. Protokoloa dagoenari egokitzen zaio.",
              },
              {
                q: "“Urrun bizi naiz.”",
                a: "Balorazioa online egin daiteke. Zauden lekutik egin dezakezu.",
              },
            ].map(({ q, a }) => (
              <div key={q} className="p-5 md:p-6" style={cardStyle}>
                <p style={{ fontSize: "1.1rem", color: AMBER, marginBottom: "0.6rem" }}>{q}</p>
                <p style={{ ...proseP, marginBottom: 0 }}>{a}</p>
              </div>
            ))}
          </div>

          <div style={{ marginTop: "2.5rem" }}>
            <MapaCTA label="Nire mapa doan nahi dut" />
          </div>
        </div>
      </section>

      {/* BESTE KONTAKTU BIDE BAT */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-24 md:px-16">
        <div className="max-w-[680px]">
          <p style={{ fontSize: "1.15rem", color: "rgba(15,34,64,0.80)", marginBottom: "0.6rem" }}>
            Nahiago duzu niri zuzenean idaztea?
          </p>
          <a
            href="mailto:contacto@niala.es"
            style={{ fontSize: "clamp(1.15rem,1.45vw,1.35rem)", color: AMBER }}
            className="hover:opacity-80"
          >
            contacto@niala.es
          </a>
        </div>
      </section>

      {/* PD AZKENA — NORI BURUZ */}
      <section className="fade-in mx-auto max-w-[1400px] px-8 pb-32 md:px-16">
        <div className="max-w-[680px]" style={{ borderTop: "1px solid rgba(28,58,94,0.15)", paddingTop: "2rem" }}>
          <Lines
            lines={[
              "Alain Zulaika naiz (Entrenatzaile).",
              "14 urte daramatzat neure burua entrenatzen.",
              "Duela 6 urte entrenatzaile/monitore ikasketak amaitu nituen eta hainbat titulazio atera nituen.",
              "Bolada batean, hainbat pertsonari lagundu nien beren aldaketa fisikoan, eta orain berriz ekin diot.",
              "Esteka hau hurbileko norbaitek bidali badizu eta gehiago jakin nahi baduzu, bete formularioa.",
            ]}
          />
          <MapaCTA label="Nire mapa doan nahi dut" />
        </div>
      </section>

      <Footer />
    </main>
  );
}
