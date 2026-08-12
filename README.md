# Civilis — ChatGPT App

Prototype d'application intégrée à ChatGPT via MCP Apps / OpenAI Apps SDK.

## Fonctionnalités
- France jouable en 2026
- carte mondiale interactive dans ChatGPT
- pays sélectionnables
- économie, armée, science, stabilité
- diplomatie, commerce, espionnage et conflit fictif
- choix de priorité nationale
- tours successifs
- état partagé via outils MCP

## 1. Lancer le serveur

Node.js 18+ :

```bash
npm install
npm start
```

Le serveur écoute par défaut sur :

```text
http://localhost:8787/mcp
```

## 2. Tester

Avec MCP Inspector :

```bash
npx @modelcontextprotocol/inspector@latest
```

Puis choisir Streamable HTTP et utiliser :

```text
http://localhost:8787/mcp
```

## 3. Connecter à ChatGPT

Pour du développement, expose le serveur via un endpoint HTTPS public ou un tunnel compatible.

Dans ChatGPT :
1. Settings
2. Security and login
3. Activer Developer mode
4. Ouvrir la page Plugins
5. Ajouter une connexion
6. Entrer l'URL HTTPS se terminant par `/mcp`

Exemple :

```text
https://votre-domaine.example/mcp
```

## Important

Cette version est un prototype de jeu. Les événements, statistiques et conflits sont fictifs.

La carte intégrée dans ce prototype utilise des formes schématiques pour fonctionner sans dépendance front-end externe. Pour la version production, remplacez-les par une géométrie publiée (par exemple world-atlas/Natural Earth) bundlée dans le composant afin d'obtenir les frontières géographiques réelles.

L'état est actuellement conservé en mémoire du processus Node. Pour sauvegarder durablement les parties entre conversations/appareils, ajoutez une base de données et une authentification.
