---
name: verify
description: Use when checking a playground 3D change at runtime - launch the dev server, drive headless Chromium with WebGPU, screenshot and diff. Covers load timing, console errors, leches controls and A/B evidence.
---

# Verifying playground changes

## Launch

```bash
pnpm -F @artificer-forge/playground dev   # background; port varies — always read it from the printed Local: line
```

- Engine (`@artificer-forge/engine`) exports point at `src/` — the dev server picks up engine edits live, no package build needed for verification. `pnpm -F @artificer-forge/engine build` is still the fastest typecheck.
- Kill the dev server and free the port before ending the turn.

## Drive + capture (headless WebGPU works)

`playwright-core` is in root node_modules with cached Chromium. Headless Chromium renders the WebGPU canvas on macOS with:

```js
chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu', '--use-angle=metal', '--enable-features=Vulkan,WebGPU'] })
```

- Wait ~12s after `networkidle`: GLB models + animation packs load async.
- Capture `console`/`pageerror` — TSL/node-material compile errors surface there, not as blank screens.
- Leches controls are real DOM: `select` options can be set via `page.evaluate` + dispatch `input`/`change` events (e.g. day-cycle preset switch).
- To poke three objects at runtime, temporarily expose them (`window.__x = obj`) in the experience file, verify, then remove the line.

## Gotchas

- Grass geometry uses `Math.random()` per load — cross-load pixel diffs are noisy. For A/B evidence, toggle state within ONE page session and diff (`magick a.png b.png -compose difference -composite -auto-level diff.png`).
- Pre-existing noise: leches hydration mismatch warnings, `af:ranged-attack` icon 404, `/img/classes/fighter.png` 404.
- Crop with `sips -c H W --cropOffset Y X in.png --out out.png` for close-ups.
