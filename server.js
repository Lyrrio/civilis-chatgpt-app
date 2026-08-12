import { createServer } from "node:http";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const widgetHtml = String.raw`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Civilis</title>
<style>
  :root{
    color-scheme:light dark;
    --bg:Canvas;--text:CanvasText;--muted:#7a8495;--line:color-mix(in srgb, CanvasText 16%, transparent);
    --panel:color-mix(in srgb, Canvas 92%, CanvasText 8%);--accent:#3b82f6;--friendly:#168a52;--hostile:#b42318;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,system-ui,-apple-system,sans-serif}
  button{font:inherit;color:inherit}
  .app{padding:12px;max-width:1000px;margin:auto}
  .hero{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}
  h1,h2,p{margin:0}.hero h1{font-size:20px}.muted{color:var(--muted);font-size:12px}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:10px}
  .stat{border:1px solid var(--line);border-radius:14px;padding:9px;text-align:center;background:var(--panel)}
  .stat b{display:block;font-size:18px}.stat small{font-size:10px;color:var(--muted)}
  .mapCard,.panel{border:1px solid var(--line);border-radius:16px;background:var(--panel);overflow:hidden;margin-bottom:10px}
  .mapHead,.panelHead{display:flex;align-items:center;justify-content:space-between;padding:10px 12px}
  #map{width:100%;height:auto;display:block;background:color-mix(in srgb, var(--accent) 8%, var(--bg));touch-action:manipulation}
  .country{fill:color-mix(in srgb, CanvasText 17%, Canvas);stroke:color-mix(in srgb, CanvasText 45%, transparent);stroke-width:.45;vector-effect:non-scaling-stroke;cursor:pointer}
  .country:hover,.country.selected{fill:color-mix(in srgb, var(--accent) 35%, Canvas)}
  .country.player{fill:var(--accent)}
  .country.friendly{fill:var(--friendly)}
  .country.hostile{fill:var(--hostile)}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;padding:0 10px 10px}
  .btn{border:1px solid var(--line);border-radius:12px;padding:10px;background:transparent;text-align:left;cursor:pointer}
  .btn.primary{background:var(--accent);color:#fff;border-color:var(--accent);font-weight:700;text-align:center}
  .btn.danger{color:#ffb4ad}
  .badge{font-size:11px;border:1px solid var(--line);border-radius:999px;padding:4px 8px}
  .log{list-style:none;padding:0 12px 12px;margin:0}.log li{font-size:13px;padding:6px 0;border-top:1px solid var(--line)}
  .footer{display:flex;gap:7px}.footer .btn{flex:1}
  @media(min-width:700px){.grid{grid-template-columns:repeat(4,1fr)}}
</style>
</head>
<body>
<div class="app">
  <div class="hero">
    <div><div class="muted">CIVILIS • CHATGPT APP</div><h1 id="title">France — 2026 🇫🇷</h1></div>
    <span id="turn" class="badge">Tour 1</span>
  </div>

  <div class="stats">
    <div class="stat"><span>💰</span><b id="economy">100</b><small>Économie</small></div>
    <div class="stat"><span>🛡️</span><b id="army">72</b><small>Armée</small></div>
    <div class="stat"><span>🔬</span><b id="science">68</b><small>Science</small></div>
    <div class="stat"><span>🙂</span><b id="stability">80</b><small>Stabilité</small></div>
  </div>

  <section class="mapCard">
    <div class="mapHead"><div><b>🌍 Monde</b><div id="mapHint" class="muted">Touchez un pays.</div></div><span class="badge">France</span></div>
    <svg id="map" viewBox="0 0 960 500" role="img" aria-label="Carte politique simplifiée du monde"></svg>
  </section>

  <section class="panel">
    <div class="panelHead">
      <div><div class="muted">Pays sélectionné</div><h2 id="selected">France 🇫🇷</h2></div>
      <span id="relation" class="badge">Vous</span>
    </div>
    <div class="grid">
      <button class="btn action" data-action="diplomacy">🤝 Diplomatie</button>
      <button class="btn action" data-action="trade">📦 Commerce</button>
      <button class="btn action" data-action="spy">🕵️ Espionnage</button>
      <button class="btn action danger" data-action="attack">⚔️ Attaquer</button>
    </div>
  </section>

  <section class="panel">
    <div class="panelHead"><div><div class="muted">Décision nationale</div><h2>Priorité du tour</h2></div></div>
    <div class="grid">
      <button class="btn priority" data-priority="economy">🏗️ Économie</button>
      <button class="btn priority" data-priority="army">🛡️ Armée</button>
      <button class="btn priority" data-priority="science">🔬 Science</button>
      <button class="btn priority" data-priority="stability">🏛️ Stabilité</button>
    </div>
  </section>

  <section class="panel">
    <div class="panelHead"><div><div class="muted">Chronique</div><h2>Derniers événements</h2></div></div>
    <ul id="log" class="log"></ul>
  </section>

  <div class="footer">
    <button id="refresh" class="btn">↻ Actualiser</button>
    <button id="endTurn" class="btn primary">Terminer le tour →</button>
  </div>
</div>

<script>
const NS="http://www.w3.org/2000/svg";
let state=null;

// A compact schematic world only used as a visual fallback inside the prototype.
// Production version should replace these shapes with bundled published world-atlas geometry.
const shapes=[
["840","États-Unis","M108 170L225 155L258 217L212 260L125 246L89 208Z"],
["124","Canada","M94 91L244 85L263 145L218 160L108 165L72 129Z"],
["076","Brésil","M255 286L324 300L344 390L291 448L250 384L229 329Z"],
["250","France","M456 190L483 188L493 211L474 228L452 217Z"],
["276","Allemagne","M482 167L509 167L512 194L490 202L480 187Z"],
["724","Espagne","M423 213L463 211L469 238L433 248L414 233Z"],
["380","Italie","M496 209L510 212L524 250L513 266L501 239L488 231Z"],
["826","Royaume-Uni","M438 156L453 147L460 179L446 190L435 177Z"],
["504","Maroc","M418 264L461 257L466 286L428 300L407 286Z"],
["012","Algérie","M461 267L524 267L536 327L492 354L453 319Z"],
["643","Russie","M526 88L817 85L887 157L802 216L627 197L548 157Z"],
["156","Chine","M687 211L792 201L826 268L756 311L676 270Z"],
["356","Inde","M663 282L718 280L738 337L697 390L659 337Z"],
["036","Australie","M767 379L858 364L900 416L853 462L777 449L745 409Z"],
["710","Afrique du Sud","M523 405L587 409L601 445L555 468L512 448Z"]
];

function getGame(out){
  return out?.structuredContent?.game || out?.game || null;
}
function getSelected(out){
  return out?.structuredContent?.selectedCountry || out?.selectedCountry || null;
}
function toolOutput(){
  return window.openai?.toolOutput || null;
}
async function callTool(name,args={}){
  if(window.openai?.callTool){
    const result=await window.openai.callTool(name,args);
    apply(result);
    return result;
  }
  document.querySelector("#mapHint").textContent="Connectez cette UI à ChatGPT pour activer les outils.";
}
function apply(out){
  const g=getGame(out);
  if(!g) return;
  state=g;
  render();
}
function country(id){
  return state?.countries?.find(c=>c.id===id);
}
function renderMap(){
  const svg=document.querySelector("#map");
  svg.innerHTML="";
  for(const [id,name,d] of shapes){
    const p=document.createElementNS(NS,"path");
    const c=country(id);
    p.setAttribute("d",d);
    let cls="country";
    if(id==="250") cls+=" player";
    if(c?.relation==="friendly" || c?.relation==="ally") cls+=" friendly";
    if(c?.relation==="hostile") cls+=" hostile";
    if(state?.selectedCountryId===id) cls+=" selected";
    p.setAttribute("class",cls);
    p.setAttribute("aria-label",name);
    p.addEventListener("click",()=>callTool("inspect_country",{countryId:id}));
    svg.appendChild(p);
  }
}
function render(){
  const f=country("250");
  if(!state || !f) return;
  document.querySelector("#title").textContent=\`France — \${state.year} 🇫🇷\`;
  document.querySelector("#turn").textContent=\`Tour \${state.turn}\`;
  for(const k of ["economy","army","science","stability"]) document.querySelector("#"+k).textContent=f[k];

  const s=country(state.selectedCountryId)||f;
  document.querySelector("#selected").textContent=\`\${s.name} \${s.emoji||""}\`;
  const rel=s.id==="250"?"Vous":s.relation==="ally"?"Allié":s.relation==="friendly"?"Amical":s.relation==="hostile"?"Hostile":"Neutre";
  document.querySelector("#relation").textContent=rel;
  document.querySelector("#mapHint").textContent=s.id==="250"?"Votre territoire.":\`\${s.name} sélectionné.\`;

  const log=document.querySelector("#log");
  log.innerHTML="";
  for(const line of state.log||[]){
    const li=document.createElement("li");li.textContent=line;log.appendChild(li);
  }
  renderMap();
  window.openai?.setWidgetState?.({
    modelContent:\`Civilis: tour \${state.turn}, année \${state.year}, pays sélectionné \${s.name}.\`,
    privateContent:{selectedCountryId:state.selectedCountryId}
  });
}

document.querySelectorAll(".priority").forEach(b=>b.addEventListener("click",()=>callTool("set_national_priority",{priority:b.dataset.priority})));
document.querySelectorAll(".action").forEach(b=>b.addEventListener("click",()=>{
  if(!state) return;
  callTool("take_action",{action:b.dataset.action,countryId:state.selectedCountryId});
}));
document.querySelector("#endTurn").addEventListener("click",()=>callTool("end_turn",{}));
document.querySelector("#refresh").addEventListener("click",()=>callTool("get_game_state",{}));

const initial=toolOutput();
if(initial) apply(initial);
else callTool("start_game",{});
</script>
</body>
</html>`;
const UI_URI = "ui://civilis/world/v1.html";

