# SHERLOCK GCS — SKYTRACK Ground Control Station

## ⚠️ Vibe Coding Warning
> **Warning:** This application was developed using **vibe coding** (AI-assisted generation). Please tread carefully and review the codebase thoroughly before attempting any production deployment or relying on it for critical tasks.

A defense-grade real-time UAV ground control station that visualizes live telemetry on a 3D globe. Built as a full-stack demonstration of WebSocket-driven telemetry streaming.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ▌▌▌ SHERLOCK GCS          ◈ TRAINING MODE ◈         UTC 14:23:45  ● OK  │
├──────────────┬───────────────────────────────────────────┬───────────────┤
│ ◈ TELEMETRY  │                                           │ ◈ SYSTEM      │
│              │         CesiumJS 3D Globe                 │               │
│ LAT  37.98°N │                                           │ MISSION CLOCK │
│ LON  23.72°E │        [UAV moving in real-time]          │  00:04:23     │
│ ALT  1,523 m │                                           │               │
│ SPD  124 km/h│                 ◆ SHERLOCK-01             │ HEADING 045°  │
│ HDG  045°    │              ~~flight path trail~~         │ NE            │
│ BAT  ▓▓▓░░69%│                                           │               │
│              │                                           │ FLIGHT LOG    │
└──────────────┴───────────────────────────────────────────┴───────────────┘
│ MISSION ● ACTIVE │ SHERLOCK-01 │ 37.9838°N, 23.7275°E │ SKYTRACK v1.0  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer          | Technology                                          |
|----------------|-----------------------------------------------------|
| Backend        | Spring Boot 3.2, WebSocket (STOMP), Spring Data JPA |
| Frontend       | React 18, Vite, Tailwind CSS, CesiumJS              |
| Database       | PostgreSQL 16                                       |
| Infrastructure | Docker, Docker Compose (multi-stage builds)         |

---

## Project Structure

```
Sherlock/
├── backend/
│   ├── src/main/java/com/sherlock/groundcontrol/
│   │   ├── SherlockApplication.java
│   │   ├── config/
│   │   │   ├── WebSocketConfig.java     # STOMP endpoint + broker
│   │   │   └── CorsConfig.java
│   │   ├── controller/
│   │   │   └── TelemetryController.java # GET /api/telemetry/history
│   │   ├── dto/
│   │   │   └── TelemetryDTO.java
│   │   ├── entity/
│   │   │   └── TelemetryEntity.java
│   │   ├── repository/
│   │   │   └── TelemetryRepository.java
│   │   └── service/
│   │       ├── TelemetryService.java    # Persistence logic
│   │       └── TelemetrySimulator.java  # @Scheduled 500ms broadcast
│   ├── Dockerfile                       # Multi-stage JRE image
│   └── pom.xml
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.jsx               # Branding + UTC clock + link status
│   │   │   ├── MapComponent.jsx         # CesiumJS 3D globe + drone entity
│   │   │   ├── TelemetryPanel.jsx       # Left panel: coordinates, speed, battery
│   │   │   ├── SystemPanel.jsx          # Right panel: compass, mission clock, log
│   │   │   └── StatusBar.jsx            # Bottom: alerts, status summary
│   │   ├── hooks/
│   │   │   └── useTelemetry.js          # STOMP client + state management
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── nginx.conf                       # Proxy: /api + /ws-skytrack → backend
│   ├── Dockerfile                       # Multi-stage node→nginx image
│   └── package.json
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Quick Start

### Option A — Docker Compose (recommended)

```bash
# 1. Clone and enter
git clone <repo-url> && cd Sherlock

# 2. Configure environment
cp .env.example .env
# Edit .env if you want to change DB credentials or add a Cesium token

# 3. Build and run
docker compose up --build

# 4. Open in browser
open http://localhost
```

The backend starts after PostgreSQL is healthy. Telemetry begins streaming at 2 Hz automatically.

---

### Option B — Local Development

**Prerequisites:** Java 17+, Maven 3.9+, Node.js 20+, PostgreSQL 16

```bash
# 1. Start PostgreSQL
#    Create a database named 'sherlock' with user 'sherlock' / password 'sherlock'

# 2. Backend
cd backend
mvn spring-boot:run

# 3. Frontend (new terminal)
cd frontend
cp .env.example .env     # VITE_WS_URL can stay empty (vite dev proxy handles it)
npm install
npm run dev

