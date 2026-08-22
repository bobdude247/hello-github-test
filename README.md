# Cat Fight (Cute-Friendly Browser Game)

This repository contains a no-cost, local-first browser game. The editable source is in [`cat-fight/`](cat-fight), and [`docs/`](docs) is the GitHub Pages deployment copy.

`Cat Fight` is a playful, cute-friendly cat game inspired by arcade fighters. It supports one player versus the CPU and local two-player matches.

## Source and deployment copies

- Edit files in `cat-fight/` only.
- `docs/` is kept as a byte-identical copy for GitHub Pages hosting.
- After changing `cat-fight/`, copy every corresponding application file to `docs/` before testing or deploying.
- Do not delete either tree: the repository root redirects to `docs/`, while `cat-fight/` remains the editable source.

## Why this stack

- **No cost**: plain HTML/CSS/JavaScript (no paid tools, no required services)
- **Runs locally** on your machine for testing
- **Desktop + phone** support via keyboard and touch controls
- **PWA-ready** so it can be installed to phones later

## Quick start (local)

1. Open a terminal in this repository root.
2. Run a local web server:

```powershell
python -m http.server 8080
```

3. Open either route:

```text
http://localhost:8080/cat-fight/
http://localhost:8080/docs/
```

The Windows `python` command is used because `python3` may resolve to the Microsoft Store alias.

## Controls

- Player 1: `A`/`D` move, `W` jump, `F` paw bop, `G` yarn toss, `H` hind legs.
- Player 2: Arrow keys move/jump, `K` paw bop, `L` yarn toss, `J` hind legs.
- Signature move: Player 1 presses `V`; Player 2 presses `U`. Touch players use the Signature Move button.
- Hold away from an incoming attack to block.
- Use the visible Sound toggle to mute or restore synthesized effects. The preference is saved in the browser.

## Cats and signatures

Each cat has a different signature move shown on its selection card:

- Sunny Tabby: **Sunbeam Pounce**, a close-range dash.
- Misty Shorthair: **Misty Veil**, a short defensive guard.
- Midnight Shadow: **Shadow Feint**, a repositioning strike.
- Peaches Calico: **Calico Confetti**, a colorful area burst.
- Snowball Puff: **Snowball Roll**, a rolling yarn projectile.
- Cocoa Stripe: **Cocoa Clobber**, a heavy close-range thump.
- Lilac Whiskers: **Whisker Wave**, a long-range wave projectile.
- Muffin White Tabby: **Muffin Bounce**, a jumping area bump.
- Lilith Longhair: **Longhair Lasso**, a tugging control move.
- Minty Paws: **Minty Zoomies**, a quick dash attack.

Cooldown status appears beside each stamina meter and communicates readiness or approximate seconds remaining.

## Attract mode

The setup screen includes a CPU-vs-CPU attract demo setting. It is **After 60 seconds** by default, with Off, 30-second, and 2-minute options. The setting is saved in the browser under `catFightAttractMode`. The timer resets when setup receives keyboard, pointer, touch, or selection activity, and it never starts while the tab is hidden. Any deliberate input exits a demo and restores the previous setup selections.

## Service worker development

The service worker uses a versioned cache and a network-first strategy with offline fallbacks. To refresh it during development, reload the page after changing `sw.js` or its cache version. If an old worker remains active, open the browser's site settings or DevTools Application panel, unregister the service worker, clear site data, and reload once online. The local development host unregisters service workers automatically.

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
