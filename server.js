import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const widgetHtml = readFileSync("public/civilis-widget.html", "utf8");
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
