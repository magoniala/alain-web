// /arreta: encuesta anónima de alumnos (QR de las tarjetas). Se sirve como HTML
// estático desde un route handler, NO como página de React, a propósito: así
// queda fuera del layout raíz y no carga el píxel de Whop, Vercel Analytics ni
// Speed Insights. Sin cookies, sin analítica, sin scripts de terceros.
// El diseño y los textos son los de arreta-index.html tal cual; solo se ha
// rellenado ENDPOINT, añadido el campo señuelo «web» y la charla por ?c=slug
// (se envía como `saioa`; sin parámetro sigue siendo «hernani-2026-11»).

export const dynamic = "force-static";

// Oparitxoak (pantalla de gracias): enlaces simples en pestaña nueva, sin
// incrustar nada ni contar clics. La calculadora corre solo en el navegador.

// Reseña pública en Google: enlace de «Pedir reseñas» de su ficha de Google Business
// (algo como https://g.page/r/…/review). Vacío = el bloque no se muestra. Va al final
// de la pantalla de gracias, separado de los regalos (Google prohíbe dar algo a cambio
// de reseñas) y avisando de que NO es anónimo.
const GOOGLE_RESENA_URL = "https://g.page/r/Cfas3AtUqbFLEBM/review";
const GOOGLE_RESENA = GOOGLE_RESENA_URL
  ? `<p class="review">Nahi baduzu, Google-n iritzi publiko bat ere utzi dezakezu. Hau <strong>ez da anonimoa</strong>: zure Google izenarekin agertuko da.<br><a href="${GOOGLE_RESENA_URL}" target="_blank" rel="noopener noreferrer">Utzi iritzia Google-n ↗<span class="sr"> (fitxa berrian)</span></a></p>`
  : "";

