// Generates the three design-direction previews as fully static HTML
// (no runtime JS) so they render identically in any viewer.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const P = "assets/products/";

const CATS = [
  { div: "E", name: "Lighting", n: 11, img: "p04-led-bulbs.png", desc: "Interior, industrial and outdoor LED" },
  { div: "E", name: "Fans & Ventilation", n: 4, img: "p10-ventilation-fans.png", desc: "100% copper motor, quiet operation" },
  { div: "E", name: "Water Pumps & Controls", n: 3, img: "p11-pumps.png", desc: "Die-cast aluminium, TOP protected" },
  { div: "E", name: "Insect Killers", n: 1, img: "p06-insect-killer.png", desc: "Chemical-free, 20–40W" },
  { div: "E", name: "Cables", n: 1, img: "p08-premium-network-cable.png", desc: "CAT.6 UTP network cable" },
  { div: "E", name: "Electrical Accessories", n: 2, img: "p11-pc-10-automatic-pump-controller.png", desc: "Controllers and switchgear" },
  { div: "S", name: "Head & Face Protection", n: 7, img: "p15-safety-helmets.png", desc: "Helmets, visors, welding masks" },
  { div: "S", name: "Eye Protection", n: 6, img: "p13-safety-goggles.png", desc: "Goggles, glasses, over-glasses" },
  { div: "S", name: "Hearing Protection", n: 6, img: "p14-ear-muff.png", desc: "Up to SNR 37dB / NRR 32dB" },
  { div: "S", name: "Hand Protection", n: 11, img: "p16-grip-guard-gp3.png", desc: "Cut, chemical and impact rated" },
  { div: "S", name: "Safety Footwear", n: 8, img: "p20-low-cut-safety-shoes-2.png", desc: "Steel and composite toe caps" },
  { div: "S", name: "Harnesses & Fall Arrest", n: 2, img: "p19-full-body-harness.png", desc: "Full body harness, web straps" },
  { div: "S", name: "Body Protection", n: 6, img: "p19-safety-vests.png", desc: "Hi-viz vests, coveralls, aprons" },
  { div: "S", name: "Workwear", n: 9, img: "p23-winter-jacket.png", desc: "FR shirts, pants, jackets, suits" },
  { div: "S", name: "Spill Control", n: 0, img: null, desc: "Range expanding — enquire for stock" },
];

