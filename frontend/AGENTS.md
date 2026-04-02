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
├── App.jsx                      # Root layout shell, passes telemetry state down
├── main.jsx                     # ReactDOM.createRoot entry point
├── index.css                    # Tailwind directives + Cesium widget overrides
├── configs/
│   └── map-settings.json        # Map-only dimming config for Cesium imagery
│
├── hooks/
│   └── useTelemetry.js          # STOMP client, auto-reconnect, history state
│
└── components/
    ├── Header.jsx               # Top bar: branding, UTC clock, link status
    ├── TelemetryPanel.jsx       # Left sidebar: lat/lon/alt/speed/battery
    ├── MapComponent.jsx         # CesiumJS 3D globe with drone entity + flight path
    ├── SystemPanel.jsx          # Right sidebar: compass, mission clock, log
    └── StatusBar.jsx            # Bottom bar: alerts and mission status
```

---

## Layout Structure

```
<App>                          full height, flex-col, bg-surface
├── <Header>                   h-11, bg-panel, border-b border-line
├── <div class="flex flex-1">  main content row
│   ├── <TelemetryPanel>       w-64, bg-panel, border-r border-line
│   ├── <main class="flex-1">  CesiumJS canvas fills this
│   │   └── <MapComponent>
│   └── <SystemPanel>          w-52, bg-panel, border-l border-line
└── <StatusBar>                h-7, bg-elevated, border-t border-line
```

**Do not change this structural layout** unless asked. Widths (`w-64`, `w-52`) are intentional for data density.

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

1. Create `src/components/YourComponent.jsx`
2. Accept data via props (all data flows from `useTelemetry` → `App.jsx` → props)
3. Use only Tailwind utility classes for styling
4. Mount it in `App.jsx` and pass the relevant props

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

`src/hooks/useTelemetry.js` — the single source of truth for live data.

```js
const { telemetry, connected, history } = useTelemetry();
```

| Return value | Type              | Description                              |
|--------------|-------------------|------------------------------------------|
| `telemetry`  | `Object \| null`  | Latest telemetry packet (null until first message) |
| `connected`  | `boolean`         | STOMP link status                        |
| `history`    | `Array`           | Last 150 telemetry objects (oldest first)|

**Do not create a second STOMP client.** If a new component needs telemetry data, pass `telemetry` / `history` as props from `App.jsx`, or use React Context if the prop chain becomes deep.

---

## MapComponent — CesiumJS Notes

`src/components/MapComponent.jsx` owns the Cesium `Viewer` instance.

**Imagery:** `UrlTemplateImageryProvider` (OpenStreetMap) is used by default — no Cesium Ion token required. If `VITE_CESIUM_TOKEN` is set in `.env`, Ion features (World Terrain, premium imagery) unlock automatically.

**Map dimming:** pressing `D` toggles map-only dimming for the Cesium imagery layer. The dim level is data-driven from `frontend/configs/map-settings.json` via `darkenPercent` (0-100), and the component applies `brightness = 1 - darkenPercent / 100` to imagery layers only. Do not dim the surrounding React layout.

**Drone entity:** rendered as a billboard using an inline SVG data URI. To replace with a 3D model:
```js
// In MapComponent.jsx, replace the billboard block with:
model: {
  uri:              '/models/drone.glb',  // place in frontend/public/models/
  scale:            50,
  minimumPixelSize: 32,
},
```

**Flight path:** a `CallbackProperty` returns `positionsRef.current` (last 200 `Cartesian3` points). It updates automatically as `positionsRef` is mutated.

**Camera:** flies to the drone's position on first telemetry fix. Do not remove `initialFlown.current` guard — it prevents re-flying on every render.

**Cesium refs lifecycle:**
- `viewerRef` — the `Cesium.Viewer` instance (created once, destroyed on unmount)
- `droneRef` — the drone `Entity` (created on first telemetry, updated each tick)
- `pathRef` — the polyline `Entity`
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

The dev server proxies `/api` and `/ws-skytrack` to `http://localhost:8080` (see `vite.config.js`). The backend must be running for the map to receive data.

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
