# Cat Fight (Cute-Friendly Browser Game)

This repository now includes a new no-cost, local-first game project in [`cat-fight/`](cat-fight).

`Cat Fight` is a playful, cute-friendly **player-vs-player** cat game inspired by arcade fighters.

## Why this stack

- **No cost**: plain HTML/CSS/JavaScript (no paid tools, no required services)
- **Runs locally** on your machine for testing
- **Desktop + phone** support via keyboard and touch controls
- **PWA-ready** so it can be installed to phones later

## Quick start (local)

1. Open a terminal in this repository root.
2. Run a local web server:

```bash
python3 -m http.server 8080
```

3. Open:

```text
http://localhost:8080/cat-fight/
```

## GitHub setup (when ready)

```bash
git init
git add .
git commit -m "Create Cat Fight V1 web prototype"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

## Project folder

- Game entry: [`cat-fight/index.html`](cat-fight/index.html)
- Game logic: [`cat-fight/src/game.js`](cat-fight/src/game.js)
- Styles: [`cat-fight/styles.css`](cat-fight/styles.css)
- PWA files: [`cat-fight/manifest.webmanifest`](cat-fight/manifest.webmanifest), [`cat-fight/sw.js`](cat-fight/sw.js)