const baseCountries = [
  { id: "250", name: "France", emoji: "🇫🇷", relation: "player", economy: 100, army: 72, science: 68, stability: 80 },
  { id: "276", name: "Allemagne", emoji: "🇩🇪", relation: "ally", economy: 110, army: 68, science: 82, stability: 84 },
  { id: "724", name: "Espagne", emoji: "🇪🇸", relation: "ally", economy: 82, army: 54, science: 61, stability: 78 },
  { id: "380", name: "Italie", emoji: "🇮🇹", relation: "ally", economy: 88, army: 58, science: 64, stability: 73 },
  { id: "826", name: "Royaume-Uni", emoji: "🇬🇧", relation: "neutral", economy: 105, army: 76, science: 81, stability: 76 },
  { id: "840", name: "États-Unis", emoji: "🇺🇸", relation: "neutral", economy: 150, army: 150, science: 130, stability: 72 },
  { id: "156", name: "Chine", emoji: "🇨🇳", relation: "neutral", economy: 142, army: 146, science: 122, stability: 88 },
  { id: "643", name: "Russie", emoji: "🇷🇺", relation: "neutral", economy: 93, army: 130, science: 86, stability: 70 },
  { id: "504", name: "Maroc", emoji: "🇲🇦", relation: "friendly", economy: 64, army: 56, science: 42, stability: 75 },
  { id: "012", name: "Algérie", emoji: "🇩🇿", relation: "neutral", economy: 71, army: 71, science: 46, stability: 69 },
];

