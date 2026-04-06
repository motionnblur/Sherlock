# AGENTS.md — Sherlock GCS (Root)

> Read this file first. Then read the sub-AGENTS.md that matches your duty.

---

## What This Project Is

**Sherlock GCS** is a defense-style real-time UAV Ground Control Station.  
A Spring Boot backend simulates UAV telemetry at 2 Hz, streams it via STOMP/WebSocket, persists every point to PostgreSQL, and exposes a REST history endpoint. A React frontend renders the live data on a CesiumJS 3D globe alongside a military C2 dashboard layout.

---

## Repository Layout

```
Sherlock/
├── backend/          # Spring Boot 3.2 application (Java 17)
│   ├── src/
│   └── AGENTS.md     ← read if you touch Java/backend
│
├── frontend/         # React 18 + Vite + CesiumJS application
│   ├── src/
│   └── AGENTS.md     ← read if you touch React/frontend
│
├── docker-compose.yml
├── .env.example
└── README.md
```

Additional runtime service (not a build artifact):
- **MediaMTX** (`bluenviron/mediamtx`) — RTSP/HLS media proxy. Accepts RTSP push from a real drone (or FFmpeg simulator) on `:8554` and re-serves HLS on `:8888`.

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Docker Network                            │
│                                                                  │
│  ┌──────────┐   STOMP/WS       ┌──────────────┐                 │
│  │ Frontend │ ◄─────────────── │   Backend    │                 │
│  │  :80     │ /topic/telemetry/{id} │ :8080    │                 │
│  │  nginx   │                  │ Spring Boot  │                 │
│  └────┬─────┘  REST /api/...   └──────┬───────┘                 │
│       │        ────────────────►      │ JPA                     │
│       │ HLS /hls/               ┌─────▼────────┐                │
│       │ ◄──────────────────     │  PostgreSQL  │                │
│       │                  │      │    :5432     │                │
│       │            ┌─────┴────┐ └──────────────┘                │
│       │            │ MediaMTX │                                  │
│       │            │  :8554   │ ← RTSP ingest (drone / FFmpeg)  │
│       └────────────│  :8888   │ HLS output                      │
│                    └──────────┘                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Data flow:**
1. `TelemetrySimulator` fires every 500 ms (`@Scheduled`)
2. Publishes per-drone `TelemetryDTO` to `/topic/telemetry/{droneId}` and fleet-lite snapshots to `/topic/telemetry/lite/fleet`
3. Persists each tick as a batch to PostgreSQL via `TelemetryService.persistBatch(...)`
4. Frontend bootstrap loads bulk last-known positions once via REST, then applies STOMP deltas for selected drone + fleet summary

---

## Telemetry Data Model

The full telemetry stream shares the same field set recursively down the stack. The "lite" stream (used during Free Mode) omits `speed` and `battery`.

| Field            | Type      | Notes                                              |
|------------------|-----------|----------------------------------------------------|
| `latitude`       | Double    | Decimal degrees                                    |
| `longitude`      | Double    | Decimal degrees                                    |
| `altitude`       | Double    | Meters ASL                                         |
| `speed`          | Double    | km/h                                               |
| `battery`        | Double    | Percentage (0–100)                                 |
| `heading`        | Double    | Degrees, 0–360 clockwise from N                    |
| `timestamp`      | Instant   | ISO-8601 UTC                                       |
| `roll`           | Double    | Degrees; negative = left bank. Null in lite stream |
| `pitch`          | Double    | Degrees; negative = nose down. Null in lite stream |
| `hdop`           | Double    | Horizontal dilution of precision                   |
| `satelliteCount` | Integer   | GPS satellite count                                |
| `fixType`        | Integer   | 0=no fix, 2=2D, 3=3D, 4=DGPS, 5=RTK float, 6=RTK fixed |
| `rssi`           | Integer   | RF link quality 0–100 %                            |
| `isArmed`        | Boolean   | MAVLink arm state                                  |
| `flightMode`     | String    | e.g. "LOITER", "AUTO", "RTL"                       |

Extended fields (`roll`–`flightMode`) are null in the lite fleet stream and when source is the simulator before a specific drone tick populates them.

---

## Key Interfaces

