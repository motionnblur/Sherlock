# AGENTS.md — Frontend

> Prerequisite: read `../AGENTS.md` first.

---

## Stack

| Component     | Library / Version                      |
|---------------|----------------------------------------|
| Language      | JavaScript (JSX)                       |
| Framework     | React 18 + Vite 5                      |
| Styling       | Tailwind CSS 3 — **only styling method** |
| 3D Globe      | CesiumJS 1.116 via `vite-plugin-cesium` |
| WebSocket     | `@stomp/stompjs` + `sockjs-client`     |
| Font          | JetBrains Mono (Google Fonts)          |

---

## Source Layout

```
src/
├── App.tsx                      # Root layout shell, drone selection state, passes telemetry down
├── main.tsx                     # ReactDOM.createRoot entry point
├── index.css                    # Tailwind directives + Cesium widget overrides
├── configs/
│   └── map-settings.json        # Map-only dimming config for Cesium imagery
│
├── hooks/
│   └── useTelemetry.ts          # STOMP client, auto-reconnect, history state; gated by `enabled`
│
└── components/
    ├── Header.tsx               # Top bar: branding, UTC clock, link/offline status, deselect button
    ├── TelemetryPanel.tsx       # Left sidebar: lat/lon/alt/speed/battery (hidden when no drone selected)
    ├── MapComponent.tsx         # CesiumJS 3D globe — static preview + selection overlay + live tracking
    ├── SystemPanel.tsx          # Right sidebar: compass, mission clock, log (hidden when no drone selected)
    └── StatusBar.tsx            # Bottom bar: alerts, mission status, asset name
```

---

## Layout Structure

```
<App>                          full height, flex-col, bg-surface
├── <Header>                   h-11, bg-panel, border-b border-line
├── <div class="flex flex-1">  main content row
│   ├── <TelemetryPanel>       w-64, bg-panel, border-r border-line  ← only when drone selected
│   ├── <main class="flex-1">  CesiumJS canvas fills this
│   │   └── <MapComponent>
│   └── <SystemPanel>          w-52, bg-panel, border-l border-line  ← only when drone selected
└── <StatusBar>                h-7, bg-elevated, border-t border-line
```

**Do not change this structural layout** unless asked. Widths (`w-64`, `w-52`) are intentional for data density.

`TelemetryPanel` and `SystemPanel` are conditionally mounted — they only appear when `selectedDrone` is non-null. Do not render them unconditionally.

---

## Design System

All tokens are defined in `tailwind.config.js`. **Always use these class names — never raw hex values in JSX.**

| Token class      | Hex       | When to use                                  |
|------------------|-----------|----------------------------------------------|
| `text-neon`      | `#00FF41` | Live data values, indicators, active states  |
| `text-caution`   | `#FFB400` | Warnings (battery < 20%, degraded link)      |
| `text-danger`    | `#FF3B30` | Critical alerts (battery < 10%, signal loss) |
| `text-muted`     | `#3d4f63` | Labels, secondary info                       |
| `bg-surface`     | `#050505` | Page background                              |
| `bg-panel`       | `#0d1117` | Sidebar and header backgrounds               |
| `bg-elevated`    | `#161b22` | Panel headers, status bar                    |
| `border-line`    | `#1e2a3a` | All dividers and borders                     |

**No rounded corners.** Remove `rounded-*` from anything you add.  
**No sans-serif fonts.** All text uses `font-mono` (JetBrains Mono).

---

## Adding a New UI Component

1. Create `src/components/YourComponent.tsx`
2. Accept data via props (all data flows from `useTelemetry` → `App.tsx` → props)
3. Use only Tailwind utility classes for styling
4. Mount it in `App.tsx` and pass the relevant props

Pattern to follow for a data row:
```jsx
// label left, value right, consistent spacing
<div className="flex items-baseline justify-between py-1.5 border-b border-line">
  <span className="text-[10px] text-muted tracking-widest uppercase">{label}</span>
  <span className="text-sm font-bold tabular-nums text-neon">{value}</span>
</div>
```

Pattern for a section header inside a panel:
```jsx
<div className="flex items-center gap-2 py-1.5">
  <span className="text-[9px] text-neon tracking-widest font-bold">{title}</span>
  <div className="flex-1 h-px bg-line" />
</div>
```

---

## useTelemetry Hook

`src/hooks/useTelemetry.ts` — the single source of truth for live data.

```js
const { telemetry, connected, history } = useTelemetry(enabled);
```

| Parameter    | Type      | Description                                               |
|--------------|-----------|-----------------------------------------------------------|
| `enabled`    | `boolean` | When `false`, STOMP client is deactivated and state is cleared. Defaults to `true`. |

| Return value | Type              | Description                              |
|--------------|-------------------|------------------------------------------|
| `telemetry`  | `Object \| null`  | Latest telemetry packet (null until first message) |
| `connected`  | `boolean`         | STOMP link status                        |
| `history`    | `Array`           | Last 150 telemetry objects (oldest first)|