const PRODUCTS = [
  { name: "LED Bulbs", cat: "Lighting", img: "p04-led-bulbs.png", specs: [["Material", "White PC diffuser + PBT coated aluminium"]] },
  { name: "Slim LED Panels", cat: "Lighting", img: "p04-slim-led-panels.png", specs: [["Material", "White aluminium frame + glass LGB"]] },
  { name: "All-Weather Solar Flood Light", cat: "Lighting", img: "p05-all-weather-solar-flood-light.png", specs: [["Material", "Die-cast aluminium, IP66"], ["Power", "50W · 100W · 150W · 200W · 300W"], ["Panel", "6V 10W – 40W"]] },
  { name: "Industrial Canopy Pendant Lamps", cat: "Lighting", img: "p05-industrial-canopy-pendant-lamps.png", specs: [["Type", "Highbay LED"], ["Power", "100W · 150W · 200W · 300W"]] },
  { name: "Ventilation Fans", cat: "Fans & Ventilation", img: "p10-ventilation-fans.png", specs: [["Motor", "100% copper, quiet operation"], ["Size", '6" · 8" · 10"'], ["Power", "24W · 28W · 38W"]] },
  { name: "Pumps", cat: "Water Pumps", img: "p11-pumps.png", specs: [["Body", "Aluminium die-cast, anti-rust"], ["Protection", "Thermal Overload Protector"]] },
  { name: "PC-10 Automatic Pump Controller", cat: "Accessories", img: "p11-pc-10-automatic-pump-controller.png", specs: [["Voltage", "220–240 V"], ["Frequency", "50/60 Hz"], ["Max intensity", "10 A · 1.1 kW"]] },
  { name: "Insect Killer", cat: "Insect Control", img: "p06-insect-killer.png", specs: [["Material", "ABS fire retardant, chemical-free"], ["Power", "20W · 30W · 40W"], ["Input", "220–240 V · 50–60 Hz"]] },
  { name: "Safety Helmets", cat: "Head & Face", img: "p15-safety-helmets.png", specs: [["Shell", "HDPE compound + nylon ratchet"], ["Colours", "6 colourways"], ["Adjustment", "6-point load distribution"]] },
  { name: "Grip Guard GP5", cat: "Hand Protection", img: "p16-grip-guard-gp5.png", specs: [["Liner", "HPPE, steel, polyester, spandex"], ["Coating", "Polyurethane"], ["Sizes", "7–12"]] },
  { name: "Low Cut Safety Shoes", cat: "Footwear", img: "p20-low-cut-safety-shoes-2.png", specs: [["Upper", "KPU knitted polyurethane"], ["Toe cap", "Composite"], ["Sizes", "EUR 36–47"]] },
  { name: "Full Body Harness", cat: "Fall Arrest", img: "p19-full-body-harness.png", specs: [["Material", "Dope-dyed polyester"], ["Buckles", "Alloy steel"], ["Lanyard", "2 m twin, shock absorber"]] },
  { name: "Ear Muff", cat: "Hearing", img: "p14-ear-muff.png", specs: [["Material", "ABS shell, POM headband"], ["Rating", "NRR 25dB"], ["Feature", "Foldable"]] },
  { name: "Safety Vests", cat: "Body Protection", img: "p19-safety-vests.png", specs: [["Fabric", "100% polyester, 120 GSM"], ["Colours", "Hi-viz green · orange"], ["Reflective", '2" strips']] },
  { name: "Winter Jacket", cat: "Workwear", img: "p23-winter-jacket.png", specs: [["Fabric", "100% polyester, PU coated"], ["Build", "Triple layered, detachable hood"], ["Reflective", "50 mm tape"]] },
  { name: "Safety Goggles", cat: "Eye Protection", img: "p13-safety-goggles.png", specs: [["Lens", "Polycarbonate"], ["Frame", "Flexible PVC"], ["Venting", "Indirect"]] },
];

const INDUSTRIES = ["Construction", "Oil & Gas", "Manufacturing", "Warehousing & Logistics", "Facilities Management", "Marine & Ports", "Utilities", "Hospitality"];

const NAV = ["Home", "Electricals", "Safety", "Categories", "Industries", "Contact"];
const e = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

const FONTS = `<link rel="stylesheet" href="assets/fonts.css">`;
const LOGO = "assets/brand/spartan-logo.svg";

