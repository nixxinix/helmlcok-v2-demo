# HelmLock V2 — Interactive 3D Demo

A client-presentation simulation of the HelmLock V2 smart helmet storage and sanitation kiosk. Everything (payment, card, locks, sanitation) is simulated in the browser. No backend, payment gateway or hardware is used.

**Stack:** React, TypeScript, Vite, Three.js via React Three Fiber, Drei, GSAP, Zustand.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build into dist/
npm run preview  # serve the production build
```
Requires Node 18+. Use a desktop browser with WebGL.

## Guided flow

1. **Showcase**: drag to rotate. Click any locker door to see the *Unauthorized Access Prohibited.* warning.
2. **Click the touchscreen** → welcome → choose Locker 1–3 → Locker Only or Locker + Sanitation.
3. **Pay ₱30** by coins (4 animated coins) or simulated QR (phone scan).
4. **Collect the access card**, then **place the helmet** in the front-opening locker.
5. Optional **simulated sanitation cycle**, then the stored screen.
6. **Retrieve Helmet**: present the issued card (a mismatching card is rejected and can be retried), remove the helmet, and finish.
7. Restart, return to the welcome screen, or replay the intro.

States: `idle → welcome → locker → service → payment → card → placement → (sanitation) → stored → retrieval → completed`.

## Customising

| What | Where |
| --- | --- |
| Service prices and coin denominations (four coins summing to each price) | `src/config.ts` → `services` |
| Sanitation duration | `src/config.ts` → `sanitationSeconds` |
| Animation timing (camera, door, coin, card, helmet, QR, validation) | `src/config.ts` → `timing` |
| Service names and descriptions | `src/config.ts` → `services` |
| Cabinet dimensions, locker heights, camera views | `src/layout.ts` |
| Materials, colours, 3D parts | `src/Scene.tsx` (procedural geometry, no external assets) |
| Kiosk screens and copy | `src/UI.tsx`, styling in `src/styles.css` |
| Flow rules and sequencing | `src/store.ts` |

Use the header controls to adjust sound volume and animation speed. On the showcase screen, toggle equipment hotspots with **Hotspots (H)** or press **H**. The simulated sanitation cycle can be skipped from its progress panel.

To use your own GLB models, load them with Drei's `useGLTF` and replace `Tower`, `Kiosk`, or `Helmet` in `Scene.tsx`, keeping the door groups and slot positions from `layout.ts`.

## Project structure

```
src/
  App.tsx      layout (canvas + UI overlay)
  Scene.tsx    3D cabinet, doors, coins, card, helmet, sanitation FX, camera rig
  UI.tsx       touchscreen interface for every stage
  store.ts     state machine and simulated transaction logic
  layout.ts    geometry constants and camera views
  config.ts    editable settings
```