| Purpose                  | Value                                          |
|--------------------------|------------------------------------------------|
| Login                    | `POST /api/auth/login`                         |
| Logout                   | `POST /api/auth/logout`                        |
| WS connect               | `/ws-skytrack` (SockJS)                        |
| STOMP selected stream    | `/topic/telemetry/{droneId}`                   |
| STOMP fleet lite stream  | `/topic/telemetry/lite/fleet`                  |
| REST history             | `GET /api/telemetry/history`                   |
| REST bulk last-known     | `POST /api/telemetry/last-known`               |
| REST stream URL          | `GET /api/drones/{droneId}/stream`             |
| **C2 command**           | `POST /api/drones/{droneId}/command` — body: `{ commandType: "RTH" \| "ARM" \| "DISARM" }` |
| MAVLink ingest (UDP)     | `udp://localhost:14550` — drone or SITL targets this |
| RTSP ingest (MediaMTX)   | `rtsp://localhost:8554/{droneId}` (push)       |
| HLS output (MediaMTX)    | `http://localhost:8888/{droneId}/index.m3u8`   |

---

## Authentication

All endpoints except `POST /api/auth/login` require a JWT in the `Authorization: Bearer <token>` header. The WebSocket endpoint (`/ws-skytrack/**`) is HTTP-permit but requires the JWT in the STOMP `CONNECT` frame header instead (browsers cannot set headers on WebSocket upgrades).

**No sign-up.** Users are added by one of two methods:

- **Development** — set `DEV_SEED_USER` and `DEV_SEED_PASSWORD` in `.env`. `DevDataInitializer` creates the operator automatically on startup (idempotent). `.env.example` ships with `admin` / `sherlock`.
- **Production** — insert directly into the `operators` table with a BCrypt cost-12 hash:

```sql
INSERT INTO operators (id, username, password_hash, is_enabled, failed_attempts, created_at)
VALUES (gen_random_uuid(), 'operator1', '$2a$12$<bcrypt-hash>', true, 0, now());
```
Generate a BCrypt cost-12 hash with `new BCryptPasswordEncoder(12).encode("password")`.

**Defense controls in place:**
- BCrypt cost factor 12
- Account lockout: 5 consecutive failures → 30-minute lock
- Timing-attack resistance: dummy hash check for unknown usernames
- Every attempt (success and failure) persisted to `auth_audit_log`
- Logout blacklists the JWT ID in `token_blacklist`; blacklist is purged nightly at 03:00
- Generic error messages: "Authentication failed" — no username enumeration

**JWT configuration** (environment variables):

| Variable               | Default | Notes                                              |
|------------------------|---------|----------------------------------------------------|
| `JWT_SECRET`           | dev key | **Must be overridden in production.** `openssl rand -base64 64` |
| `JWT_EXPIRATION_HOURS` | `8`     | One operator shift                                 |

---

## Conventions — Apply Everywhere

- **One styling method:** Tailwind CSS only. No inline styles except where Tailwind cannot reach (e.g. Cesium canvas dimensions).
- **No rounded corners** anywhere in the UI. This is a military dashboard.
- **Font:** JetBrains Mono throughout. Never switch to a sans-serif.
- **Color tokens** — always use the defined names, never raw hex in JSX:
  - `neon` (`#00FF41`) — data, indicators, live state
  - `caution` (`#FFB400`) — warnings, low battery
  - `danger` (`#FF3B30`) — critical alerts, signal loss
  - `surface` / `panel` / `elevated` / `line` / `muted` — backgrounds and borders
- **No new dependencies** without a clear reason. The stack is intentionally minimal.
- **Do not add speculative features.** Implement exactly what is asked.

---

## SOLID Principles — Mandatory

Every class, service, hook, and component you write or modify **must** comply with all five principles. Violations are not acceptable.

### S — Single Responsibility
- One class / component / hook does **one thing** and owns one reason to change.
- Backend: `Controller` routes only, `Service` orchestrates only, `Repository` persists only. Never mix layers.
- Frontend: UI components render only. Data-fetching and business logic live in custom hooks or services — never inside JSX.
- If a file exceeds ~150 lines, treat that as a signal it is doing too much and split it.

### O — Open / Closed
- Extend behaviour through new classes, hooks, or strategy objects. **Do not edit working code** to add a new variant — add alongside it.
- Backend: prefer new `@Service` implementations over `if/else` chains inside existing services.
- Frontend: prefer new components / render-prop patterns over growing one component with flags.