# 4. Open http://localhost:5173
```

---

## Configuration

### Environment Variables (`.env`)

| Variable            | Default    | Description                                      |
|---------------------|------------|--------------------------------------------------|
| `DB_NAME`           | `sherlock` | PostgreSQL database name                         |
| `DB_USER`           | `sherlock` | PostgreSQL username                              |
| `DB_PASSWORD`       | `sherlock` | PostgreSQL password                              |
| `VITE_CESIUM_TOKEN` | _(empty)_  | Cesium Ion token — optional (see note below)     |
| `VITE_WS_URL`       | _(empty)_  | WebSocket URL — leave empty for nginx proxy mode |

### Cesium Ion Token (optional)

Without a token, the globe uses **OpenStreetMap** imagery and is fully functional.  
A free Cesium Ion token unlocks **World Terrain** (3D elevation) and **premium imagery**:

1. Register at [ion.cesium.com](https://ion.cesium.com)
2. Copy your default access token
3. Add it to `.env`: `VITE_CESIUM_TOKEN=your_token_here`

---

## Architecture

### WebSocket / STOMP Flow

```
TelemetrySimulator (@Scheduled 500ms)
    │
    ├── SimpMessagingTemplate.convertAndSend("/topic/telemetry", dto)
    │       └── Frontend STOMP client receives → updates React state → re-renders
    │
    └── TelemetryService.persist(dto)
            └── PostgreSQL (every data point saved)
```

### STOMP Endpoints

| Endpoint            | Type           | Description                              |
|---------------------|----------------|------------------------------------------|
| `/ws-skytrack`      | SockJS connect | WebSocket handshake (with SockJS fallback)|
| `/topic/telemetry`  | Subscribe      | Live telemetry stream (2 Hz)             |

### REST Endpoints

| Method | Path                       | Description                      |
|--------|----------------------------|----------------------------------|
| GET    | `/api/telemetry/history`   | Last 100 telemetry records (DESC)|

---

## Telemetry Data Model

```json
{
  "latitude":  37.983842,
  "longitude": 23.727512,
  "altitude":  1523.4,
  "speed":     124.1,
  "battery":   68.75,
  "heading":   45.2,
  "timestamp": "2024-03-01T14:23:45.123Z"
}
```

The simulator generates physically plausible movement:
- **Position**: computed from heading + speed using great-circle approximation
- **Altitude**: oscillates 800–3500 m
- **Speed**: perturbates around 120 km/h cruise (85–195 km/h range)
- **Battery**: drains ~3%/min (realistic 30-min endurance demo)
- **Heading**: drifts ±3°/tick to simulate waypoint navigation

---

## UI Design System

| Token       | Value     | Usage                          |
|-------------|-----------|--------------------------------|
| `neon`      | `#00FF41` | Data, indicators, map elements |
| `caution`   | `#FFB400` | Warnings, low battery          |
| `danger`    | `#FF3B30` | Critical alerts, signal loss   |
| `surface`   | `#050505` | Main background                |
| `panel`     | `#0d1117` | Panel backgrounds              |
| `elevated`  | `#161b22` | Elevated surfaces              |
| `line`      | `#1e2a3a` | Borders and dividers           |
| Font        | JetBrains Mono | All text (monospace)      |

---

## Adding a Custom Drone 3D Model

Replace the SVG icon in `MapComponent.jsx` with a `.glb` model:

```js
billboard: undefined,
model: {
  uri:   '/models/drone.glb',
  scale: 50,
  minimumPixelSize: 32,
},
```

Place your `.glb` file in `frontend/public/models/`.

---

## Screenshots
<img width="322" height="343" alt="Screenshot from 2026-04-16 01-56-29" src="https://github.com/user-attachments/assets/30cc050d-6607-4f83-ae97-9b46712133ff" />
<img width="1410" height="746" alt="show" src="https://github.com/user-attachments/assets/130cd3bf-6d84-4623-8e94-2c5c9095f2f5" />
<img width="1915" height="921" alt="Screenshot from 2026-04-16 02-01-59" src="https://github.com/user-attachments/assets/94346cab-5119-4e28-9104-8b3bb6ed5b18" />
<img width="755" height="657" alt="show-all" src="https://github.com/user-attachments/assets/02963273-4d2a-4b99-9a9a-bc09eb7e3de4" />
<img width="1030" height="723" alt="show all 2" src="https://github.com/user-attachments/assets/ecf3cdfc-b46b-4fe0-81b4-6ce451ebdc11" />
<img width="1664" height="851" alt="Geofence" src="https://github.com/user-attachments/assets/babce6ec-c3e5-4549-b20f-3cf3d59e888f" />
<img width="1662" height="850" alt="mission plan" src="https://github.com/user-attachments/assets/d8cf116e-d508-47a4-b459-e0bc778faeab" />
<img width="1509" height="849" alt="mission" src="https://github.com/user-attachments/assets/df5e8e2d-c20d-42a9-a652-2c9e253ac93f" />
<img width="1184" height="797" alt="mission2" src="https://github.com/user-attachments/assets/a26d0f35-431a-4be2-9a58-ec32dd950d13" />

## License

MIT
