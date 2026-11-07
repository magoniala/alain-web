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
.jump{display:block;text-align:center;margin:0 auto 26px;width:max-content;max-width:100%;background:var(--cyan);color:#0b0b0b;font-weight:800;font-size:14px;padding:6px 12px;text-decoration:none;border-radius:2px}
form{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:20px 16px}
fieldset{border:0;margin:0 0 22px;padding:0}
legend,label.q{display:block;font-weight:700;font-size:17px;margin-bottom:10px;padding:0}
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
.calc{display:block;background:var(--bg);border:1.5px solid var(--line);border-radius:10px;padding:16px 14px;margin:0 0 12px}
.calc label{display:block;font-size:15px;color:#d6d6d6;margin:0 0 10px}
.calc input{width:110px;background:var(--panel);color:var(--text);border:1.5px solid var(--line);border-radius:8px;padding:10px 12px;font:inherit;font-size:16px}
.calc input:focus{outline:2px solid var(--cyan);outline-offset:1px;border-color:var(--cyan)}
.calc output{display:block;margin-top:10px;font-weight:800;color:var(--cyan);min-height:1.5em}
.books h4{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:16px 0 6px}
.books ul{margin:0;padding-left:18px}
.books li{font-size:15px;margin:0 0 4px}
.books li span{color:var(--muted)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@keyframes pop{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.gift{animation:none}}
</style>
</head>
<body>
<main>
<div class="brand">ALAIN ZULAIKA</div>
<h1>Zer iruditu zaizu hitzaldia?</h1>
<p class="lead">Galdetegi anonimoa · minutu 1</p>
<a class="jump" href="#flow">+ Flow-aren azalpena ↓</a>

<div class="teaser">
  <p class="hint">Bidali eta ireki zure oparitxoak 🎁</p>
  <ul>
    <li><strong>Gorila ikusezina:</strong> esperimentu famatua, etxean probatzeko.</li>
    <li><strong>Katu batek zure karta asmatuko du.</strong> Bai, katu batek.</li>
    <li><strong>Nor da hiltzailea?</strong> Zure arreta proban.</li>
  </ul>
  <p class="more">…eta gehiago: hitzaldiaren gakoak, liburuak eta kalkulagailu bat.</p>
</div>
<form id="f" novalidate>
  <fieldset>
    <legend>1. Probatu duzu jada?</legend>
    <div class="choices">
      <input type="radio" name="probatu" id="p1" value="bai"><label for="p1">Bai</label>
      <input type="radio" name="probatu" id="p2" value="oraindik-ez"><label for="p2">Oraindik ez, baina probatuko dut</label>
      <input type="radio" name="probatu" id="p3" value="ez"><label for="p3">Ez</label>
    </div>
  </fieldset>
  <div style="margin-bottom:22px">
    <label class="q" for="ikasi">2. Zer ikasi duzu zure buruari buruz?<span class="opt">aukerazkoa</span></label>
    <textarea id="ikasi" name="ikasi" maxlength="1000"></textarea>
  </div>
  <div style="margin-bottom:22px">
    <label class="q" for="gustatu">3. Zer gustatu zaizu gehien?<span class="opt">aukerazkoa</span></label>
    <textarea id="gustatu" name="gustatu" maxlength="1000"></textarea>
  </div>
  <div style="margin-bottom:22px">
    <label class="q" for="gehitu">4. Zerbait gehitu nahi duzu?<span class="opt">aukerazkoa</span></label>
    <textarea id="gehitu" name="gehitu" maxlength="1000"></textarea>
  </div>
  <div aria-hidden="true" style="position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden"><label>Web <input type="text" name="web" tabindex="-1" autocomplete="off"></label></div>
  <button type="submit" id="send">Bidali</button>
  <p class="err" id="err" role="alert"></p>
  <p class="note">Anonimoa da: ez dugu izenik, posta elektronikorik ez beste daturik jasotzen. Erantzunak, izenik gabe, hitzaldia hobetzeko eta ikastetxeari erakusteko erabil daitezke.</p>
</form>

<div class="thanks" id="thanks" tabindex="-1">
  <div role="status">
    <h2>Eskerrik asko!</h2>
    <p>Zure erantzuna jaso dugu.</p>
  </div>
  <section class="gifts" aria-labelledby="oparitxoak">
    <h3 id="oparitxoak">Oparitxoak 🎁</h3>
    <p class="intro">Hitzaldia ez da hemen amaitzen. Hona hemen etxean probatzeko eta ikasten jarraitzeko zerbait.</p>

    <details open>
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
          <strong>Nor da hiltzailea? (aldaketaren itsutasuna)</strong>
          <span class="t">Begiratu bideoa arretaz: gauzak aldatzen dira eta askok ez dute nabaritzen. Zenbat aldaketa topatzen dituzu? Ingelesez dago, baina gakoa ez dago hitzetan.</span>
          <span class="go">Ikusi bideoa ↗<span class="sr"> (fitxa berrian)</span></span>
        </a>
        <div class="calc">
          <strong>Zenbat egun urtean?</strong>
          <label for="orduak">Zenbat ordu ematen dituzu egunean mugikorrari begira? Mugikorraren ezarpenetan ikus dezakezu.</label>
          <input type="number" id="orduak" inputmode="decimal" min="0" max="24" step="0.5" placeholder="Orduak">
          <output id="egunak" for="orduak" aria-live="polite"></output>
        </div>
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
      <summary>🛠️ Arreta berreskuratzeko 4 arau</summary>
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

<footer>© Alain Zulaika</footer>
</main>

<script>
// Dónde se guardan las respuestas. Rellenar antes de publicar (ver nota «Landing y encuesta anónima de alumnos»).
// Debe aceptar un POST JSON y NO guardar IP, ni cookies, ni identificadores.
var ENDPOINT = "/api/arreta";
// Charla: ?c=<slug> en el QR. Sin parámetro (tarjetas de Hernani ya impresas), la de Hernani.
var SAIOA = (function(){try{var c=(new URLSearchParams(location.search).get("c")||"").toLowerCase();return /^[a-z0-9-]{1,60}$/.test(c)?c:"hernani-2026-11"}catch(e){return "hernani-2026-11"}})();

// Calculadora de Oparitxoak: solo en el navegador, no envía nada.
(function(){var hi=document.getElementById("orduak"),ho=document.getElementById("egunak");if(!hi)return;
hi.addEventListener("input",function(){var h=parseFloat(String(hi.value).replace(",","."));
if(!(h>0&&h<=24)){ho.textContent="";return}
var d=Math.round(h*365/24),u=(h*10/24).toFixed(1).replace(".",",");
ho.textContent="= urtean "+d+" egun oso. Hamar urtean, "+u+" urte."})})();

var f=document.getElementById("f"),err=document.getElementById("err"),btn=document.getElementById("send"),th=document.getElementById("thanks");
f.addEventListener("submit",function(e){
  e.preventDefault();
  err.style.display="none";
  var d=new FormData(f), probatu=d.get("probatu");
  if(!probatu){err.textContent="Aukeratu erantzun bat 1. galderan.";err.style.display="block";return}
  var body={probatu:probatu,ikasi:d.get("ikasi")||"",gustatu:d.get("gustatu")||"",gehitu:d.get("gehitu")||"",saioa:SAIOA,web:d.get("web")||""};
  btn.disabled=true;
  if(!ENDPOINT){btn.disabled=false;err.textContent="Oraindik ez dago konektatuta (ENDPOINT hutsik).";err.style.display="block";return}
  fetch(ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),credentials:"omit",referrerPolicy:"no-referrer"})
  .then(function(r){if(!r.ok)throw 0;f.style.display="none";th.style.display="block";th.focus()})
  .catch(function(){btn.disabled=false;err.textContent="Ezin izan da bidali. Saiatu berriro.";err.style.display="block"});
});
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