### L — Liskov Substitution
- Every subclass / implementing class must be usable wherever its parent / interface is expected without breaking callers.
- Backend: do not override methods in a way that narrows contracts or throws unexpected exceptions.
- Frontend: a component that accepts a prop interface must honour the full interface — no silent no-ops for props the component "doesn't need."

### I — Interface Segregation
- Callers must not depend on methods they do not use.
- Backend: define narrow `@Repository` or service interfaces; avoid single fat interfaces with unrelated methods.
- Frontend: define narrow TypeScript `interface`s per component. Never pass the entire telemetry object when only `altitude` is needed.

### D — Dependency Inversion
- High-level modules depend on abstractions, not concretions.
- Backend: inject interfaces via Spring constructor injection (`@RequiredArgsConstructor`). Never `new` a concrete service inside another service.
- Frontend: inject dependencies (API clients, WebSocket providers) via React Context or props — never import singletons directly inside components.

---

## Clean Code Rules — Mandatory

These rules apply to every line of code written or modified in this project.

### Naming
- Names must reveal intent. `telemetryTimestamp` not `ts`, `fetchHistory` not `getData`.
- Boolean variables/props use `is` / `has` / `can` prefix: `isConnected`, `hasFix`, `canRetry`.
- Avoid abbreviations unless they are universally understood acronyms (`dto`, `id`, `url`).

### Functions & Methods
- **Do one thing.** A function that needs a comment explaining its second responsibility must be split.
- Maximum **3 parameters**. If more are needed, group into a typed object / DTO.
- No boolean trap parameters (`doThing(true, false)`). Use named options objects instead.
- No side effects in functions whose names imply a query (e.g. `getAltitude()` must not write state).

### Comments
- Do **not** write comments that paraphrase the code (`// increment counter`).
- Write comments only to explain *why*, never *what*. Complex domain decisions (e.g. coordinate frame, clamping logic) warrant a comment.
- Outdated or misleading comments are worse than none — delete them.

### Error Handling
- Never swallow exceptions silently. Log with context and re-throw or convert to a typed error response.
- Backend: use `@ControllerAdvice` for global exception handling. Do not `try/catch` inside controllers just to return `null`.
- Frontend: every async call must handle the error path and surface it to the user via the appropriate UI token (`danger`).

### No Magic Numbers / Strings
- Extract all literals into named constants. `TELEMETRY_INTERVAL_MS = 500` not `500` scattered across files.

### Dead Code
- Delete unused variables, imports, methods, and commented-out blocks immediately. Do not leave them "just in case."

### Small Files, Small Units
- Files: prefer under 200 lines. Hard limit 400 lines — split before exceeding.
- React components: prefer under 100 lines of JSX. Extract sub-components aggressively.
- Java methods: prefer under 20 lines. Hard limit 40 lines — extract private helpers.

### UPDATING AGENTS.md files and docs/index.html — MANDATORY FINAL STEP
The primary failure mode of AI assistants on this project is forgetting to synchronize the documentation with their code changes. To strictly guarantee compliance, YOU MUST adhere to this workflow:
1. **Never conclude a task** without verifying if your architectural, interface, file layout, or logic changes require updates to `AGENTS.md`, `backend/AGENTS.md`, `frontend/AGENTS.md`, or `docs/index.html`.
2. **If you update systems described in the AGENTS files**, you MUST edit the relevant `AGENTS.md` files using your file editing tools BEFORE telling the user you are finished.
3. **MANDATORY TEXT CHECK:** The final sentence of your message upon completing a user's task MUST BE exactly one of the following:
   - *"Documentation Check: I have updated [File Name] to reflect these changes."*
   - *"Documentation Check: No structural changes were made; AGENTS.md remains accurate."*
If you skip this step, you have failed the task natively.
---

## Running Locally

```bash
# Full stack via Docker — pick a profile:
cp .env.example .env

docker compose --profile dev up --build   # Vite dev server + HMR on :5173
docker compose --profile prod up --build  # nginx static build on :80

# Individual services — see sub-AGENTS.md files
```

---

## Where to Go Next

| Your duty                            | Read                         |
|--------------------------------------|------------------------------|
| Java / Spring Boot / database work   | `backend/AGENTS.md`          |
| React / UI / CesiumJS / Tailwind     | `frontend/AGENTS.md`         |
| Both                                 | Read both sub-files          |