let game = null;
let gameCounter = 1;

function cloneCountry(c) {
  return { ...c };
}
function newGame() {
  return {
    id: `civilis-${gameCounter++}`,
    turn: 1,
    year: 2026,
    phase: "Décision",
    playerCountryId: "250",
    selectedCountryId: "250",
    countries: baseCountries.map(cloneCountry),
    log: [
      "La France entre dans une nouvelle phase stratégique.",
      "Le gouvernement attend votre première décision."
    ],
    pendingChoice: null,
    victoryProgress: 0
  };
}
function ensureGame() {
  if (!game) game = newGame();
  return game;
}
function countryById(id) {
  return ensureGame().countries.find(c => c.id === id);
}
function snapshot(message = "") {
  const g = ensureGame();
  const selected = countryById(g.selectedCountryId);
  return {
    content: message ? [{ type: "text", text: message }] : [],
    structuredContent: {
      game: g,
      selectedCountry: selected,
      ui: {
        title: "Civilis — France 2026",
        subtitle: "Stratégie mondiale dans ChatGPT",
        playable: true
      }
    }
  };
}

function createCivilisServer() {
  const server = new McpServer({
    name: "civilis-chatgpt-app",
    version: "0.1.0"
  });

  registerAppResource(
    server,
    "civilis-world",
    UI_URI,
    {},
    async () => ({
      contents: [{
        uri: UI_URI,
        mimeType: RESOURCE_MIME_TYPE,
        text: widgetHtml,
        _meta: {
          ui: {
            prefersBorder: false
          }
        }
      }]
    })
  );

  registerAppTool(
    server,
    "start_game",
    {
      title: "Lancer Civilis",
      description: "Lance ou réinitialise une partie de Civilis avec la France en 2026 et affiche la carte stratégique.",
      inputSchema: {
        reset: z.boolean().optional()
      },
      _meta: { ui: { resourceUri: UI_URI } }
    },
    async ({ reset } = {}) => {
      if (!game || reset) game = newGame();
      return snapshot("Civilis est lancé. Vous contrôlez la France en 2026.");
    }
  );

  registerAppTool(
    server,
    "get_game_state",
    {
      title: "Afficher Civilis",
      description: "Affiche l'état actuel de la partie Civilis et sa carte.",
      inputSchema: {},
      _meta: { ui: { resourceUri: UI_URI } }
    },
    async () => snapshot("État actuel de la partie.")
  );

  registerAppTool(
    server,
    "inspect_country",
    {
      title: "Inspecter un pays",
      description: "Sélectionne un pays dans Civilis pour voir sa relation et ses statistiques.",
      inputSchema: {
        countryId: z.string().min(1)
      },
      _meta: { ui: { resourceUri: UI_URI } }
    },
    async ({ countryId }) => {
      const c = countryById(countryId);
      if (!c) return snapshot(`Pays ${countryId} non disponible dans ce prototype.`);
      game.selectedCountryId = countryId;
      return snapshot(`${c.name} sélectionné.`);
    }
  );

  registerAppTool(
    server,
    "set_national_priority",
    {
      title: "Choisir une priorité",
      description: "Choisit la priorité nationale française pour le prochain tour : économie, armée, science ou stabilité.",
      inputSchema: {
        priority: z.enum(["economy", "army", "science", "stability"])
      },
      _meta: { ui: { resourceUri: UI_URI } }
    },
    async ({ priority }) => {
      const labels = {
        economy: "économie",
        army: "armée",
        science: "science",
        stability: "stabilité"
      };
      game.pendingChoice = priority;
      return snapshot(`Priorité nationale choisie : ${labels[priority]}.`);
    }
  );

  registerAppTool(
    server,
    "take_action",
    {
      title: "Action internationale",
      description: "Effectue une action française envers un pays : diplomatie, commerce, espionnage ou guerre. Le jeu est fictif.",
      inputSchema: {
        action: z.enum(["diplomacy", "trade", "spy", "attack"]),
        countryId: z.string().min(1)
      },
      _meta: { ui: { resourceUri: UI_URI } }
    },
    async ({ action, countryId }) => {
      const target = countryById(countryId);
      const france = countryById("250");
      if (!target || target.id === "250") return snapshot("Sélectionnez un autre pays.");

      if (action === "diplomacy") {
        target.relation = "friendly";
        game.log.unshift(`🤝 Paris ouvre un rapprochement diplomatique avec ${target.name}.`);
      } else if (action === "trade") {
        france.economy += 3;
        target.relation = target.relation === "hostile" ? "neutral" : target.relation;
        game.log.unshift(`📦 Un accord commercial est proposé à ${target.name}.`);
      } else if (action === "spy") {
        france.science += 1;
        game.log.unshift(`🕵️ Les services français collectent du renseignement sur ${target.name}.`);
      } else if (action === "attack") {
        target.relation = "hostile";
        france.army = Math.max(0, france.army - 4);
        game.log.unshift(`⚔️ Une crise militaire fictive éclate entre la France et ${target.name}.`);
      }
      game.selectedCountryId = target.id;
      return snapshot(`Action ${action} appliquée à ${target.name}.`);
    }
  );

  registerAppTool(
    server,
    "end_turn",
    {
      title: "Terminer le tour",
      description: "Termine le tour de Civilis, applique la priorité nationale et fait évoluer le monde fictif.",
      inputSchema: {},
      _meta: { ui: { resourceUri: UI_URI } }
    },
    async () => {
      const france = countryById("250");
      if (game.pendingChoice === "economy") france.economy += 8;
      if (game.pendingChoice === "army") france.army += 7;
      if (game.pendingChoice === "science") france.science += 7;
      if (game.pendingChoice === "stability") france.stability = Math.min(100, france.stability + 6);

      game.turn += 1;
      game.year += 1;
      game.pendingChoice = null;
      game.victoryProgress = Math.min(100, game.victoryProgress + 2);

      const events = [
        "🌐 De nouvelles négociations européennes s'ouvrent.",
        "📈 Les marchés mondiaux réévaluent leurs positions.",
        "🛰️ Une avancée technologique modifie l'équilibre stratégique.",
        "🤝 Plusieurs capitales cherchent de nouveaux partenaires.",
        "⚠️ Une tension régionale fictive attire l'attention de Paris."
      ];
      game.log.unshift(events[game.turn % events.length]);
      game.log = game.log.slice(0, 8);
      return snapshot(`Tour ${game.turn} commencé. Année ${game.year}.`);
    }
  );

  return server;
}

const port = Number(process.env.PORT ?? 8787);
const MCP_PATH = "/mcp";

const httpServer = createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400).end("Missing URL");
    return;
  }
  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "OPTIONS" && url.pathname === MCP_PATH) {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, mcp-session-id",
      "Access-Control-Expose-Headers": "Mcp-Session-Id",
    });
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" })
      .end("Civilis ChatGPT App MCP server");
    return;
  }

  const MCP_METHODS = new Set(["POST", "GET", "DELETE"]);
  if (url.pathname === MCP_PATH && req.method && MCP_METHODS.has(req.method)) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

    const server = createCivilisServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on("close", () => {
      transport.close();
      server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("Civilis MCP error:", error);
      if (!res.headersSent) res.writeHead(500).end("Internal server error");
    }
    return;
  }

  res.writeHead(404).end("Not Found");
});

httpServer.listen(port, () => {
  console.log(`Civilis MCP server listening on http://localhost:${port}${MCP_PATH}`);
});