Pass `enabled={selectedDrone !== null}` from `App.tsx` — this is the gate that prevents any backend connection until a drone is selected.

**Do not create a second STOMP client.** If a new component needs telemetry data, pass `telemetry` / `history` as props from `App.tsx`, or use React Context if the prop chain becomes deep.

---

## MapComponent — CesiumJS Notes

`src/components/MapComponent.tsx` owns the Cesium `Viewer` instance.

**Props:** `{ telemetry, lowPerf, selectedDrone, onSelectDrone }`

**Imagery:** `UrlTemplateImageryProvider` (OpenStreetMap) is used by default — no Cesium Ion token required. If `VITE_CESIUM_TOKEN` is set in `.env`, Ion features (World Terrain, premium imagery) unlock automatically.

**Map dimming:** pressing `D` toggles map-only dimming for the Cesium imagery layer. The dim level is data-driven from `frontend/configs/map-settings.json` via `darkenPercent` (0-100), and the component applies `brightness = 1 - darkenPercent / 100` to imagery layers only. Do not dim the surrounding React layout.

**Drone selection overlay:** when `selectedDrone` is null, a centred overlay panel is rendered over the map listing available assets. Clicking an entry calls `onSelectDrone(id)`. The overlay also shows the drone's last known position fetched via a single `GET /api/telemetry/history` REST call — no WebSocket is open at this point.

**Static vs live drone entity:** there are two display modes:
- **Unselected** — a dimmed/muted drone icon is placed at the last known position (REST fetch). No flight path. Label uses `text-muted` color.
- **Selected** — full-brightness live icon + glowing flight path polyline updated each telemetry tick.

Whenever `selectedDrone` changes (select or deselect), all Cesium entities (`droneRef`, `pathRef`) are removed and `positionsRef` / `initialFlown` are reset before the new mode sets up its own entities.

**Drone entity:** rendered as a billboard using an inline SVG data URI. To replace with a 3D model:
```js
// In MapComponent.tsx, replace the billboard block with:
model: {
  uri:              '/models/drone.glb',  // place in frontend/public/models/
  scale:            50,
  minimumPixelSize: 32,
},
```

**Flight path:** a `CallbackProperty` returns `positionsRef.current` (last 200 `Cartesian3` points). It updates automatically as `positionsRef` is mutated. Only created when a drone is selected.

**Camera:** flies to the drone's position on first fix (either static last-known or first live packet). Do not remove `initialFlown.current` guard — it prevents re-flying on every render. The guard is reset on every `selectedDrone` change.

**Cesium refs lifecycle:**
- `viewerRef` — the `Cesium.Viewer` instance (created once, destroyed on unmount)
- `droneRef` — the drone `Entity` (static when unselected, live when selected; null between transitions)
- `pathRef` — the polyline `Entity` (only exists when a drone is selected)
- `positionsRef` — `Cartesian3[]` array (mutable, not React state — intentional for perf)

Do not put Cesium objects into React state (`useState`). They are mutable and do not need to trigger re-renders.

---

## Environment Variables

Defined in `frontend/.env` (copy from `.env.example`):

| Variable            | Default   | Notes                                         |
|---------------------|-----------|-----------------------------------------------|
| `VITE_WS_URL`       | _(empty)_ | Empty = use `/ws-skytrack` (nginx proxy). Set to `http://localhost:8080/ws-skytrack` for standalone `npm run dev` without the proxy. |
| `VITE_CESIUM_TOKEN` | _(empty)_ | Optional Cesium Ion token                     |

All `VITE_*` variables are baked into the bundle at build time by Vite.

---

## Vite Dev Server

```bash
cd frontend
npm install
npm run dev        # → http://localhost:5173
```

The dev server proxies `/api` and `/ws-skytrack` to `http://localhost:8080` (see `vite.config.ts`). The backend must be running for the map to receive data.

---

## Docker Build

Multi-stage `Dockerfile`:
1. **Stage `build`:** `node:20-alpine` — `npm install`, then `vite build`
2. **Stage runtime:** `nginx:1.27-alpine` — serves `/dist`, proxies API and WS

`ARG`/`ENV` blocks in the Dockerfile inject `VITE_*` build args passed from `docker-compose.yml`:
```yaml
build:
  args:
    VITE_CESIUM_TOKEN: ${VITE_CESIUM_TOKEN:-}
```

If you add a new `VITE_*` variable, add it as both an `ARG` and `ENV` line in the Dockerfile and a matching `build.args` entry in `docker-compose.yml`.

---

## index.css Rules

`src/index.css` contains **only**:
1. Tailwind directives (`@tailwind base/components/utilities`)
2. Cesium widget overrides (hiding the credit bar and toolbar)
3. Custom scrollbar styles

Do not add component-level CSS here. Use Tailwind classes directly in JSX.
