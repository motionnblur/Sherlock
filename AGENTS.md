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
- **Clean Code / SOLID:** single responsibility per class/component, no god objects.
- **Do not add speculative features.** Implement exactly what is asked.

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
