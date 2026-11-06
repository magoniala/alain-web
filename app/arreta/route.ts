// /arreta: encuesta anónima de alumnos (QR de las tarjetas). Se sirve como HTML
// estático desde un route handler, NO como página de React, a propósito: así
// queda fuera del layout raíz y no carga el píxel de Whop, Vercel Analytics ni
// Speed Insights. Sin cookies, sin analítica, sin scripts de terceros.
// El diseño y los textos son los de arreta-index.html tal cual; solo se ha
// rellenado ENDPOINT, añadido el campo señuelo «web» y la charla por ?c=slug
// (se envía como `saioa`; sin parámetro sigue siendo «hernani-2026-11»).

export const dynamic = "force-static";

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
</style>
</head>
<body>
<main>
<div class="brand">ALAIN ZULAIKA</div>
<h1>Zer iruditu zaizu hitzaldia?</h1>
<p class="lead">Galdetegi anonimoa · minutu 1</p>
<a class="jump" href="#flow">+ Flow-aren azalpena ↓</a>

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

<div class="thanks" id="thanks" tabindex="-1" role="status">
  <h2>Eskerrik asko!</h2>
  <p>Zure erantzuna jaso dugu. Behean, flow-aren azalpena.</p>
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

<div class="video">Laster: bideoa, flow-a sakonago azalduta.</div>

<footer>© Alain Zulaika</footer>
</main>

<script>
// Dónde se guardan las respuestas. Rellenar antes de publicar (ver nota «Landing y encuesta anónima de alumnos»).
// Debe aceptar un POST JSON y NO guardar IP, ni cookies, ni identificadores.
var ENDPOINT = "/api/arreta";
// Charla: ?c=<slug> en el QR. Sin parámetro (tarjetas de Hernani ya impresas), la de Hernani.
var SAIOA = (function(){try{var c=(new URLSearchParams(location.search).get("c")||"").toLowerCase();return /^[a-z0-9-]{1,60}$/.test(c)?c:"hernani-2026-11"}catch(e){return "hernani-2026-11"}})();

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
