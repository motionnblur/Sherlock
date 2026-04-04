# AGENTS.md — Frontend

> Prerequisite: read `../AGENTS.md` first.

---

## Stack

| Component     | Library / Version                        |
|---------------|------------------------------------------|
| Language      | TypeScript (TS/TSX)                      |
| Framework     | React 18 + Vite 5                        |
| Styling       | Tailwind CSS 3 — **only styling method** |
| 3D Globe      | CesiumJS 1.116 via `vite-plugin-cesium`  |
| WebSocket     | `@stomp/stompjs` + `sockjs-client`       |
| HLS video     | `hls.js` — used only in `LiveVideoWindow` |
| Font          | JetBrains Mono (Google Fonts)            |

---

## Source Layout

```
src/
├── App.tsx                      # Root layout shell; auth gate (renders LoginPage when unauthenticated)
├── main.tsx                     # ReactDOM.createRoot entry point; wraps tree in <AuthProvider>
├── index.css                    # Tailwind directives + Cesium widget overrides
├── constants/
│   └── telemetry.ts             # Shared frontend domain constants (asset id, history/path limits)
├── contexts/
│   └── AuthContext.tsx          # AuthProvider: JWT state in sessionStorage, login(), logout()
├── interfaces/
│   ├── auth.ts                  # LoginCredentials, AuthToken interfaces
│   ├── telemetry.ts             # Shared domain models (TelemetryPoint, DroneId)
│   ├── components.ts            # Component prop interfaces and map settings interface
│   ├── hooks.ts                 # Hook return interfaces
│   └── index.ts                 # Barrel exports
├── hooks/
│   ├── useAuth.ts               # Consumes AuthContext; throws if used outside <AuthProvider>
│   ├── useLogin.ts              # Login form submission logic; calls POST /api/auth/login
│   ├── useTelemetry.ts          # STOMP client; JWT in connectHeaders; auto-logout on auth error
│   └── useStreamUrl.ts          # Fetches HLS stream URL; JWT in Authorization header; 401 → logout
├── utils/
│   ├── formatters.ts            # Shared UI formatting helpers for coordinates, UTC time, cardinal heading
│   └── telemetry.ts             # Runtime parsing/validation helpers for external telemetry payloads
├── configs/
│   └── map-settings.json        # Map-only dimming config for Cesium imagery
└── components/
    ├── Drone.tsx                # Drone entity/path lifecycle, last-known REST fetch, camera tracking handoff
    ├── Header.tsx               # Top bar: branding, UTC clock, link/offline status, LOG OUT button, settings
    ├── LiveVideoWindow.tsx      # Floating 240×240 HLS video window; uses hls.js; mounted inside <main> over the map
    ├── LoginPage.tsx            # Full-screen operator authentication form (shown when unauthenticated)
    ├── MapComponent.tsx         # CesiumJS viewer shell, performance profile, overlays, passes viewer to <Drone />
    ├── SectionHeader.tsx        # Shared panel section divider/header component
    ├── StatusBar.tsx            # Bottom bar: alerts, mission status, asset name
    ├── SystemPanel.tsx          # Right sidebar: compass, mission clock, log (hidden when no drone selected)
    └── TelemetryPanel.tsx       # Left sidebar: lat/lon/alt/speed/battery (hidden when no drone selected)
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

`TelemetryPanel` and `SystemPanel` are conditionally mounted — they only appear when `selectedDrone` is non-null and `freeMode` is OFF. Do not render them unconditionally. Additionally, when `freeMode` is ON, coordinate displays from `StatusBar` and `MapComponent` overlays are suppressed.

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

Define any reusable interfaces in `src/interfaces/`:
- Domain data models in `src/interfaces/telemetry.ts`
- Component props in `src/interfaces/components.ts`
- Hook contracts in `src/interfaces/hooks.ts`

Before adding new formatting or asset-specific literals:
- Check `src/constants/telemetry.ts` for shared domain constants
- Check `src/utils/formatters.ts` for coordinate/time/value formatting
- Check `src/components/SectionHeader.tsx` before duplicating section header markup

Pattern to follow for a data row:
```tsx
// label left, value right, consistent spacing
<div className="flex items-baseline justify-between py-1.5 border-b border-line">
  <span className="text-[10px] text-muted tracking-widest uppercase">{label}</span>
  <span className="text-sm font-bold tabular-nums text-neon">{value}</span>