const HTML = `<!doctype html>
<html lang="eu">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Arreta · Alain Zulaika</title>
<style>
:root{--bg:#0b0b0b;--panel:#161616;--line:#2a2a2a;--text:#fff;--muted:#a8a8a8;--cyan:#00D4FF}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.5;-webkit-text-size-adjust:100%}
main{max-width:560px;margin:0 auto;padding:28px 16px 64px}
.brand{text-align:center;font-weight:800;letter-spacing:.28em;font-size:13px}
.brand:after{content:"";display:block;width:44px;height:3px;background:var(--cyan);margin:10px auto 0}
h1{font-size:30px;line-height:1.15;margin:28px 0 8px;text-align:center}
.lead{color:var(--muted);text-align:center;margin:0 0 18px}
form{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:20px 16px}
fieldset{border:0;margin:0 0 22px;padding:0}
legend,label.q,p.q{display:block;font-weight:700;font-size:19px;line-height:1.3;margin:0 0 14px;padding:0}
.opt{color:var(--muted);font-weight:400;font-size:13px;margin-left:6px}
.choices{display:grid;gap:8px}
.choices input{position:absolute;opacity:0;pointer-events:none}
.choices label{display:block;border:1.5px solid var(--line);border-radius:8px;padding:12px 14px;cursor:pointer;font-size:16px}
.choices input:checked+label{border-color:var(--cyan);background:rgba(0,212,255,.12);font-weight:700}
.choices input:focus-visible+label{outline:2px solid var(--cyan);outline-offset:2px}
textarea{width:100%;min-height:96px;background:var(--bg);color:var(--text);border:1.5px solid var(--line);border-radius:8px;padding:12px;font:inherit;font-size:16px;resize:vertical}
textarea:focus{outline:2px solid var(--cyan);outline-offset:1px;border-color:var(--cyan)}
button{width:100%;background:var(--cyan);color:#0b0b0b;border:0;border-radius:8px;padding:15px;font:inherit;font-weight:800;font-size:17px;cursor:pointer}
button:disabled{opacity:.5}
.note{color:var(--muted);font-size:13px;margin:14px 0 0;text-align:center}
.err{color:#ff8a8a;font-size:14px;margin:10px 0 0;display:none;text-align:center}
.thanks{display:none;background:var(--panel);border:1px solid var(--cyan);border-radius:10px;padding:26px 18px;text-align:center}
.thanks h2{margin:0 0 6px;font-size:24px}
h2.sec{font-size:26px;margin:52px 0 6px;text-align:center;scroll-margin-top:16px}
.sec-sub{color:var(--muted);text-align:center;margin:0 0 20px}
svg{display:block;width:100%;height:auto;margin:0 auto 18px}
.box p,.box li{font-size:16px}
.box ul{padding-left:20px;margin:10px 0}
.trick{border-left:3px solid var(--cyan);padding:2px 0 2px 14px;margin:20px 0 0}
.video{margin-top:26px;border:1.5px dashed var(--line);border-radius:10px;padding:22px 14px;text-align:center;color:var(--muted)}
footer{margin-top:44px;text-align:center;color:var(--muted);font-size:13px}
.teaser{border:1.5px solid var(--cyan);border-radius:10px;padding:14px 16px;margin:0 0 16px;background:rgba(0,212,255,.06)}
.hint{font-weight:800;font-size:17px;margin:0 0 8px}
.teaser ul{margin:0;padding-left:18px}
.teaser li{font-size:15px;color:#d6d6d6;margin:0 0 4px}
.teaser li strong{color:var(--text)}
.teaser .more{color:var(--muted);font-size:14px;margin:8px 0 0}
.gifts{margin-top:24px;text-align:left}
.gifts h3{font-size:21px;margin:0 0 4px;text-align:center}
.gifts .intro{color:var(--muted);text-align:center;margin:0 0 16px;font-size:15px}
.gift{display:block;background:var(--bg);border:1.5px solid var(--line);border-radius:10px;padding:16px 14px;margin:0 0 12px;color:var(--text);text-decoration:none;animation:pop .45s ease both}
.gift:nth-of-type(2){animation-delay:.12s}
.gift:nth-of-type(3){animation-delay:.24s}
.gift:hover{border-color:var(--cyan)}
.gift:focus-visible{outline:2px solid var(--cyan);outline-offset:2px;border-color:var(--cyan)}
.gift strong{display:block;font-size:17px;margin-bottom:6px}
.gift .t{display:block;font-size:15px;color:#d6d6d6}
.gift .go{display:inline-block;margin-top:10px;color:var(--cyan);font-weight:800;font-size:14px}
.after{margin:6px 0 0}
.flowtalk{margin-top:26px;animation:none}
.after a{color:var(--cyan);font-weight:700;font-size:14px}
.gifts details{border-top:1px solid var(--line)}
.gifts details:last-of-type{border-bottom:1px solid var(--line)}
.gifts summary{cursor:pointer;list-style:none;font-weight:800;font-size:17px;padding:14px 28px 14px 0;position:relative}
.gifts summary::-webkit-details-marker{display:none}
.gifts summary:after{content:"+";position:absolute;right:4px;top:12px;color:var(--cyan);font-size:22px;line-height:1}
.gifts details[open]>summary:after{content:"–"}
.gifts summary:focus-visible{outline:2px solid var(--cyan);outline-offset:2px}
.gifts .body{padding:0 0 14px}
.gifts .body>p{font-size:15px;color:#d6d6d6;margin:0 0 12px}
.keys{padding-left:18px;margin:0}
.keys li{font-size:15px;color:#d6d6d6;margin:0 0 12px}
.keys strong{color:var(--text)}
.keys li ul{margin:8px 0 0;padding-left:18px}
.keys li li{margin:0 0 6px}
.books .sub{margin:18px 0 0;padding-top:12px;border-top:1px solid var(--line);color:var(--muted);font-size:14px}
.help{color:var(--muted);font-size:14px;margin:-4px 0 12px}
.nota{grid-template-columns:repeat(5,1fr)}
.nota label{text-align:center;font-weight:700;font-size:20px;padding:14px 0}
.scale{display:flex;justify-content:space-between;color:var(--muted);font-size:13px;margin-top:8px}
.hours{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.hours.three{grid-template-columns:1fr 1fr 1fr}
.hours label{display:block;font-size:14px;color:#d6d6d6;margin:0 0 6px}
.hours input{width:100%;background:var(--bg);color:var(--text);border:1.5px solid var(--line);border-radius:8px;padding:12px;font:inherit;font-size:16px}
.calc .hours input{background:var(--panel)}
.hours input:focus{outline:2px solid var(--cyan);outline-offset:1px;border-color:var(--cyan)}
.unit{display:block;color:var(--muted);font-size:12px;margin-top:4px}
.calc{display:block;background:var(--bg);border:1.5px solid var(--line);border-radius:10px;padding:16px 14px;margin:0 0 12px}
.calc .t{font-size:15px;color:#d6d6d6;margin:0 0 12px}
.cout{margin:14px 0 0}
.cout p{margin:0 0 10px;font-size:15px;color:#d6d6d6}
.cout p.big{font-size:17px;font-weight:800;color:var(--cyan)}
.hero{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 16px}
.hero.one{grid-template-columns:1fr}
.tile{border-radius:10px;padding:14px 10px;text-align:center}
.tile.loss{background:rgba(255,77,77,.12);border:1.5px solid #ff4d4d}
.tile.gain{background:rgba(0,212,255,.12);border:1.5px solid var(--cyan)}
.tile .n{display:block;font-size:44px;font-weight:900;line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.tile.loss .n{color:#ff6b6b}
.tile.gain .n{color:var(--cyan)}
.tile .u{display:block;font-weight:800;font-size:17px;margin-top:4px}
.tile .l{display:block;font-size:12.5px;color:#d6d6d6;margin-top:6px;line-height:1.35}
.leg{font-size:12.5px;color:#d6d6d6;margin:0 0 6px}
.stack{display:flex;height:26px;border-radius:6px;overflow:hidden;background:var(--line);margin:0 0 6px}
.stack span{display:block;height:100%}
.blabel{font-size:12px;color:var(--muted);margin:10px 0 4px;letter-spacing:.06em}
.tbl{width:100%;border-collapse:collapse;margin-top:14px;font-size:13.5px}
.tbl th{font-weight:700;text-align:right;color:var(--muted);padding:4px 0}
.tbl th:first-child,.tbl td:first-child{text-align:left}
.tbl td{padding:6px 0;border-top:1px solid var(--line);text-align:right;color:#d6d6d6;vertical-align:top}
.tbl th:not(:first-child),.tbl td:not(:first-child){white-space:nowrap;padding-left:16px}
.tbl td strong{color:var(--text);font-weight:700}
.yr{display:block;color:var(--muted);font-size:12px}
.dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px}
.fine{color:var(--muted);font-size:12.5px;margin:12px 0 0}
.review{margin:22px 0 0;padding-top:14px;border-top:1px solid var(--line);color:var(--muted);font-size:13px;text-align:center}
.review a{color:var(--muted);text-decoration:underline}
.books h4{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:16px 0 6px}
.books ul{margin:0;padding-left:18px}
.books li{font-size:15px;margin:0 0 4px}
.books li span{color:var(--muted)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.prog{display:flex;align-items:center;gap:10px;margin:0 0 20px}
.pn{font-size:13px;color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap}
.bar{flex:1;height:4px;background:var(--line);border-radius:2px;overflow:hidden}
.bar i{display:block;height:100%;width:20%;background:var(--cyan);transition:width .3s ease}
.step{animation:slide .25s ease both}
.step[hidden]{display:none}
.nav{display:flex;gap:10px;margin-top:24px}
.nav .back{flex:0 0 auto;width:auto;background:none;color:var(--muted);border:1.5px solid var(--line);padding:15px 16px;font-weight:700}
.nav .back[hidden]{display:none}
.flowlink{text-align:center;margin:18px 0 0;font-size:14px}
.flowlink a{color:var(--muted);text-decoration:underline;text-underline-offset:3px}
.cta{border:1.5px solid var(--cyan);border-radius:10px;padding:20px 16px;margin:30px 0 0;background:rgba(0,212,255,.06);text-align:center}
.cta p{margin:0 0 6px;color:#d6d6d6;font-size:15px}
.cta .hint{color:var(--text)}
.btn{display:block;background:var(--cyan);color:#0b0b0b;font-weight:800;font-size:17px;text-decoration:none;border-radius:8px;padding:15px;margin:14px 0 0}
.btn:focus-visible{outline:2px solid #fff;outline-offset:2px}
.slabels{display:flex;margin:0 0 4px}
.slabels span{display:block;font-size:11px;line-height:1.2;color:#d6d6d6;overflow:hidden;white-space:nowrap;text-overflow:clip;padding-left:2px}
.slabels span.free{color:var(--cyan);font-weight:700}
.empty{color:var(--muted);font-size:14px;margin:12px 0 0}
@keyframes slide{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:none}}
@keyframes pop{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.gift,.step{animation:none}.bar i{transition:none}}
</style>
</head>
<body>
<main>
<div class="brand">ALAIN ZULAIKA</div>
<h1>Zer iruditu zaizu hitzaldia?</h1>
<p class="lead">Galdetegi anonimoa · 5 galdera · minutu 1</p>

<div class="teaser" id="teaser">
  <p class="hint">🎁 Erantzun galdetegia eta zure opariak irekiko dira</p>
  <ul>
    <li><strong>Zenbat urte emango dituzu mugikorrari begira?</strong> Kalkulatu zurea.</li>
    <li><strong>Katu batek zure karta asmatuko du.</strong> Bai, katu batek.</li>
    <li><strong>Nor da hiltzailea?</strong> Arreta-proba bat.</li>
  </ul>
  <p class="more">…eta beste batzuk, sorpresa. Amaitzean ikusiko dituzu.</p>
</div>

<form id="f" novalidate>
  <div class="prog" aria-hidden="true"><span class="pn" id="pn">1 / 5</span><div class="bar"><i id="pb"></i></div></div>

  <div class="step" id="s1" role="group" aria-labelledby="q1">
    <p class="q" id="q1">Zer nota jarriko zenioke hitzaldiari?</p>
    <div class="choices nota">
      <input type="radio" name="nota" id="n1" value="1"><label for="n1">1</label>
      <input type="radio" name="nota" id="n2" value="2"><label for="n2">2</label>
      <input type="radio" name="nota" id="n3" value="3"><label for="n3">3</label>
      <input type="radio" name="nota" id="n4" value="4"><label for="n4">4</label>
      <input type="radio" name="nota" id="n5" value="5"><label for="n5">5</label>
    </div>
    <div class="scale"><span>1 = oso gaizki</span><span>5 = oso ondo</span></div>
  </div>

  <div class="step" id="s2" role="group" aria-labelledby="q2" hidden>
    <p class="q" id="q2">Zenbat ordu ematen dituzu egunean mugikorrari begira?<span class="opt">aukerazkoa</span></p>
    <p class="help">Batez beste. Mugikorraren ezarpenetan ikus dezakezu («Pantaila-denbora» edo «Ongizate digitala»).</p>
    <div class="hours">
      <div><label for="ordu_orain">Orain</label><input type="text" inputmode="decimal" autocomplete="off" id="ordu_orain" name="ordu_orain" maxlength="4"><span class="unit">ordu egunean</span></div>
      <div><label for="ordu_nahi">Nahiko nuke</label><input type="text" inputmode="decimal" autocomplete="off" id="ordu_nahi" name="ordu_nahi" maxlength="4"><span class="unit">ordu egunean</span></div>
    </div>
  </div>

  <div class="step" id="s3" hidden>
    <label class="q" for="ikasi">Zer ikasi duzu zure buruari buruz?<span class="opt">aukerazkoa</span></label>
    <textarea id="ikasi" name="ikasi" maxlength="1000"></textarea>
  </div>

  <div class="step" id="s4" hidden>
    <label class="q" for="gustatu">Zer gustatu zaizu gehien?<span class="opt">aukerazkoa</span></label>
    <textarea id="gustatu" name="gustatu" maxlength="1000"></textarea>
  </div>

  <div class="step" id="s5" hidden>
    <label class="q" for="gehitu">Zerbait gehitu nahi duzu?<span class="opt">aukerazkoa</span></label>
    <textarea id="gehitu" name="gehitu" maxlength="1000"></textarea>
  </div>

  <div aria-hidden="true" style="position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden"><label>Web <input type="text" name="web" tabindex="-1" autocomplete="off"></label></div>
  <div class="nav">
    <button type="button" class="back" id="back" hidden>← Atzera</button>
    <button type="submit" id="send">Ados →</button>
  </div>
  <p class="err" id="err" role="alert"></p>
  <p class="note">Anonimoa da: ez dugu izenik, posta elektronikorik ez beste daturik jasotzen. Erantzunak, izenik gabe, hitzaldia hobetzeko eta ikastetxeari erakusteko erabil daitezke.</p>
</form>
<p class="flowlink" id="flowlink"><a href="#flow">Txartelako flow-aren azalpena, behean ↓</a></p>

<div class="thanks" id="thanks" tabindex="-1">
  <div role="status">
    <h2>Eskerrik asko!</h2>
    <p>Zure erantzuna jaso dugu.</p>
  </div>
  <section class="gifts" aria-labelledby="oparitxoak">
    <h3 id="oparitxoak">Oparitxoak 🎁</h3>
    <p class="intro">Hitzaldia ez da hemen amaitzen. Hona hemen etxean probatzeko eta ikasten jarraitzeko zerbait.</p>

    <details>
      <summary>⏳ Zenbat denbora irabaziko zenuke mugikorra gutxiago erabilita?</summary>
      <div class="body">
        <div class="calc">
          <p class="t">Idatzi egunean zenbat ordu ematen dituzun mugikorrean eta zenbatera jaitsi nahiko zenukeen. 80 urte bete arte zenbat denbora den ikusiko duzu, eta zenbat irabaziko zenukeen. Kalkulagailua zure mugikorrean bakarrik dabil: ez da ezer bidaltzen.</p>
          <div class="hours three">
            <div><label for="c-orain">Orain</label><input type="text" inputmode="decimal" autocomplete="off" id="c-orain" maxlength="4"><span class="unit">ordu egunean</span></div>
            <div><label for="c-nahi">Nahiko nuke</label><input type="text" inputmode="decimal" autocomplete="off" id="c-nahi" maxlength="4"><span class="unit">ordu egunean</span></div>
            <div><label for="c-adina">Zure adina</label><input type="text" inputmode="numeric" autocomplete="off" id="c-adina" maxlength="2" value="14"><span class="unit">urte</span></div>
          </div>
          <div class="hero" id="c-hero" aria-live="polite"></div>
          <div class="cout" id="c-out"></div>
          <div id="c-bars" aria-hidden="true"></div>
          <div id="c-table"></div>
          <p class="fine">Gutxi gorabeherako balioak, ikasturteko egun arrunt baterako. Gainerako orduak (7), denbora librea eta mugikorra dira. Mugikorraren zati bat beste gauzekin batera gertatzen da (ikastetxean, jaten…), baina hemen denbora libretik kentzen da. Adina kalkulurako bakarrik da: ez da gordetzen eta ez da bidaltzen.</p>
        </div>
      </div>
    </details>

    <details>
      <summary>🧪 Probatu etxean</summary>
      <div class="body">
        <a class="gift" href="https://www.youtube.com/watch?v=vJG698U2Mvo" target="_blank" rel="noopener noreferrer">
          <strong>Gorila ikusezina</strong>
          <span class="t">Erakutsi bideo hau zure familiako norbaiti edo lagun bati, aurretik ezer kontatu gabe. Eskatu iezaiozu zuriz jantzitako jokalariek baloia zenbat aldiz pasatzen duten zenbatzeko. Gero, galdetu ea beste ezer nabaritu duen.</span>
          <span class="go">Ikusi bideoa ↗<span class="sr"> (fitxa berrian)</span></span>
        </a>
        <a class="gift" href="https://www.youtube.com/watch?v=urGHeUPHHCE" target="_blank" rel="noopener noreferrer">
          <strong>Asmatuko du zure karta?</strong>
          <span class="t">Aukeratu karta bat buruan, inori esan gabe. Bideoak zurea kenduko duela dio… eta badirudi asmatu duela. Ikusi berriro, arretaz: zer gertatu da benetan? Gaztelaniaz, oso laburra.</span>
          <span class="go">Ikusi bideoa ↗<span class="sr"> (fitxa berrian)</span></span>
        </a>
        <a class="gift" href="https://www.youtube.com/watch?v=j8bcu4_r_v4" target="_blank" rel="noopener noreferrer">
          <strong>Nor da hiltzailea?</strong>
          <span class="t">Arreta-proba bat da. Ikusi bideoa eta asmatu nor den hiltzailea. Ingelesez dago.</span>
          <span class="go">Ikusi bideoa ↗<span class="sr"> (fitxa berrian)</span></span>
        </a>
      </div>
    </details>

    <details>
      <summary>🧠 Hitzaldiaren gakoak</summary>
      <div class="body">
        <ul class="keys">
          <li><strong>Arreta denbora baino baliotsuagoa da.</strong> Denok ditugu 24 ordu, baina arreta non jartzen duzun, hortik eraikitzen da zure bizitza: arreta → pentsamenduak → ekintzak → ohiturak → bizitza.</li>
          <li><strong>Ez duzu dena ikusten.</strong> Arreta gela ilun bateko linterna bat bezalakoa da: argiztatzen duzuna ikusten duzu; gainerakoa, ez. Horregatik engainatzen zaituzte magoek: ez dizkizute begiak engainatzen, arreta gidatzen dizute.</li>
          <li><strong>Ez da diziplina falta bakarrik.</strong> Aplikazio askoren negozioa zure denbora da: zenbat eta denbora gehiago eman barruan, orduan eta iragarki gehiago. Ordaintzen ez baduzu, produktua zu zara.</li>
          <li><strong>Scroll infinitua ez da kasualitatea.</strong> Lehen, orrialde bat amaitzean erabaki behar zenuen jarraitu ala ez; orain ez dago gelditzeko unerik. Eta ez dakizunez noiz agertuko den hurrengo gauza interesgarria, jarraitu egiten duzu, txanpon-makina batean bezala.</li>
          <li><strong>Multitasking-a tranpa da.</strong> Garunak ez ditu bi zeregin zail batera egiten: batetik bestera salto egiten du, eta salto bakoitzak energia eta denbora kostatzen ditu.</li>
          <li><strong>Aspertzea ona da.</strong> Ezer egiten ari ez zarenean, garunak ideiak lotzen ditu, oroitzapenak antolatzen ditu eta sormena elikatzen du.</li>
          <li><strong>Lo egiteak garuna garbitzen du.</strong> Lotan zaudela, garunak egunean pilatutako hondakinak kentzen ditu. Gutxi lo eginez gero, arreta da galtzen den lehen gauzetako bat.</li>
        </ul>
      </div>
    </details>

    <details>
      <summary>🛠️ Arreta berreskuratzeko 4 gomendio</summary>
      <div class="body">
        <ul class="keys">
          <li><strong>I. Urrundu tentazioa.</strong> Mugikorra beste gela batean, edo blokeatzeko aplikazio bat (Freedom, adibidez). Ulisesek bezala: lotu zaitez mastara.</li>
          <li><strong>II. Zeregin bakarra.</strong> Entrenatu arreta gihar bat bezala: hasi 10 minutuz, mugikorrik gabe, eta igo pixkanaka.</li>
          <li><strong>III. Utzi aspertzen.</strong> Ez bete hutsune guztiak pantailarekin: hortik sortzen dira ideia onenak.</li>
          <li><strong>IV. Zuk agintzen duzu, ez aplikazioek.</strong> Zure arreta ez da inork lapurtzeko baliabidea. Gaur bertan egin ditzakezun aldaketak:
            <ul>
              <li>Kendu jakinarazpenak behar ez dituzun aplikazioetan.</li>
              <li>Gauean, mugikorra logelatik kanpo kargatu. Esnagailu bat erabili, eta ez ibili mugikorrarekin ohean.</li>
              <li>Desaktibatu autoplay-a eta jarri aplikazioetan denbora-mugak.</li>
              <li>Jarri pantaila zuri-beltzean: kolore biziak ere diseinuaren parte dira.</li>
              <li>Astebetez, ezabatu scroll infinitua duen aplikazio bat. Gero, erabaki ea faltan bota duzun.</li>
            </ul>
          </li>
        </ul>
      </div>
    </details>

    <details>
      <summary>🎬 Ikasten jarraitzeko</summary>
      <div class="body">
        <a class="gift" href="https://www.ted.com/talks/tristan_harris_how_a_handful_of_tech_companies_control_billions_of_minds_every_day" target="_blank" rel="noopener noreferrer">
          <strong>Nork kontrolatzen du zure arreta?</strong>
          <span class="t">Tristan Harris Google-n aritu zen diseinuaren etikan. Hemen azaltzen du nola diseinatzen diren aplikazioak zure arreta ahalik eta denbora gehien harrapatzeko. Ingelesez, 17 minutu.</span>
          <span class="go">Ikusi hitzaldia ↗<span class="sr"> (fitxa berrian)</span></span>
        </a>
      </div>
    </details>

    <details class="books">
      <summary>📚 Liburuak</summary>
      <div class="body">
        <p>Ez dituzu denak irakurri behar. Aukeratu bat, hasi, eta utzi harritzen. Eta gogoratu: ikasitakoa aplikatu gabe, irakurtzeak ez du ezertarako balio.</p>
        <h4>Arreta eta flow-a</h4>
        <ul>
          <li>Fluir (Flow) <span>· Mihaly Csikszentmihalyi</span></li>
          <li>El valor de la atención <span>· Johann Hari</span></li>
          <li>Céntrate (Deep Work) <span>· Cal Newport</span></li>
        </ul>
        <p class="sub">Eta, arretatik kanpo, nik pertsonalki gomendatzen ditudanak:</p>
        <h4>Komunikazioa</h4>
        <ul>
          <li>Cómo ganar amigos e influir sobre las personas <span>· Dale Carnegie</span></li>
          <li>Persuasión y poder <span>· Fernando Miralles</span></li>
        </ul>
        <h4>Salmentak</h4>
        <ul>
          <li>El libro de copywriting <span>· Isra Bravo</span></li>
          <li>La vaca púrpura <span>· Seth Godin</span></li>
        </ul>
        <h4>Sormena</h4>
        <ul>
          <li>Seis sombreros para pensar <span>· Edward de Bono</span></li>
          <li>El camino del artista <span>· Julia Cameron</span></li>
        </ul>
        <h4>Norbere burua ezagutzeko</h4>
        <ul>
          <li>El sutil arte de que (casi todo) te importe una mierda <span>· Mark Manson</span></li>
          <li>Deja de ser tú <span>· Joe Dispenza</span></li>
        </ul>
        <h4>Antolaketa eta diziplina</h4>
        <ul>
          <li>El método Bullet Journal <span>· Ryder Carroll</span></li>
          <li>Hábitos atómicos <span>· James Clear</span></li>
        </ul>
        <h4>Inspirazioa</h4>
        <ul>
          <li>El hombre en busca de sentido <span>· Viktor Frankl</span></li>
          <li>12 reglas para vivir <span>· Jordan B. Peterson</span></li>
        </ul>
      </div>
    </details>
  </section>
  <p class="after"><a href="#flow">Behean: flow-aren azalpena eta Csikszentmihalyiren hitzaldia ↓</a></p>
  ${GOOGLE_RESENA}
</div>

<h2 class="sec" id="flow">Flow-a, azalduta</h2>
<p class="sec-sub">Noiz sartzen zara flow-ean?</p>

<svg viewBox="-14 -6 124 122" role="img" aria-label="Flow diagrama: erronka eta trebetasuna">
  <g stroke="#fff" stroke-width=".5" stroke-linejoin="round">
    <polygon points="0,0 29.6,0 50,50 0,29.6" fill="#1f1f1f"/>
    <polygon points="29.6,0 70.4,0 50,50" fill="#0b0b0b"/>
    <polygon points="70.4,0 100,0 100,29.6 50,50" fill="#00D4FF"/>
    <polygon points="100,29.6 100,70.4 50,50" fill="#0b0b0b"/>
    <polygon points="100,70.4 100,100 70.4,100 50,50" fill="#1f1f1f"/>
    <polygon points="70.4,100 29.6,100 50,50" fill="#0b0b0b"/>
    <polygon points="29.6,100 0,100 0,70.4 50,50" fill="#1f1f1f"/>
    <polygon points="0,70.4 0,29.6 50,50" fill="#0b0b0b"/>
  </g>
  <g fill="#fff" font-family="Inter,system-ui,sans-serif" font-size="5.2" font-weight="600" text-anchor="middle">
    <text x="19" y="17">Antsietatea</text>
    <text x="50" y="14">Aktibazioa</text>
    <text x="84" y="19" fill="#0b0b0b" font-size="8.5" font-weight="900">FLOW</text>
    <text x="82" y="52">Kontrola</text>
    <text x="80" y="84">Erlaxazioa</text>
    <text x="50" y="92">Aspertura</text>
    <text x="19" y="84">Apatia</text>
    <text x="17" y="52">Kezka</text>
  </g>
  <g fill="#a8a8a8" font-family="Inter,system-ui,sans-serif" font-size="4.2" text-anchor="middle">
    <text x="50" y="108" fill="#fff" font-weight="800" letter-spacing=".8">TREBETASUNA →</text>
    <text x="0" y="104" text-anchor="start">Baxua</text>
    <text x="100" y="104" text-anchor="end">Altua</text>
    <text transform="translate(-8,50) rotate(-90)" fill="#fff" font-weight="800" letter-spacing=".8">ERRONKA →</text>
  </g>
</svg>

<div class="box">
  <p>Flow-a zeregin batean guztiz sartuta zaudenean sentitzen duzuna da: denbora ahazten duzu eta ondo ateratzen zaizu. Bi gauza elkartzean gertatzen da: <strong>erronka</strong> (zeregina zein zaila den) eta <strong>trebetasuna</strong> (zuk zenbat dakizun).</p>
  <ul>
    <li>Erronka altuegia eta trebetasuna baxua → kezka edo antsietatea.</li>
    <li>Erronka baxua eta trebetasuna altua → aspertura edo erlaxazioa.</li>
    <li>Biak baxuak → apatia.</li>
    <li>Biak altuak eta orekatuak → <strong>flow</strong>.</li>
  </ul>
  <p class="trick"><strong>Trikimailua:</strong> aukeratu zeregin bat eta egokitu zailtasuna zure mailara: apur bat zailagoa, baina ez gehiegi. Ondo ateratzen bazaizu, igo maila pixka bat. Larrituta bazaude, jaitsi.</p>
</div>

<a class="gift flowtalk" href="https://www.ted.com/talks/mihaly_csikszentmihalyi_flow_the_secret_to_happiness" target="_blank" rel="noopener noreferrer">
  <strong>Flow-a, bere sortzailearen eskutik</strong>
  <span class="t">Mihaly Csikszentmihalyik azaltzen du zer den flow-a eta zergatik sentitzen garen hain ondo bertan. Ez zara like-en zain dagoen uso bat: erronken bila dabilen sortzailea zara. Ingelesez, ia 19 minutu.</span>
  <span class="go">Ikusi hitzaldia ↗<span class="sr"> (fitxa berrian)</span></span>
</a>

<div class="cta" id="cta">
  <p class="hint" id="cta-t">🎁 Zure opariak zain daude</p>
  <p id="cta-p">Erantzun galdetegia (minutu 1) eta ireki: zure mugikor-denboraren kalkulagailua, karta asmatzen duen katua, hiltzailearen proba eta gehiago.</p>
  <a class="btn" id="cta-b" href="#teaser">Erantzun galdetegia →</a>
</div>

<footer>© Alain Zulaika</footer>
</main>

<script>
// Dónde se guardan las respuestas. Rellenar antes de publicar (ver nota «Landing y encuesta anónima de alumnos»).
// Debe aceptar un POST JSON y NO guardar IP, ni cookies, ni identificadores.
var ENDPOINT = "/api/arreta";
// Charla: ?c=<slug> en el QR. Sin parámetro (tarjetas de Hernani ya impresas), la de Hernani.
var SAIOA = (function(){try{var c=(new URLSearchParams(location.search).get("c")||"").toLowerCase();return /^[a-z0-9-]{1,60}$/.test(c)?c:"hernani-2026-11"}catch(e){return "hernani-2026-11"}})();

// Calculadora de Oparitxoak: solo en el navegador, no envía nada.
var setCalc=function(){};
(function(){
var A=document.getElementById("c-orain"),B=document.getElementById("c-nahi"),Y=document.getElementById("c-adina"),H=document.getElementById("c-hero"),O=document.getElementById("c-out"),S=document.getElementById("c-bars"),T=document.getElementById("c-table");
if(!A)return;
// Bloques fijos en grises parecidos: lo que tiene que verse es el rojo (móvil) frente al cian (libre).
var BASE=[["Lo egin",8,"#4a4a52","Lo · 8 h"],["Ikasi / lan egin",7,"#5d5d66","Ikasi · 7 h"],["Jan eta garbitasuna",2,"#73737c","Jan"]];
var PHONE="#ff4d4d",FREE="#00D4FF",ROOM=7;
function num(e){var v=parseFloat(String(e.value).replace(",","."));return isFinite(v)?v:NaN}
function fmt(n){return String(Math.round(n*10)/10).replace(".",",")}
function yu(y){return y<1?[fmt(y*12),"hilabete"]:[fmt(y),"urte"]}
function yrs(y){var x=yu(y);return x[0]+" "+x[1]}
function seg(h,c){return '<span style="width:'+(h/24*100)+'%;background:'+c+'"></span>'}
function stack(p){var ph=Math.min(p,ROOM),r="";for(var i=0;i<BASE.length;i++)r+=seg(BASE[i][1],BASE[i][2]);return r+seg(ph,PHONE)+seg(ROOM-ph,FREE)}
function dot(c){return '<span class="dot" style="background:'+c+'"></span>'}
function labels(){var r="";for(var i=0;i<BASE.length;i++)r+='<span style="width:'+(BASE[i][1]/24*100)+'%">'+BASE[i][3]+'</span>';return '<div class="slabels" aria-hidden="true">'+r+'<span class="free" style="width:'+(ROOM/24*100)+'%">'+ROOM+' ordu libre</span></div>'}
function bar(lbl,p,R){return '<p class="blabel">'+lbl+'</p><div class="stack">'+stack(p)+'</div><p class="leg">'+dot(PHONE)+'Mugikorra '+yrs(p/24*R)+' &nbsp; '+dot(FREE)+'Libre '+yrs(Math.max(0,ROOM-p)/24*R)+'</p>'}
function cell(h,R){return '<strong>'+fmt(h)+' h</strong><span class="yr">'+yrs(h/24*R)+'</span>'}
function row(c,n,h1,h2,R){return '<tr><td>'+dot(c)+n+'</td><td>'+cell(h1,R)+'</td><td>'+cell(h2,R)+'</td></tr>'}
function render(){
 var a=num(A),b=num(B),age=num(Y);
 if(!(a>=0&&a<=24&&b>=0&&b<=24)){H.innerHTML="";O.innerHTML='<p class="empty">Idatzi bi zenbakiak (orain eta nahiko nuke) emaitza ikusteko.</p>';S.innerHTML="";T.innerHTML="";return}
 if(!(age>=5&&age<=79))age=14;
 var R=80-age,diff=a-b,L=yu(a/24*R),h;
 h='<div class="tile loss"><span class="n">'+L[0]+'</span><span class="u">'+L[1]+'</span><span class="l">mugikorrari begira, 80 urtera arte (egunean '+fmt(a)+' ordu)</span></div>';
 if(diff>0){var G=yu(diff/24*R);h+='<div class="tile gain"><span class="n">+'+G[0]+'</span><span class="u">'+G[1]+'</span><span class="l">zuretzat, egunean '+fmt(b)+' ordura jaitsiz gero</span></div>'}
 H.className=diff>0?"hero":"hero one";H.innerHTML=h;
 var o='<p>Egunean '+fmt(a)+' ordu = urtean '+Math.round(a*365/24)+' egun oso mugikorrean.'+(a<=16?' Esna zauden denboraren %'+Math.round(a/16*100)+'.':'')+'</p>';
 o+=diff>0?'<p>'+fmt(b)+' ordura jaitsiz gero: egunean '+fmt(diff)+' ordu eta urtean '+Math.round(diff*365/24)+' egun gehiago zuretzat.</p>':'<p class="big">Zenbaki hauekin ez duzu denborarik irabazten. Jaitsi «Nahiko nuke» zenbakia.</p>';
 o+='<p class="fine">Urteak 24 orduko egun osoetan neurtuta.</p>';
 O.innerHTML=o;
 S.innerHTML=labels()+bar("ZURE EGUNA, ORAIN",a,R)+bar("ALDATUTA",b,R);
 var t='<table class="tbl"><thead><tr><th></th><th>Orain</th><th>Aldatuta</th></tr></thead><tbody>';
 t+=row(PHONE,"Mugikorra",a,b,R)+row(FREE,"Denbora librea",Math.max(0,ROOM-a),Math.max(0,ROOM-b),R);
 T.innerHTML=t+'</tbody></table><p class="fine">Gainerakoa ez da aldatzen: lo (8 h), ikasi / lan egin (7 h) eta jan eta garbitasuna (2 h) berdin jarraitzen dute.</p>';
}
A.addEventListener("input",render);B.addEventListener("input",render);Y.addEventListener("input",render);
setCalc=function(a,b){A.value=String(a).replace(".",",");B.value=String(b).replace(".",",");render()};
})();

var f=document.getElementById("f"),err=document.getElementById("err"),btn=document.getElementById("send"),th=document.getElementById("thanks"),back=document.getElementById("back"),pn=document.getElementById("pn"),pb=document.getElementById("pb");
var TOTAL=5,cur=1;
function hrs(v){var n=parseFloat(String(v==null?"":v).replace(",","."));return isFinite(n)&&n>=0&&n<=24?Math.round(n*10)/10:null}
function show(n,foco){
  cur=n;
  for(var i=1;i<=TOTAL;i++)document.getElementById("s"+i).hidden=(i!==n);
  pn.textContent=n+" / "+TOTAL;pb.style.width=(n/TOTAL*100)+"%";
  back.hidden=(n===1);btn.textContent=(n===TOTAL?"Bidali ✓":"Ados →");
  err.style.display="none";
  if(foco){var e=document.querySelector("#s"+n+" input[type=text],#s"+n+" textarea");if(e)try{e.focus({preventScroll:true})}catch(x){}}
}
function problema(n){
  if(n===1&&!f.querySelector("input[name=nota]:checked"))return "Aukeratu nota bat (1etik 5era).";
  if(n===2){
    var ro=f.ordu_orain.value.trim(),rn=f.ordu_nahi.value.trim();
    if((ro&&hrs(ro)===null)||(rn&&hrs(rn)===null))return "Idatzi ordu kopuru bat 0 eta 24 artean (edo utzi hutsik).";
  }
  return "";
}
back.addEventListener("click",function(){if(cur>1)show(cur-1,true)});
f.addEventListener("submit",function(e){
  e.preventDefault();
  var m=problema(cur);
  if(m){err.textContent=m;err.style.display="block";return}
  if(cur<TOTAL){show(cur+1,true);return}
  err.style.display="none";
  var d=new FormData(f), nt=parseInt(d.get("nota"),10), ro=String(d.get("ordu_orain")||"").trim(), rn=String(d.get("ordu_nahi")||"").trim(), oa=ro?hrs(ro):null, na=rn?hrs(rn):null;
  var body={nota:nt,ordu_orain:oa,ordu_nahi:na,ikasi:d.get("ikasi")||"",gustatu:d.get("gustatu")||"",gehitu:d.get("gehitu")||"",saioa:SAIOA,web:d.get("web")||""};
  btn.disabled=true;
  if(!ENDPOINT){btn.disabled=false;err.textContent="Oraindik ez dago konektatuta (ENDPOINT hutsik).";err.style.display="block";return}
  fetch(ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),credentials:"omit",referrerPolicy:"no-referrer"})
  .then(function(r){if(!r.ok)throw 0;if(oa!==null&&na!==null)setCalc(oa,na);f.style.display="none";document.getElementById("flowlink").style.display="none";document.getElementById("teaser").style.display="none";document.getElementById("cta-t").textContent="🎁 Zure opariak goian daude";document.getElementById("cta-p").textContent="Eskerrik asko erantzuteagatik! Kalkulagailua, bideoak eta gainerakoak orrialdearen hasieran dituzu.";var cb=document.getElementById("cta-b");cb.textContent="Ireki oparitxoak ↑";cb.setAttribute("href","#oparitxoak");th.style.display="block";th.focus();window.scrollTo(0,0)})
  .catch(function(){btn.disabled=false;err.textContent="Ezin izan da bidali. Saiatu berriro.";err.style.display="block"});
});
show(1,false);
</script>
</body>
</html>
`;

export function GET() {
  return new Response(HTML, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
