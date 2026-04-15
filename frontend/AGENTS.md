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
├── App.tsx                      # Root layout shell; auth gate; wires useCommand → SystemPanel
├── main.tsx                     # ReactDOM.createRoot entry point; wraps tree in <AuthProvider>
├── index.css                    # Tailwind directives + Cesium widget overrides
├── constants/
│   ├── driver.ts                # Driver-mode navigation thresholds/defaults
│   ├── mission.ts               # Mission planning constants (minimum waypoint count, nudge step sizes, gizmo sizes)
│   ├── performance.ts           # Performance-stage model and stage-cycling helper
│   └── telemetry.ts             # Shared frontend domain constants (asset id, history/path limits)
├── contexts/
│   └── AuthContext.tsx          # AuthProvider: JWT state in sessionStorage, login(), logout()
├── interfaces/
│   ├── auth.ts                  # LoginCredentials, AuthToken interfaces
│   ├── command.ts               # Command lifecycle models (status + command log entry)
│   ├── components.ts            # Component prop interfaces (HeaderProps includes mission/geofence/replay toggles; MapComponentProps includes mission/geofence/replay overlays)
│   ├── geofence.ts              # Geofence domain models, request shapes, alert payloads, hook return type
│   ├── hooks.ts                 # Hook return interfaces
│   ├── mission.ts               # Mission, MissionWaypoint, PlanningWaypoint, MissionStatus, WaypointStatus, UseMissionResult
│   ├── telemetry.ts             # Shared domain models (TelemetryPoint, DroneId) — includes extended fields
│   └── index.ts                 # Barrel exports
├── hooks/
│   ├── useAuth.ts               # Consumes AuthContext; throws if used outside <AuthProvider>
│   ├── useCommand.ts            # POST /api/drones/{id}/command — RTH/ARM/DISARM/TAKEOFF/GOTO; returns sendCommand(..., options), isSending, commandError; 401 → logout
│   ├── useLastKnownTelemetry.ts # One-shot bulk bootstrap from POST /api/telemetry/last-known
│   ├── useLogin.ts              # Login form submission logic; calls POST /api/auth/login
│   ├── useMission.ts            # Mission CRUD (create/update/delete) + execute/abort; polls GET /api/missions/{id} every 1s while ACTIVE; 401 → logout
│   ├── useGeofences.ts          # CRUD hook for /api/geofences + activate/deactivate + geofence error handling
│   ├── useFlightReplay.ts       # Range-based replay hook for GET /api/telemetry/history + playback cursor + CSV export + 401 logout
│   ├── useTelemetry.ts          # STOMP client; selected stream + bounded fleet summary + command lifecycle log (REST bootstrap + STOMP updates)
│   ├── useStreamUrl.ts          # Fetches HLS stream URL; JWT in Authorization header; 401 → logout
│   └── useDroneRegistry.ts      # Polls GET /api/drones every 30s; 401 → logout
├── utils/
│   ├── flightReplay.ts          # CSV serialization + replay export filename helpers
│   ├── formatters.ts            # Shared UI formatting helpers for coordinates, UTC time, cardinal heading
│   ├── geo.ts                   # Haversine distance helpers used by driver-mode waypoint tracking
│   └── telemetry.ts             # Runtime parsing/validation helpers; extended fields are optional-passthrough
├── configs/
│   └── map-settings.json        # Map-only dimming config for Cesium imagery
└── components/
    ├── AssetSelectionOverlay.tsx# Virtualized startup asset selector with last-known telemetry rows
    ├── AttitudeIndicator.tsx    # SVG artificial horizon; props: roll, pitch (degrees), size (px)
    ├── VirtualizedAssetList.tsx # Shared fixed-row virtualization primitive for large asset lists
    ├── Header.tsx               # Top bar: branding, UTC clock, link/offline status, LOG OUT button, settings incl. mission/geofence/replay toggles
    ├── FlightReplayWindow.tsx   # Floating replay controls: time range, load, play/pause, slider seek, CSV export
    ├── LiveVideoWindow.tsx      # Floating 240×240 HLS video window; uses hls.js; mounted inside <main> over the map
    ├── LoginPage.tsx            # Full-screen operator authentication form (shown when unauthenticated)
    ├── MapComponent.tsx         # CesiumJS viewer shell + driver/mission overlays + replay path/cursor rendering
    ├── FlightLogSection.tsx     # Extracted flight log sub-component; last 8 alt/speed entries from history
    ├── GeofenceAlertWindow.tsx   # Floating alert tray for `/topic/alerts/geofence` enter/exit events
    ├── GeofenceManagementPanel.tsx # Right sidebar geofence manager: DRAW + SAVED tabs with create/edit/delete/activate controls
    ├── PreflightChecklist.tsx   # GO/NO-GO preflight status panel derived from telemetry + connection props
    ├── MissionPlanningPanel.tsx # Right sidebar in mission mode: NEW tab + SAVED tab + PLANNED mission edit session (rename, add/remove, nudge, save/cancel); ACTIVE mission progress view
    ├── SectionHeader.tsx        # Shared panel section divider/header component
    ├── LowBatteryWindow.tsx     # Floating bottom-right panel; battery alerts in FREE MODE + SHOW ALL only
    ├── StatusBar.tsx            # Bottom bar: alerts, mission status, asset name
    ├── SystemPanel.tsx          # Right sidebar: preflight GO/NO-GO checklist, compass, mission clock, datalink (RSSI/arm/mode), C2 commands + command lifecycle log + DRIVER MODE toggle
    └── TelemetryPanel.tsx       # Left sidebar: position/kinematics/battery + attitude indicator + GPS quality
    └── map/
        ├── cesiumScene.ts       # Cesium viewer + entity/primitive helper functions/constants
        ├── geofenceScene.ts     # Cesium helpers for active/draft geofence overlays
        └── missionGizmo.ts      # Mission waypoint gizmo axis math, drag-plane projection, and pick helpers
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
const { telemetry, fleetTelemetry, connected, history, batteryAlerts, geofenceAlerts, commandLog } = useTelemetry(
  selectedDrone,
  freeMode,
  showAllAssets,
);
```

| Parameter       | Type      | Description                                               |
|-----------------|-----------|-----------------------------------------------------------|
| `selectedDrone` | `string \| null` | Selected drone ID. When null, no STOMP connection is created. |
| `freeMode`      | `boolean` | Enables free-mode behavior in subscription selection.     |
| `showAllAssets` | `boolean` | In free mode, subscribes to one fleet summary topic instead of per-drone fan-out. |

| Return value    | Type                     | Description                              |
|-----------------|--------------------------|------------------------------------------|
| `telemetry`     | `TelemetryPoint \| null` | Latest telemetry packet for selected drone (includes extended fields when available) |
| `fleetTelemetry`| `Record<string, TelemetryPoint>` | Latest fleet-lite points keyed by drone ID |
| `connected`     | `boolean`                | STOMP link status                        |
| `history`       | `TelemetryPoint[]`       | Last 150 selected-drone telemetry packets |
| `batteryAlerts` | `LowBatteryAlert[]`      | Active low-battery alerts, sorted by battery ascending; sourced from `/topic/alerts/battery` (event-driven, emitted only on threshold crossing) |
| `geofenceAlerts` | `GeofenceAlert[]`      | Active geofence enter/exit alerts; sourced from `/topic/alerts/geofence` and deduped in arrival order |
| `commandLog`    | `CommandLogEntry[]`      | Last command lifecycle events for selected drone; bootstrapped from `GET /api/drones/{id}/commands?limit=20` and updated from STOMP `/topic/commands/{id}` |

### useCommand

`src/hooks/useCommand.ts` — sends C2 commands to the backend.

```ts
const { sendCommand, isSending, commandError } = useCommand(selectedDrone, authToken);
// sendCommand('RTH' | 'ARM' | 'DISARM' | 'TAKEOFF' | 'GOTO', { latitude?, longitude?, altitude? })
// commandError: 'DRONE NOT CONNECTED' | 'VEHICLE NOT READY' | 'INVALID COMMAND' | 'MAVLINK DISABLED' | 'CMD FAILED (xxx)' | null
```

When `app.mavlink.enabled=false` on the server, `sendCommand` still reports `MAVLINK DISABLED` for non-simulator drones. Simulator drones (`SHERLOCK-*`) receive server-side synthetic ACK lifecycle updates.
If the command endpoint returns `401`, the hook immediately calls `logout()` to return the operator to `LoginPage`.

Subscription model:
- Always subscribes to selected full stream: `/topic/telemetry/{droneId}`
- In Free Mode + SHOW ASSET ALL, also subscribes to `/topic/telemetry/lite/fleet` and `/topic/alerts/battery`
- Always subscribes to `/topic/alerts/geofence` for the selected drone so geofence breaches are visible outside Free Mode as well
- Always subscribes to `/topic/commands/{droneId}` for command lifecycle transitions
- Never opens one STOMP subscription per drone in all-assets mode
- SHOW ASSETS BY NAW filtering is client-side (heading-based) and does not create extra backend topics or subscriptions

Incoming STOMP payloads are parsed through `src/utils/telemetry.ts`. Malformed payloads are ignored rather than pushed directly into React state.

**Do not create a second STOMP client.** If a new component needs telemetry data, pass `telemetry` / `history` as props from `App.tsx`, or use React Context if the prop chain becomes deep.

### useGeofences

`src/hooks/useGeofences.ts` — REST hook for the geofence CRUD surface.

```ts
const {
  geofences,
  isLoading,
  geofenceError,
  refreshGeofences,
  createGeofence,
  updateGeofence,
  deleteGeofence,
  setGeofenceActive,
} = useGeofences(authToken);
```

- `createGeofence()` and `updateGeofence()` send the polygon payload to `/api/geofences`
- `setGeofenceActive()` maps to `/activate` and `/deactivate`
- `deleteGeofence()` removes a fence and drops it from local cache
- `geofenceError` surfaces backend validation, not-found, name-collision, or network failure states
- 401 responses always trigger `logout()` and return the operator to `LoginPage`

### useFlightReplay

`src/hooks/useFlightReplay.ts` powers post-flight telemetry replay for the selected drone.

- Loads replay data from `GET /api/telemetry/history?droneId={id}&start={ISO}&end={ISO}`
- Expects ascending telemetry arrays (range mode) and drives a local playback cursor at 2 Hz (500 ms)
- Exports loaded replay arrays to CSV (`timestamp` + full telemetry field set)
- 401 responses always trigger `logout()` and return the operator to `LoginPage`
- Does not open any additional STOMP connection (replay is REST + local timeline only)

---

## Authentication

The app gate is in `App.tsx`:
```tsx
const { authToken, logout } = useAuth();
if (!authToken) return <LoginPage />;
```
All hooks are still instantiated when `LoginPage` is shown, but `useTelemetry` receives `selectedDrone=null`, so no backend WebSocket connection is created.

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
`useTelemetry`, `useStreamUrl`, `useLastKnownTelemetry`, `useDroneRegistry`, `useCommand`, and `useFlightReplay` already do this. Any new hook or service that calls the backend must follow the same pattern.

### Handling 401 responses
A 401 from any endpoint means the token has expired or been revoked. Always respond by calling `logout()` — do not show a retry loop. The user will be returned to `LoginPage` automatically.

### Logout
`App.tsx` fires a best-effort `POST /api/auth/logout` to blacklist the token server-side, then calls `logout()` from `useAuth()`. The LOG OUT button is rendered in `Header` via the `onLogout` prop.

### Adding a new component that needs auth data
Pass `authToken` as a prop from `App.tsx`, or call `useAuth()` in a hook that the component consumes. Do not access `sessionStorage` directly in components.

---

## MapComponent — CesiumJS Notes

`src/components/MapComponent.tsx` owns the Cesium `Viewer` instance, selected-drone entity/path, fleet point layer, and map UI overlays.

**Props:** includes selected/fleet telemetry, driver-mode route controls, and mission-edit controls (`missionWaypoints`, `selectedMissionWaypointLocalId`, `onSelectMissionWaypoint`, `onMoveMissionWaypoint`, `isMissionWaypointEditingEnabled`).

**Mission Planning Mode:** enabled via SETTINGS → MISSION PLAN. When active, `MissionPlanningPanel` replaces `SystemPanel` in the right sidebar. Left-click on the map adds amber waypoints to the active editable route (NEW plan draft or SAVED mission edit session). Missions are saved with `POST /api/missions`; saved PLANNED missions are edited in-place with `PUT /api/missions/{id}`. Selected editable nodes render a Unity-style move gizmo (`X=red`, `Y=green`, `Z=blue`) and can be moved by drag (mouse) or by panel nudge controls (touch + desktop). While mission mode is enabled, camera mouse controls are locked (rotate/pan/zoom/tilt/look) to avoid conflicts with waypoint editing and gizmo interaction. During execution, `MissionExecutorService` sends sequential GOTO commands and publishes progress to STOMP `/topic/missions/{id}/progress`. The frontend polls GET `/api/missions/{id}` every 1s while ACTIVE and renders waypoint status colours. Mission mode and Driver Mode are mutually exclusive.

**Geofence Draw Mode:** enabled via SETTINGS → GEOFENCE DRAW. When active, `GeofenceManagementPanel` replaces `SystemPanel` in the right sidebar. The panel has `DRAW` and `SAVED` tabs:
- `DRAW`: create/edit draft name and vertices, save/cancel, undo/remove/clear controls
- `SAVED`: list all saved geofences, start edit sessions, activate/deactivate, and delete (confirm step)
Left-click on empty map adds vertices to the draft polygon. Clicking a draft vertex selects it; dragging a draft vertex moves it in-place. Draft geofences render green; active saved fences render amber; inactive saved fences render muted gray. While editing a saved geofence, the original saved polygon is hidden and only the draft overlay is shown. Geofence mode is mutually exclusive with Mission Planning and Driver Mode.

**Driver Mode:** when enabled from `SystemPanel`, left-click on the map appends waypoints to a visible route polyline. Each new waypoint altitude is aligned to the selected drone's current altitude (live telemetry first, then fleet/last-known fallback). Click picking first intersects a camera ray with a plane at the drone altitude to avoid cursor/waypoint parallax drift. While driver mode is enabled, the map camera is locked for rotate/pan/tilt/look, keeps a top-down follow view centered on the selected drone, disables native Cesium zoom, and applies mouse-wheel zoom as a custom camera-height offset around the selected drone pivot. Waypoints are sent sequentially as backend `GOTO` commands; the frontend sends waypoint altitude in AMSL (same frame as telemetry), and backend converts it to relative-home before MAVLink dispatch. The next point is dispatched only after the active point is reached within configured horizontal/vertical thresholds.

**Flight Replay Mode:** enabled via SETTINGS → FLIGHT REPLAY. It mounts `FlightReplayWindow` in the map area, loads telemetry by time range from the history REST endpoint, renders full replay path + moving replay cursor on Cesium, and allows play/pause/seek + CSV export. While replay path is active, selected drone live path/entity rendering is hidden on the map and resumes when replay mode turns off.

**Imagery:** `UrlTemplateImageryProvider` (OpenStreetMap) is used by default — no Cesium Ion token required. If `VITE_CESIUM_TOKEN` is set in `.env`, Ion features (World Terrain, premium imagery) unlock automatically.

**Viewer lifecycle:** the Cesium viewer is created once when `MapComponent` mounts and destroyed only on unmount. Do not tie viewer creation/destruction to `selectedDrone`; selection should only change overlays/entities, not recreate the entire globe.

**Map dimming:** pressing `D` toggles map-only dimming for the Cesium imagery layer. The dim level is data-driven from `frontend/configs/map-settings.json` via `darkenPercent` (0-100), and the component applies `brightness = 1 - darkenPercent / 100` to imagery layers only. Do not dim the surrounding React layout.

**Low perf mode:** `MapComponent` owns Cesium performance tuning using a 3-stage profile:
- **Stage 0 (normal):** full map quality profile; optional OSM buildings may be attached.
- **Stage 1 (low):** existing low-perf behavior (reduced terrain quality + no buildings).
- **Stage 2 (minimal map):** stronger map-only degradation (higher terrain error, reduced tile cache/preload behavior, nearest-neighbor imagery sampling) while keeping drone entities/path rendering unchanged.
`MapComponent` is solely responsible for attaching/removing the optional OSM buildings tileset. Do not remove generic `Cesium3DTileset` primitives by scanning the entire scene.

**Drone selection overlay:** when `selectedDrone` is null, `AssetSelectionOverlay` is rendered as a standalone centred panel inside `<main>` in `App.tsx` — the Cesium map is **not mounted** and no backend connections are made. The overlay lists drone IDs only; last-known telemetry is not fetched until an asset is selected. `useLastKnownTelemetry` accepts an `enabled: boolean` parameter and skips all fetches when false.

**Fleet rendering model:**
- **Selected drone:** one full-detail Cesium `Entity` + optional live path polyline (expensive path features only here).
- **Non-selected drones:** lightweight `PointPrimitiveCollection` entries (no per-drone path entities, no per-drone labels).
- **All-assets view:** points are fed by fleet summary topic updates, not per-drone REST fetches or per-drone STOMP subscriptions.
- **NAW direction filter:** available only when `freeMode && showAllAssets`; filters all-assets fleet points by telemetry `heading` buckets (`N, NE, E, SE, S, SW, W, NW`, plus `ALL` reset).

Whenever `selectedDrone` changes, `MapComponent` resets selected entity/path refs before creating the next selected state.

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
- `MapComponent.selectedDroneRef` — selected drone `Entity`
- `MapComponent.selectedPathRef` — selected drone path `Entity`
- `MapComponent.pathPositionsRef` — selected drone path points (`Cartesian3[]`)
- `MapComponent.fleetPointCollectionRef` — lightweight fleet point primitive collection

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

## Unit Testing

**Runner:** Vitest 4 + `@testing-library/react` 16 + `@testing-library/jest-dom` 6.  
**Environment:** jsdom (configured in `vitest.config.ts`).  
**Setup file:** `src/test/setup.ts` — imports jest-dom matchers and runs `cleanup` after each test.

```bash
cd frontend
npm test          # vitest run (single pass)
```

### Coverage

| Layer | Files | What is tested |
|---|---|---|
| Utils | `utils/formatters.test.ts` | `clamp`, `formatFixed`, `formatHemisphereCoordinate`, `formatCoordinatePair`, `formatUtcTime`, `getCardinalDirection` |
| Utils | `utils/geo.test.ts` | `horizontalDistanceMeters` (Haversine) |
| Utils | `utils/flightReplay.test.ts` | CSV serialization, filename sanitization |
| Utils | `utils/telemetry.test.ts` | Payload parsing, geofence alerts, command lifecycle |
| Constants | `constants/performance.test.ts` | `getNextPerformanceStage` stage cycling |
| Context | `contexts/AuthContext.test.tsx` | `AuthProvider` mount, token persistence, expiry eviction, login/logout |
| Hooks | `hooks/useAuth.test.tsx` | Context consumption, throws outside provider |
| Hooks | `hooks/useCommand.test.tsx` | All HTTP status codes → error strings, 401 logout, request body |
| Hooks | `hooks/useLogin.test.tsx` | Success, failure, error fallback, credential body |
| Hooks | `hooks/useGeofences.test.tsx` | CRUD operations, 401 logout, error codes |
| Hooks | `hooks/useDroneRegistry.test.tsx` | Polling, non-string ID filtering, 401 logout |
| Hooks | `hooks/useStreamUrl.test.tsx` | Fetch, 401 logout, `clearStreamUrl`, auth header |
| Hooks | `hooks/useLastKnownTelemetry.test.tsx` | Enabled/disabled guard, empty droneIds, 401 logout |
| Hooks | `hooks/useFlightReplay.test.tsx` | Load, validation, 401 logout, playback controls, seek, clear |
| Components | `components/AttitudeIndicator.test.tsx` | SVG rendering |
| Components | `components/Header.test.tsx` | Settings menu, mode toggles |
| Components | `components/SystemPanel.test.tsx` | C2 commands, command log |
| Components | `components/StatusBar.test.tsx` | Status indicators, performance stage |
| Components | `components/TelemetryPanel.test.tsx` | Telemetry display |
| Components | `components/LoginPage.test.tsx` | Auth form |
| Components | `components/SectionHeader.test.tsx` | Title rendering |

### Testing patterns

- **Mocking fetch:** use `vi.stubGlobal('fetch', vi.fn().mockResolvedValue({...}))` — always `vi.restoreAllMocks()` in `afterEach`.
- **Auth in hook tests:** wrap with `{ wrapper: AuthProvider }`. For hooks that read `authToken` from `useAuth()` (e.g. `useStreamUrl`, `useLastKnownTelemetry`), pre-populate `sessionStorage` with a valid token before rendering.
- **Stable array references:** never pass inline array literals to `renderHook` callbacks when the array appears in a `useEffect` dependency. Declare the array as a `const` outside the callback to avoid infinite re-render loops.
- **Logout verification:** after triggering a 401 flow, assert `sessionStorage.getItem('skytrack_auth')` is `null` (the `AuthProvider` clears it on `logout()`).
- **No second STOMP client in tests:** `useTelemetry` is not unit-tested directly; its STOMP client is complex to mock. Prefer integration tests or manual QA for live-data flows.

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