</div>
```

Pattern for a section header inside a panel:
```tsx
<SectionHeader title="POSITION" />
```

---

## useTelemetry Hook

`src/hooks/useTelemetry.ts` — the single source of truth for live data.

```ts
const { telemetry, connected, history } = useTelemetry(enabled, freeMode);
```

| Parameter    | Type      | Description                                               |
|--------------|-----------|-----------------------------------------------------------|
| `enabled`    | `boolean` | When `false`, STOMP client is deactivated and state is cleared. Defaults to `true`. |
| `freeMode`   | `boolean` | When `true`, dynamically subscribes to `/topic/telemetry/lite` bypassing heavy fields. |

| Return value | Type              | Description                              |
|--------------|-------------------|------------------------------------------|
| `telemetry`  | `TelemetryPoint \| null`  | Latest telemetry packet (null until first message) |
| `connected`  | `boolean`         | STOMP link status                        |
| `history`    | `TelemetryPoint[]`| Last 150 telemetry objects (oldest first)|

Pass `enabled={selectedDrone !== null}` from `App.tsx` — this is the gate that prevents any backend connection until a drone is selected.

Incoming STOMP payloads are parsed through `src/utils/telemetry.ts`. Malformed payloads are ignored rather than pushed directly into React state.

**Do not create a second STOMP client.** If a new component needs telemetry data, pass `telemetry` / `history` as props from `App.tsx`, or use React Context if the prop chain becomes deep.

---

## Authentication

The app gate is in `App.tsx`:
```tsx
const { authToken, logout } = useAuth();
if (!authToken) return <LoginPage />;
```
All hooks are still instantiated when `LoginPage` is shown, but `useTelemetry` is gated by `enabled={selectedDrone !== null}` so no backend connections are made.

### Auth context
`AuthContext.tsx` stores the JWT in `sessionStorage` (key: `skytrack_auth`). The token is validated on load — expired tokens are evicted immediately. The session clears when the tab or browser closes.

```tsx
const { authToken, login, logout } = useAuth();
// authToken: { token, username, expiresAt } | null
```

Do not import `AuthContext` directly. Always go through `useAuth()`.

### Attaching the token to requests
Every HTTP call must include the JWT header:
```ts
headers: { Authorization: `Bearer ${authToken.token}` }
```
STOMP connections pass it in `connectHeaders`:
```ts
connectHeaders: { Authorization: `Bearer ${authToken.token}` }
```
Both `useTelemetry` and `useStreamUrl` already do this. Any new hook or service that calls the backend must follow the same pattern.

### Handling 401 responses
A 401 from any endpoint means the token has expired or been revoked. Always respond by calling `logout()` — do not show a retry loop. The user will be returned to `LoginPage` automatically.

### Logout
`App.tsx` fires a best-effort `POST /api/auth/logout` to blacklist the token server-side, then calls `logout()` from `useAuth()`. The LOG OUT button is rendered in `Header` via the `onLogout` prop.

### Adding a new component that needs auth data
Pass `authToken` as a prop from `App.tsx`, or call `useAuth()` in a hook that the component consumes. Do not access `sessionStorage` directly in components.

---

## MapComponent — CesiumJS Notes

`src/components/MapComponent.tsx` owns the Cesium `Viewer` instance and map UI overlays.  
`src/components/Drone.tsx` owns drone entity/path lifecycle, last-known history fetch, and viewer tracking handoff.

**Props:** `{ telemetry, lowPerf, selectedDrone, freeMode, onSelectDrone }`

**Imagery:** `UrlTemplateImageryProvider` (OpenStreetMap) is used by default — no Cesium Ion token required. If `VITE_CESIUM_TOKEN` is set in `.env`, Ion features (World Terrain, premium imagery) unlock automatically.

**Viewer lifecycle:** the Cesium viewer is created once when `MapComponent` mounts and destroyed only on unmount. Do not tie viewer creation/destruction to `selectedDrone`; selection should only change overlays/entities, not recreate the entire globe.

**Map dimming:** pressing `D` toggles map-only dimming for the Cesium imagery layer. The dim level is data-driven from `frontend/configs/map-settings.json` via `darkenPercent` (0-100), and the component applies `brightness = 1 - darkenPercent / 100` to imagery layers only. Do not dim the surrounding React layout.

**Low perf mode:** `MapComponent` owns Cesium performance tuning. It applies the low/high performance profile and is solely responsible for attaching/removing the optional OSM buildings tileset. Do not remove generic `Cesium3DTileset` primitives by scanning the entire scene.

**Drone selection overlay:** when `selectedDrone` is null, a centred overlay panel is rendered over the map listing available assets. Clicking an entry calls `onSelectDrone(id)`. The overlay also shows the drone's last known position fetched via a single `GET /api/telemetry/history` REST call — no WebSocket is open at this point.

**Static vs live drone entity:** there are two display modes:
- **Unselected** — a dimmed/muted drone icon is placed at the last known position (REST fetch). No flight path. Label uses `text-muted` color.
- **Selected** — full-brightness live icon + glowing flight path polyline updated each telemetry tick.

Whenever `selectedDrone` changes (select or deselect), `Drone.tsx` removes all drone entities (`droneRef`, `pathRef`) and resets `positionsRef` / `initialFlown` before the new mode sets up its own entities.

**Drone entity:** rendered as a billboard using an inline SVG data URI. To replace with a 3D model:
```ts
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
- `MapComponent.viewerRef` — the `Cesium.Viewer` instance (created once, destroyed on unmount)
- `MapComponent.buildingsRef` — optional OSM buildings tileset, attached/removed by performance mode
- `Drone.droneRef` — the drone `Entity` (static when unselected, live when selected; null between transitions)
- `Drone.pathRef` — the polyline `Entity` (only exists when a drone is selected)
- `Drone.positionsRef` — `Cartesian3[]` array (mutable, not React state — intentional for perf)
- `Drone.initialFlown` — first-fix camera guard, reset on selection transitions

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