/* ============================= DIRECTION A ============================= */
function directionA() {
  const cats = CATS.map(c => `
    <a class="cat" href="#">
      ${c.img ? `<div class="cat-img"><img src="${P}${c.img}" alt="${e(c.name)}"></div>` : `<div class="cat-empty">—</div>`}
      <div><h4>${e(c.name)}</h4><small>${e(c.desc)}</small></div>
      <div class="n${c.n ? "" : " soon"}">${c.n ? c.n + " PRODUCTS" : "EXPANDING"}</div>
    </a>`).join("");

  const prods = PRODUCTS.slice(0, 8).map(p => `
    <a class="card" href="#">
      <div class="card-img"><img src="${P}${p.img}" alt="${e(p.name)}"></div>
      <div class="card-body">
        <div class="k">${e(p.cat)}</div>
        <h4>${e(p.name)}</h4>
        ${p.specs.slice(0, 3).map(s => `<div class="spec"><b>${e(s[0])}</b><span>${e(s[1])}</span></div>`).join("")}
      </div>
      <div class="card-foot"><span>Spec sheet</span><span class="add">+ ENQUIRE</span></div>
    </a>`).join("");

  const inds = INDUSTRIES.map((n, i) => `<div><i>${String(i + 1).padStart(2, "0")}</i>${e(n)}</div>`).join("");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Spartan — Direction A · Precision</title>${FONTS}
<style>
:root{--red:#EB2927;--red-deep:#970000;--ink:#0E0E0F;--ink-2:#3A3A3D;--grey:#7F7F7F;--line:#E3E3E5;--paper:#fff;--paper-2:#F7F7F8;--max:1280px;--fd:'Archivo',system-ui,sans-serif;--fb:'Inter',system-ui,sans-serif}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--fb);color:var(--ink);background:var(--paper);line-height:1.55;-webkit-font-smoothing:antialiased}
.wrap{max-width:var(--max);margin:0 auto;padding:0 32px}
a{color:inherit;text-decoration:none}img{max-width:100%;display:block}
.eyebrow{font-family:var(--fd);font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--red);display:flex;align-items:center;gap:12px}
.eyebrow::after{content:"";height:1px;background:var(--line);flex:1}
h1,h2,h3{font-family:var(--fd);letter-spacing:-.02em;line-height:1.05;font-weight:700}
.util{background:var(--ink);color:#B9B9BD;font-size:12px}
.util .wrap{display:flex;justify-content:space-between;align-items:center;height:38px}
.util strong{color:#fff;font-weight:600}
header{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.94);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.nav{display:flex;align-items:center;gap:40px;height:78px}
.logo{height:38px;width:auto}
.nav ul{display:flex;gap:30px;list-style:none;margin-left:auto}
.nav ul a{font-size:14px;font-weight:500;color:var(--ink-2);padding:6px 0;border-bottom:2px solid transparent}
.nav ul a.on{color:var(--ink);border-color:var(--red)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;font-family:var(--fd);font-weight:600;font-size:14px;padding:12px 22px;border:1px solid var(--ink);background:none;cursor:pointer}
.btn-solid{background:var(--red);border-color:var(--red);color:#fff}
.hero{border-bottom:1px solid var(--line);padding:76px 0 0}
.hero-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:56px;align-items:end}
.hero h1{font-size:clamp(44px,5.4vw,74px);font-weight:800}
.hero h1 em{font-style:normal;color:var(--red)}
.hero p{font-size:18px;color:var(--ink-2);max-width:46ch;margin:24px 0 32px}
.hero-cta{display:flex;gap:12px;margin-bottom:56px}
.hero-vis{position:relative;background:var(--paper-2);border:1px solid var(--line);border-bottom:none;aspect-ratio:4/3;display:grid;place-items:center;overflow:hidden}
.hero-vis::before{content:"";position:absolute;inset:0;background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:40px 40px;opacity:.5}
.hero-vis img{width:76%;position:relative;filter:drop-shadow(0 24px 40px rgba(0,0,0,.16))}
.stats{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid var(--line)}
.stat{padding:26px 0}
.stat+.stat{border-left:1px solid var(--line);padding-left:24px}
.stat b{display:block;font-family:var(--fd);font-size:34px;font-weight:800;letter-spacing:-.03em}
.stat span{font-size:12.5px;color:var(--grey);letter-spacing:.04em}
section{padding:88px 0}
.sec-head{display:flex;justify-content:space-between;align-items:flex-end;gap:40px;margin-bottom:40px}
.sec-head h2{font-size:clamp(28px,3.2vw,42px)}
.sec-head p{color:var(--grey);max-width:52ch;font-size:15px}
.div-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}
.division{border:1px solid var(--line);padding:36px;display:block}
.division .num{font-family:var(--fd);font-size:12px;font-weight:700;color:var(--red);letter-spacing:.14em}
.division h3{font-size:28px;margin:14px 0 12px}
.division p{color:var(--ink-2);font-size:15px;max-width:44ch}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:24px}
.chip{font-size:12.5px;border:1px solid var(--line);padding:6px 11px;color:var(--ink-2);background:var(--paper-2)}
.go{margin-top:28px;font-family:var(--fd);font-weight:600;font-size:14px;color:var(--red);display:inline-block}
.cats{display:grid;grid-template-columns:repeat(5,1fr);gap:1px;background:var(--line);border:1px solid var(--line)}
.cat{background:#fff;padding:22px;display:flex;flex-direction:column;gap:14px;min-height:214px}
.cat-img{height:86px;display:grid;place-items:center}
.cat-img img{max-height:86px;width:auto;object-fit:contain}
.cat-empty{height:86px;display:grid;place-items:center;color:var(--line);font-size:34px;font-family:var(--fd)}
.cat h4{font-family:var(--fd);font-size:15px;font-weight:700;letter-spacing:-.01em}
.cat small{color:var(--grey);font-size:12.5px;display:block;margin-top:4px;line-height:1.45}
.cat .n{margin-top:auto;font-size:11px;font-family:var(--fd);font-weight:700;letter-spacing:.1em;color:var(--red)}
.cat .n.soon{color:var(--grey)}
.prod-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:24px}
.card{border:1px solid var(--line);display:flex;flex-direction:column;background:#fff}
.card-img{background:var(--paper-2);aspect-ratio:4/3;display:grid;place-items:center;padding:20px;border-bottom:1px solid var(--line)}
.card-img img{max-height:100%;width:auto;object-fit:contain}
.card-body{padding:18px}
.card-body .k{font-size:11px;font-family:var(--fd);font-weight:700;letter-spacing:.12em;color:var(--red);text-transform:uppercase}
.card-body h4{font-family:var(--fd);font-size:17px;font-weight:700;margin:8px 0 10px;letter-spacing:-.01em}
.spec{display:flex;gap:8px;font-size:12.5px;color:var(--grey);padding:5px 0;border-top:1px dashed var(--line)}
.spec b{color:var(--ink-2);font-weight:600;min-width:74px;flex-shrink:0}
.card-foot{margin-top:auto;padding:14px 18px;border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center}
.card-foot span{font-size:12.5px;color:var(--grey)}
.add{font-family:var(--fd);font-size:12.5px;font-weight:700;color:var(--red)}
.split{display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center;border:1px solid var(--line);padding:44px}
.spec-vis{background:var(--paper-2);aspect-ratio:1;display:grid;place-items:center;padding:40px;border:1px solid var(--line)}
.spec-vis img{max-height:100%}
table{width:100%;border-collapse:collapse;margin-top:22px;font-size:13.5px}
th{background:var(--ink);color:#fff;font-family:var(--fd);font-size:11px;letter-spacing:.1em;text-transform:uppercase;padding:11px 12px;text-align:left;font-weight:600}
td{padding:11px 12px;border-bottom:1px solid var(--line);color:var(--ink-2)}
td:first-child{font-weight:600;color:var(--ink);width:40%}
.en388 td{text-align:center;font-family:var(--fd);font-weight:700;font-size:15px;color:var(--ink)}
.en388 td:first-child{text-align:left;font-size:13px}
.ind-band{background:var(--ink);color:#fff}
.ind-band .eyebrow{color:#fff}.ind-band .eyebrow::after{background:#37373B}
.ind-band h2{color:#fff}
.ind{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#2A2A2E;border:1px solid #2A2A2E;margin-top:36px}
.ind div{background:var(--ink);padding:26px 20px;font-family:var(--fd);font-weight:600;font-size:16px;display:flex;align-items:center;gap:12px}
.ind i{color:var(--red);font-style:normal;font-size:12px;font-weight:700}
.cta{border:1px solid var(--line);padding:56px;display:grid;grid-template-columns:1.2fr .8fr;gap:48px;align-items:center;background:var(--paper-2)}
.cta h2{font-size:36px}
.cta p{color:var(--ink-2);margin-top:14px;max-width:48ch}
footer{border-top:1px solid var(--line);padding:56px 0 30px;font-size:13.5px;color:var(--grey)}
.f-grid{display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:40px;margin-bottom:44px}
.f-grid h5{font-family:var(--fd);font-size:11.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--ink);margin-bottom:16px}
.f-grid a{display:block;padding:5px 0;color:var(--grey)}
.f-bot{border-top:1px solid var(--line);padding-top:22px;display:flex;justify-content:space-between}
.badge{position:fixed;left:20px;bottom:20px;background:var(--ink);color:#fff;padding:11px 17px;font-family:var(--fd);font-size:12px;font-weight:700;letter-spacing:.1em;z-index:99}
@media(max-width:1100px){.cats{grid-template-columns:repeat(3,1fr)}.prod-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:820px){.hero-grid,.div-grid,.split,.cta{grid-template-columns:1fr}.cats,.ind{grid-template-columns:repeat(2,1fr)}.f-grid{grid-template-columns:1fr 1fr}.nav ul{display:none}.stats{grid-template-columns:repeat(2,1fr)}}
</style></head><body>
<div class="badge">DIRECTION A · PRECISION</div>
<div class="util"><div class="wrap"><span>Established 2015 · Manufactured in India &amp; China</span><span><strong>Trade enquiries</strong> · sales@spartan.example</span></div></div>
<header><div class="wrap nav"><img src="${LOGO}" class="logo" alt="Spartan">
<ul>${NAV.map((n, i) => `<li><a href="#"${i === 0 ? ' class="on"' : ""}>${e(n)}</a></li>`).join("")}</ul>
<a class="btn btn-solid" href="#">Request a quote</a></div></header>
<div class="hero"><div class="wrap"><div class="hero-grid"><div>
<div class="eyebrow" style="margin-bottom:26px">Home and Industrial Solutions</div>
<h1>Built to <em>protect.</em><br>Engineered to <em>perform.</em></h1>
<p>Two divisions, one standard. Spartan supplies lighting, ventilation and water management alongside certified personal protective equipment — to contractors, facilities and distributors.</p>
<div class="hero-cta"><a class="btn btn-solid" href="#">Browse the catalogue</a><a class="btn" href="#">Download brochure</a></div>
</div><div class="hero-vis"><img src="${P}p15-safety-helmets.png" alt="Spartan safety helmets"></div></div>
<div class="stats"><div class="stat"><b>2015</b><span>ESTABLISHED</span></div><div class="stat"><b>74</b><span>PRODUCT LINES</span></div><div class="stat"><b>15</b><span>CATEGORIES</span></div><div class="stat"><b>2</b><span>DIVISIONS</span></div></div>
</div></div>
<section><div class="wrap"><div class="sec-head"><div><div class="eyebrow" style="margin-bottom:18px">Divisions</div><h2>One brand. Two specialisms.</h2></div><p>Every Spartan product is manufactured to consistent quality standards across our facilities in India and China.</p></div>
<div class="div-grid">
<a class="division" href="#"><div class="num">01 / ELECTRICALS</div><h3>Spartan Electricals</h3><p>Lighting, ventilation, water management and electrical controls for residential, commercial and industrial spaces.</p><div class="chips"><span class="chip">Lighting</span><span class="chip">Fans</span><span class="chip">Water Pumps</span><span class="chip">Cables</span><span class="chip">Insect Killers</span><span class="chip">Accessories</span></div><span class="go">Explore electricals →</span></a>
<a class="division" href="#"><div class="num">02 / SAFETY</div><h3>Spartan Safety</h3><p>Certified personal protective equipment and workwear engineered for real working conditions on site.</p><div class="chips"><span class="chip">Helmets</span><span class="chip">Gloves</span><span class="chip">Footwear</span><span class="chip">Harnesses</span><span class="chip">Eye &amp; Hearing</span><span class="chip">Workwear</span></div><span class="go">Explore safety →</span></a>
</div></div></section>
<section style="padding-top:0"><div class="wrap"><div class="sec-head"><div><div class="eyebrow" style="margin-bottom:18px">Product categories</div><h2>The full range</h2></div><p>Fifteen categories spanning both divisions, drawn directly from the current Spartan brochure.</p></div>
<div class="cats">${cats}</div></div></section>
<section style="padding-top:0"><div class="wrap"><div class="sec-head"><div><div class="eyebrow" style="margin-bottom:18px">Selected products</div><h2>Specification first</h2></div><p>Each product leads with materials, ratings and sizes — the details specifiers actually need.</p></div>
<div class="prod-grid">${prods}</div></div></section>
<section style="padding-top:0"><div class="wrap"><div class="split">
<div class="spec-vis"><img src="${P}p16-grip-guard-gp5.png" alt="Grip Guard GP5"></div>
<div><div class="eyebrow" style="margin-bottom:18px">Hand protection</div><h2 style="font-size:36px">Grip Guard GP5</h2>
<p style="color:var(--ink-2);margin-top:14px">HPPE, steel, polyester and spandex liner with PU coating. Knit wrist cuff, sizes 7–12.</p>
<table><tr><th colspan="2">Construction</th></tr><tr><td>Liner</td><td>HPPE, steel, polyester, spandex</td></tr><tr><td>Coating</td><td>Polyurethane</td></tr><tr><td>Colour</td><td>Grey / Grey</td></tr><tr><td>Cuff style</td><td>Knit wrist</td></tr></table>
<table class="en388"><tr><th>Abrasion</th><th>Blade cut</th><th>Tear</th><th>Puncture</th><th>TDM cut</th></tr><tr><td>4</td><td>X</td><td>4</td><td>3</td><td>D</td></tr></table>
<div style="display:flex;gap:12px;margin-top:26px"><a class="btn btn-solid" href="#">Add to enquiry</a><a class="btn" href="#">Full specification</a></div>
</div></div></div></section>
<section class="ind-band"><div class="wrap"><div class="eyebrow" style="margin-bottom:18px">Industries we serve</div><h2 style="font-size:clamp(28px,3.2vw,42px);max-width:20ch">Specified on sites where failure is not an option.</h2><div class="ind">${inds}</div></div></section>
<section><div class="wrap"><div class="cta"><div><div class="eyebrow" style="margin-bottom:18px">Trade enquiries</div><h2>Build your enquiry list, send it once.</h2><p>Add products as you browse and submit a single request. Our team responds with pricing, availability and lead times within one business day.</p></div>
<div style="display:flex;flex-direction:column;gap:12px"><a class="btn btn-solid" href="#">Request a quote</a><a class="btn" href="#">Download full brochure</a><a class="btn" style="border-color:var(--line)" href="#">Become a distributor</a></div></div></div></section>
<footer><div class="wrap"><div class="f-grid">
<div><img src="${LOGO}" style="height:34px;margin-bottom:18px" alt="Spartan"><p style="max-width:34ch">Spartan Lighting &amp; Electrical Products. Brightening spaces and powering progress since 2015.</p></div>
<div><h5>Electricals</h5><a href="#">Lighting</a><a href="#">Fans &amp; Ventilation</a><a href="#">Water Pumps</a><a href="#">Cables</a><a href="#">Insect Killers</a></div>
<div><h5>Safety</h5><a href="#">Head &amp; Face</a><a href="#">Hand Protection</a><a href="#">Footwear</a><a href="#">Harnesses</a><a href="#">Workwear</a></div>
<div><h5>Company</h5><a href="#">About Spartan</a><a href="#">Why Spartan</a><a href="#">Industries</a><a href="#">Contact</a></div>
</div><div class="f-bot"><span>© 2026 Spartan. All rights reserved.</span><span>Manufactured in India &amp; China</span></div></div></footer>
</body></html>`;
}

fs.writeFileSync(path.join(DIR, "direction-a-precision.html"), directionA());
console.log("wrote direction-a-precision.html");

