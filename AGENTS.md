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

---

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Docker Network                     │
│                                                     │
│  ┌──────────┐     STOMP/WS      ┌──────────────┐   │
│  │ Frontend │ ◄──────────────── │   Backend    │   │
│  │  :80     │  /topic/telemetry │   :8080      │   │
│  │  nginx   │                   │ Spring Boot  │   │
│  └──────────┘  REST /api/...    └──────┬───────┘   │
│                ────────────────►       │ JPA        │
│                                 ┌──────▼───────┐   │
│                                 │  PostgreSQL  │   │
│                                 │    :5432     │   │
│                                 └──────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Data flow:**
1. `TelemetrySimulator` fires every 500 ms (`@Scheduled`)
2. Publishes `TelemetryDTO` to `/topic/telemetry` via `SimpMessagingTemplate`
3. Persists the same DTO to PostgreSQL via `TelemetryService`
4. Frontend STOMP client receives the message → updates React state → re-renders map + panels

---

## Telemetry Data Model

The full telemetry stream shares the same field set recursively down the stack. The "lite" stream (used during Free Mode) omits `speed` and `battery`.

| Field       | Type      | Notes                         |
|-------------|-----------|-------------------------------|
| `latitude`  | Double    | Decimal degrees               |
| `longitude` | Double    | Decimal degrees               |
| `altitude`  | Double    | Meters ASL                    |
| `speed`     | Double    | km/h                          |
| `battery`   | Double    | Percentage (0–100)            |
| `heading`   | Double    | Degrees, 0–360 clockwise from N |
| `timestamp` | Instant   | ISO-8601 UTC                  |

---

## Key Interfaces

| Purpose             | Value                           |
|---------------------|---------------------------------|
| WS connect          | `/ws-skytrack` (SockJS)         |
| STOMP subscribe     | `/topic/telemetry`              |
| STOMP lite stream   | `/topic/telemetry/lite`         |
| REST history        | `GET /api/telemetry/history`    |

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

---

## Running Locally

```bash
# Full stack via Docker
cp .env.example .env
docker compose up --build

# Individual services — see sub-AGENTS.md files
```

---

## Where to Go Next

| Your duty                            | Read                         |
|--------------------------------------|------------------------------|
| Java / Spring Boot / database work   | `backend/AGENTS.md`          |
| React / UI / CesiumJS / Tailwind     | `frontend/AGENTS.md`         |
| Both                                 | Read both sub-files          |