## Live Video — HLS Proxy

HLS segments are served through a proxy path so the browser never makes a cross-origin request:

| Environment    | HLS URL seen by the browser         | Proxied to              |
|----------------|-------------------------------------|-------------------------|
| Docker (nginx) | `http://<host>/hls/{droneId}/…`     | `mediamtx:8888`         |
| Dev (`npm run dev`) | `http://localhost:5173/hls/{droneId}/…` | `localhost:8888`   |

The stream URL returned by `GET /api/drones/{droneId}/stream` already uses the MediaMTX internal address (`http://mediamtx:8888/…`). `useStreamUrl` reuses this URL as-is; the nginx `/hls/` proxy block rewrites it transparently.

**Do not bypass this proxy** by pointing `hls.js` directly at `mediamtx:8888` from JSX — that breaks in Docker where MediaMTX is not exposed to the host on that path.

### LiveVideoWindow rules
- Always mounted **inside `<main>`** (the map area) as an absolutely-positioned overlay — never outside it.
- Size is fixed at 240×240 px via named constants in the component file. Do not use magic numbers.
- Uses `hls.js` when `Hls.isSupported()` is true; falls back to native `<video src>` for Safari.
- The `hls.js` instance is created/destroyed via a `useEffect` that depends on `streamUrl`. Do not manage it with `useState`.

---

## Vite Dev Server

```bash
cd frontend
npm install
npm run dev        # → http://localhost:5173
```

The dev server proxies `/api`, `/ws-skytrack`, and `/hls` according to `vite.config.ts`.
Proxy targets are read from environment variables with localhost fallbacks:

| Variable        | Default                  | Used by                  |
|-----------------|--------------------------|--------------------------|
| `BACKEND_URL`   | `http://localhost:8080`  | `/api`, `/ws-skytrack`   |
| `MEDIAMTX_URL`  | `http://localhost:8888`  | `/hls`                   |

The backend must be running for the map to receive data.

---

## Docker Build

Two Dockerfiles, selected via Docker Compose profiles in `docker-compose.yml`:

### Production (`--profile prod`) — `Dockerfile`
Multi-stage build:
1. **Stage `build`:** `node:20-alpine` — `npm install`, then `vite build`
2. **Stage runtime:** `nginx:1.27-alpine` — serves `/dist`, proxies API and WS on **:80**

`ARG`/`ENV` blocks inject `VITE_*` build args from `docker-compose.yml`:
```yaml
build:
  args:
    VITE_CESIUM_TOKEN: ${VITE_CESIUM_TOKEN:-}
```
If you add a new `VITE_*` variable, add it as both an `ARG` and `ENV` line in the Dockerfile and a matching `build.args` entry in `docker-compose.yml`.

### Development (`--profile dev`) — `Dockerfile.dev`
Single-stage: `node:20-alpine` — installs dependencies, then runs `npm run dev`.
The source tree is mounted as a volume at runtime — no rebuild needed for code changes.
Proxy targets are injected via environment variables (`BACKEND_URL`, `MEDIAMTX_URL`).
File watching uses polling (`CHOKIDAR_USEPOLLING=true`) for bind-mount compatibility.
Serves on **:5173** with full HMR.

```bash
docker build -t sherlock-frontend-dev -f Dockerfile.dev ./frontend
```

---

## index.css Rules

`src/index.css` contains **only**:
1. Tailwind directives (`@tailwind base/components/utilities`)
2. Cesium widget overrides (hiding the credit bar and toolbar)
3. Custom scrollbar styles

Do not add component-level CSS here. Use Tailwind classes directly in JSX.
