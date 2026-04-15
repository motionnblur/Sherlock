# AGENTS.md — Backend

> Prerequisite: read `../AGENTS.md` first.

---

## Stack

| Component     | Version / Library              |
|---------------|--------------------------------|
| Language      | Java 17                        |
| Framework     | Spring Boot 3.2                |
| WebSocket     | Spring WebSocket (STOMP)       |
| Persistence   | Spring Data JPA + Hibernate    |
| Database      | PostgreSQL 16                  |
| Utilities     | Lombok                         |
| Build         | Maven 3.9 (multi-stage Docker) |

---

## Package Structure

```
com.sherlock.groundcontrol
├── SherlockApplication.java        # @SpringBootApplication + @EnableScheduling
├── config/
│   ├── PasswordEncoderConfig.java  # BCryptPasswordEncoder(12) bean — isolated to avoid circular dep
│   ├── SecurityConfig.java         # Spring Security filter chain, CORS, JWT gate
│   └── WebSocketConfig.java        # STOMP broker, /ws-skytrack endpoint, channel interceptor
├── controller/
│   ├── AuthController.java         # POST /api/auth/login, POST /api/auth/logout
│   ├── GeofenceController.java    # CRUD + activate/deactivate /api/geofences
│   ├── DroneCommandController.java # POST /api/drones/{droneId}/command + GET /api/drones/{droneId}/commands
│   ├── GlobalExceptionHandler.java # @RestControllerAdvice — auth + generic errors
│   ├── MissionController.java      # CRUD + execute/abort — POST/GET/PUT/DELETE /api/missions, /execute, /abort
│   ├── TelemetryController.java    # REST: GET /api/telemetry/history (latest or ranged) + POST /api/telemetry/last-known
│   └── DroneStreamController.java  # REST: GET /api/drones/{droneId}/stream
├── dto/
│   ├── CommandHistoryResponseDTO.java # Wire: { commands: CommandLifecycleDTO[] }
│   ├── CommandLifecycleDTO.java    # Wire: { commandId, droneId, commandType, status, requestedAt, updatedAt, detail? }
│   ├── BulkLastKnownRequestDTO.java   # Wire object: { droneIds: string[] }
│   ├── BulkLastKnownResponseDTO.java  # Wire object: { telemetry: LastKnownTelemetryDTO[] }
│   ├── GeofenceAlertDTO.java         # Wire object: { droneId, geofenceId, geofenceName, eventType, lat/lon/altitude, timestamp }
│   ├── GeofenceDTO.java              # Wire object: { id, name, isActive, createdAt, points[] }
│   ├── GeofencePointDTO.java         # Wire object: { sequence, latitude, longitude }
│   ├── GeofenceRequestDTO.java       # Wire object: { name, isActive?, points[] }
│   ├── CreateMissionDTO.java          # Wire: { name, waypoints[] }
│   ├── DroneCommandDTO.java           # Wire: { commandType: RTH|ARM|DISARM|TAKEOFF|GOTO, latitude?, longitude?, altitude? }
│   ├── LastKnownTelemetryDTO.java     # Compact last-known payload used by bulk bootstrap
│   ├── LoginRequestDTO.java        # Wire: { username, password }
│   ├── LoginResponseDTO.java       # Wire: { token, username, expiresAt }
│   ├── BatteryAlertDTO.java        # Wire object: { droneId, battery } — emitted on threshold crossing
│   ├── MissionDTO.java             # Wire: full mission + waypoints; used for REST responses and STOMP progress
│   ├── TelemetryDTO.java           # Wire object (no JPA annotations); includes extended fields
│   ├── TelemetryLiteDTO.java       # Minimal wire object for Free Mode (no extended fields)
│   ├── WaypointDTO.java            # Wire: { id?, sequence, latitude, longitude, altitude, label?, status? }
│   └── StreamUrlDTO.java           # Wire object: { streamUrl } for live video
├── entity/
│   ├── AuthAuditLogEntity.java     # @Entity — append-only auth attempt log
│   ├── GeofenceEntity.java        # @Entity — geofences table; active flag + ordered polygon points
│   ├── GeofencePointEntity.java   # @Entity — geofence_points table; FK → geofences
│   ├── MissionEntity.java          # @Entity — missions table; status: PLANNED|ACTIVE|COMPLETED|ABORTED
│   ├── OperatorEntity.java         # @Entity — operator accounts (no sign-up; DB-managed)
│   ├── TelemetryEntity.java        # @Entity mapped to `telemetry` table (includes extended fields)
│   ├── TokenBlacklistEntity.java   # @Entity — revoked JWT IDs (JTI)
│   └── WaypointEntity.java         # @Entity — mission_waypoints table; FK → missions; status: PENDING|ACTIVE|REACHED|SKIPPED
├── exception/
│   ├── AccountLockedException.java
│   ├── AuthenticationFailedException.java
│   ├── GeofenceConflictException.java
│   ├── GeofenceNotFoundException.java
│   ├── GeofenceValidationException.java
│   └── TelemetryHistoryValidationException.java
├── mavlink/                        # Raw MAVLink parsing — no external library
│   ├── DroneSnapshot.java          # Mutable merged state per MAVLink system ID
│   ├── MavlinkFrame.java           # Parsed frame record (v1 or v2)
│   ├── MavlinkFrameParser.java     # Parse UDP datagrams → MavlinkFrame; build COMMAND_LONG
│   └── MavlinkMessageDecoder.java  # Decode telemetry + COMMAND_ACK payloads into typed result records
├── repository/
│   ├── AuthAuditLogRepository.java
│   ├── GeofenceRepository.java
│   ├── MissionRepository.java      # findAllByOrderByCreatedAtDesc(), findByStatus()
│   ├── OperatorRepository.java
│   ├── TelemetryRepository.java    # JpaRepository, custom finder
│   └── TokenBlacklistRepository.java
├── security/
│   ├── JwtAuthenticationFilter.java        # OncePerRequestFilter — validates Bearer token
│   ├── JwtTokenProvider.java               # Token generation/validation (HS512)
│   ├── OperatorUserDetails.java            # UserDetails adapter for OperatorEntity
│   ├── OperatorUserDetailsService.java     # UserDetailsService implementation
│   └── WebSocketAuthChannelInterceptor.java # Validates JWT on STOMP CONNECT frame
└── service/
    ├── AuthAuditService.java        # Persists every login attempt to auth_audit_log
    ├── AuthService.java             # authenticate(), logout(), lockout, blacklist purge
    ├── CommandLifecycleService.java # In-memory command lifecycle (PENDING→...); timeout scan + /topic/commands publish
    ├── DevDataInitializer.java      # ApplicationRunner — creates seed operator when DEV_SEED_USER/DEV_SEED_PASSWORD are set
    ├── DroneCommandService.java     # Translates RTH/ARM/DISARM/TAKEOFF/GOTO → MAVLink command packets via MavlinkAdapterService (@ConditionalOnProperty)
    ├── DroneStreamService.java      # Resolves HLS stream URL from MEDIAMTX_HLS_BASE_URL
    ├── GeofenceBreachService.java    # Active polygon evaluation + transition alerts to /topic/alerts/geofence
    ├── GeofenceGeometry.java        # Polygon validation + point-in-polygon helpers (border counts as inside)
    ├── GeofenceService.java         # Geofence CRUD, active-cache maintenance, topology change publication
    ├── GeofenceTopologyChangedEvent.java # Internal event used to clear breach state when fences change
    ├── MavlinkAdapterService.java   # UDP :14550 listener + snapshot merge + @Scheduled STOMP publish (@ConditionalOnProperty)
    ├── MissionExecutorService.java  # Server-side mission execution: finite-state waypoint progression, guarded arrival confirmation, timeout/retry fail-safe, STOMP progress publish
    ├── MissionService.java          # Mission CRUD + lifecycle transitions (PLANNED→ACTIVE→COMPLETED|ABORTED); no execution logic
    ├── OperatorCommandService.java  # Operator command orchestration + lifecycle tracking + simulator fake ACK path
    ├── TelemetryService.java        # persistBatch() + getLastKnown(droneId) + recent/ranged history lookup + bounded last-known cache
    └── TelemetrySimulator.java      # @Scheduled 500ms fleet tick, per-drone full stream + fleet-lite summary + battery/geofence alerts
```

**Rule:** never let a layer reach past its neighbour.  
Controllers call Services. Services call Repositories. Nothing else crosses those lines.

---

## Configuration

`src/main/resources/application.yml` reads from environment variables with fallbacks:

```yaml
spring.datasource.url: jdbc:postgresql://${DB_HOST:localhost}:${DB_PORT:5432}/${DB_NAME:sherlock}
spring.datasource.username: ${DB_USER:sherlock}
spring.datasource.password: ${DB_PASSWORD:sherlock}
spring.jpa.hibernate.ddl-auto: update   # schema auto-managed in dev

app.jwt.secret: ${JWT_SECRET:<dev-default>}   # MUST be overridden in production
app.jwt.expiration-hours: ${JWT_EXPIRATION_HOURS:8}
app.simulator.fleet-size: ${SIMULATOR_FLEET_SIZE:5}
app.telemetry.last-known-cache-size: ${TELEMETRY_LAST_KNOWN_CACHE_SIZE:10000}
app.command.lifecycle.per-drone-limit: ${COMMAND_HISTORY_PER_DRONE_LIMIT:20}
app.command.lifecycle.ack-timeout-ms: ${COMMAND_ACK_TIMEOUT_MS:5000}
```

| Environment Variable       | Default                    | Purpose                                       |
|----------------------------|----------------------------|-----------------------------------------------|
| `JWT_SECRET`               | dev fallback               | Base64-encoded 512-bit HMAC key. **Override in production:** `openssl rand -base64 64` |
| `JWT_EXPIRATION_HOURS`     | `8`                        | Token lifetime in hours (one operator shift)  |
| `DEV_SEED_USER`            | _(empty)_                  | If non-empty, `DevDataInitializer` creates this operator on startup (idempotent). **Leave unset in production.** |
| `DEV_SEED_PASSWORD`        | _(empty)_                  | Plaintext password for the seed operator — BCrypt-12 hash computed at startup. **Leave unset in production.** |
| `SIMULATOR_FLEET_SIZE`     | `5`                        | Number of simulated drones generated by `TelemetrySimulator` |
| `TELEMETRY_LAST_KNOWN_CACHE_SIZE` | `10000`            | Bounded in-memory cache size for bulk last-known lookups |
| `MEDIAMTX_HLS_BASE_URL`    | `http://localhost:8888`    | Base URL of MediaMTX HLS output as seen by the **browser**. In Docker use `/hls` (nginx proxies it). In local dev the default hits MediaMTX directly. |
| `MAVLINK_ENABLED`          | `false`                    | Set `true` to activate `MavlinkAdapterService` and `DroneCommandService`. Simulator continues running in parallel. |
| `MAVLINK_UDP_PORT`         | `14550`                    | UDP port the MAVLink adapter listens on. Drone / SITL must target `<host>:14550`. |
| `COMMAND_HISTORY_PER_DRONE_LIMIT` | `20`               | In-memory command lifecycle history depth per drone (used by `GET /api/drones/{id}/commands`). |
| `COMMAND_ACK_TIMEOUT_MS`   | `5000`                     | Time budget for command ACK tracking before status becomes `TIMEOUT`. |

For Docker, these are injected by `docker-compose.yml`. For local dev, the defaults work against a local PostgreSQL instance with user/db `sherlock`.

---

## WebSocket / STOMP Setup

`WebSocketConfig` registers:
- **Endpoint:** `/ws-skytrack` — SockJS enabled, `allowedOriginPatterns("*")`
- **Broker prefix:** `/topic`
- **App prefix:** `/app` (for client-to-server messages, not currently used)

To broadcast from any Spring bean:
```java
messagingTemplate.convertAndSend("/topic/telemetry/" + droneId, payloadObject);
messagingTemplate.convertAndSend("/topic/telemetry/lite/fleet", fleetLiteList);
messagingTemplate.convertAndSend("/topic/alerts/geofence", geofenceAlertObject);
```
Spring serialises the object to JSON automatically via Jackson.

---

## TelemetrySimulator — How It Works

`@Scheduled(fixedRate = 500)` calls `broadcastTelemetry()` every 500 ms.

The simulator maintains an in-memory fleet (default 5,000 drones), updates each drone state per tick, and then:
1. broadcasts full telemetry per drone to `/topic/telemetry/{droneId}`
2. broadcasts one fleet-lite list to `/topic/telemetry/lite/fleet`
3. persists the entire tick with one `TelemetryService.persistBatch(...)` call
4. evaluates each tick against active geofences and emits `/topic/alerts/geofence` only on inside/outside transitions

**Do not add `@Async` or additional threads** to this simulator without understanding the state mutation model.

---

## Adding a New Field to Telemetry

Follow this checklist in order:

1. **`TelemetryEntity.java`** — add `@Column` field
2. **`TelemetryDTO.java`** — add matching field (Lombok handles getters/setters)
3. **`TelemetrySimulator.java`** — compute and set the new value in `updateState()`
4. **`TelemetryService.java`** — map the field in both `persist()` and `toDTO()`
5. **Frontend** — update `TelemetryPanel.jsx` or `SystemPanel.jsx` to display it

`ddl-auto: update` will add the new column automatically on restart. For production, use a migration tool (Flyway/Liquibase).

---

## MAVLink Adapter — How It Works

`MavlinkAdapterService` is activated only when `app.mavlink.enabled=true`. It coexists with `TelemetrySimulator` — simulated drones use IDs `SHERLOCK-XX`, real MAVLink drones use `MAVLINK-XX`.

### Inbound pipeline

```
Drone / SITL ──UDP:14550──► MavlinkAdapterService.listenLoop()
                                   │
                                   ▼
                          MavlinkFrameParser.parsePacket()   ← v1 (0xFE) or v2 (0xFD)
                                   │
                                   ▼
                          MavlinkMessageDecoder.decode*()    ← 6 message types
                                   │
                                   ▼
                          DroneSnapshot (per sysId)          ← merged mutable state
                                   │
                    @Scheduled 500ms
                                   ▼
                          TelemetryDTO ──STOMP──► /topic/telemetry/MAVLINK-{sysId}
                                      ──persist──► PostgreSQL
```

Decoded message types: `HEARTBEAT` (arm/mode), `SYS_STATUS` (battery), `GPS_RAW_INT` (fix/HDOP/sats), `ATTITUDE` (roll/pitch), `GLOBAL_POSITION_INT` (position/speed/heading), `RADIO_STATUS` (RSSI), `COMMAND_ACK` (command lifecycle updates).

### Outbound C2

```
POST /api/drones/MAVLINK-01/command  { commandType: "GOTO", latitude: -35.3632, longitude: 149.1653, altitude: 584.0 }
        │
        ▼
DroneCommandController → OperatorCommandService.submitCommand() → DroneCommandService.sendCommand()
        │
        ▼
MavlinkFrameParser.buildCommandLong()   ← MAVLink v1 COMMAND_LONG (id=76)
        │
        ▼
MavlinkAdapterService.sendPacket()      ← UDP back to drone's source address
```

`POST /api/drones/{droneId}/command` response semantics (body is always `CommandLifecycleDTO` for valid payloads):
- `202 Accepted` when command lifecycle tracking starts (`PENDING → SENT` and then `ACKED`/`REJECTED`/`TIMEOUT`)
- `400 Bad Request` when payload is invalid (for example `GOTO` without latitude/longitude/altitude)
- `409 Conflict` when `TAKEOFF` or `GOTO` is requested before navigation readiness (lifecycle final status `FAILED`)
- `422 Unprocessable Entity` when the MAVLink drone is not currently connected/commandable (lifecycle final status `FAILED`)
- `503 Service Unavailable` when MAVLink integration is disabled and target is not a simulator drone (lifecycle final status `FAILED`)

Lifecycle retrieval and live updates:
- `GET /api/drones/{droneId}/commands?limit=20` returns the latest in-memory lifecycle entries
- STOMP `/topic/commands/{droneId}` publishes every lifecycle transition
- Simulator drones (`SHERLOCK-*`) emit immediate fake ACK transitions for operator commands

**Supported commands:**

| CommandType | MAV_CMD | Notes |
|-------------|---------|-------|
| `RTH`       | 20 — NAV_RETURN_TO_LAUNCH | No parameters required |
| `ARM`       | 400 — COMPONENT_ARM_DISARM | param1=1, param2=21196 (force) |
| `DISARM`    | 400 — COMPONENT_ARM_DISARM | param1=0 |
| `TAKEOFF`   | 176 + 400 + 22 sequence | Sends GUIDED mode, force-arm, then NAV_TAKEOFF to 20m with bounded retries; returns HTTP 409 if EKF/GPS/home is not ready yet |
| `GOTO`      | 176 + 86 sequence | Ensures GUIDED mode, converts requested AMSL altitude to relative-home altitude using live `GLOBAL_POSITION_INT` (`alt` + `relative_alt`), then sends SET_POSITION_TARGET_GLOBAL_INT (GLOBAL_RELATIVE_ALT_INT) |

### Testing with SITL

```bash
# ArduCopter SITL — outputs MAVLink on UDP:14550 by default
sim_vehicle.py -v ArduCopter --out=udp:127.0.0.1:14550

# Then set MAVLINK_ENABLED=true and start the backend
```

Docker alternative (when using repository `docker-compose.yml`):
```bash
# 1) Ensure .env has:
# MAVLINK_ENABLED=true
# ARDUPILOT_REPO=/absolute/path/to/ardupilot
#
# 2) Start dev stack + SITL profile together
docker compose --profile dev --profile sitl up --build
```

`sitl` service details:
- Uses image `ardupilot/ardupilot-dev-chibios:latest`
- Runs `/ardupilot/Tools/autotest/sim_vehicle.py`
- Auto-initializes ArduPilot git submodules (`git submodule update --init --recursive`) when `modules/waf/waf-light` is missing
- Auto-installs `pymavlink` and `MAVProxy` on startup if they are not present in the image
- Sends MAVLink to `backend:${MAVLINK_UDP_PORT}` on the shared Docker network

---

## Adding a New REST Endpoint

1. Add a method to `TelemetryRepository` if a new query is needed (Spring Data derived query or `@Query`)
2. Add the business logic to `TelemetryService`
3. Add a `@GetMapping` / `@PostMapping` method to `TelemetryController`

Spring Security already protects all endpoints except documented public routes. Keep new telemetry endpoints authenticated unless there is a documented exception.

### Telemetry history endpoint modes

`GET /api/telemetry/history` supports two modes:

- Latest mode (legacy): `?droneId=SHERLOCK-01` returns latest 150 rows ordered by `timestamp DESC`
- Range mode (flight replay): `?droneId=SHERLOCK-01&start=2026-04-15T08:00:00Z&end=2026-04-15T09:00:00Z` returns rows ordered by `timestamp ASC`

Range mode guard rails enforced by `TelemetryService`:
- `start` and `end` must be provided together
- `start` must be strictly before `end`
- result set is capped at 20,000 rows; larger ranges return `400 Bad Request`

### Mission update endpoint

`PUT /api/missions/{id}` updates an existing mission in-place and is restricted to missions in `PLANNED` state.

- `200 OK` — mission name/waypoints overwritten successfully
- `400 Bad Request` — invalid payload (blank name, <2 waypoints, missing coordinates/altitude, or consecutive waypoints closer than 5 meters)
- `404 Not Found` — mission does not exist
- `409 Conflict` — mission is not `PLANNED`

### Geofence CRUD endpoints

`GeofenceController` owns the polygon management surface:

- `GET /api/geofences` lists all geofences newest-first
- `POST /api/geofences` creates a new fence; request payload requires a name and an ordered point list
- `GET /api/geofences/{id}` returns one fence
- `PUT /api/geofences/{id}` replaces the name, active flag, and polygon in place
- `POST /api/geofences/{id}/activate` and `/deactivate` toggle the active cache entry
- `DELETE /api/geofences/{id}` removes a fence and clears any cached breach state for that id

Validation rules enforced by `GeofenceService`:
- names are required and capped at 100 characters
- polygons need at least 3 points and at most 100 points
- point sequences must start at 0 and remain contiguous after sorting
- latitude and longitude are range-checked
- polygons must be non-self-intersecting and non-zero-area

`GeofenceBreachService` consumes the active-cache snapshot on every telemetry tick and on each MAVLink snapshot merge. It emits enter/exit transitions to `/topic/alerts/geofence`; the first sighting of a drone/fence pair is suppressed so the dashboard only receives real state changes.

### Mission execution safety gates

`MissionExecutorService` does not advance waypoints on a single in-threshold tick. Arrival is confirmed only when all gates pass:
- Telemetry is fresh (bounded age) and newer than the dispatch sample
- A minimum post-dispatch delay has elapsed
- Distance-to-target is within strict thresholds (5 m horizontal, 6 m vertical)
- Movement evidence exists since dispatch (toward-target delta or travel delta), except true close-start cases
- In-threshold condition remains stable for multiple consecutive ticks (dwell-based confirmation)

If progress stalls, the executor uses bounded re-dispatch attempts and aborts the mission via fail-safe when limits are exceeded.

---

## Live Video Stream — How It Works

`GET /api/drones/{droneId}/stream` → `DroneStreamController` → `DroneStreamService`

`DroneStreamService` constructs the HLS URL as:
```
{MEDIAMTX_HLS_BASE_URL}/{droneId-lowercased}/index.m3u8
```

The backend **does not proxy video bytes**. It only returns the URL. The frontend calls MediaMTX directly (via the nginx `/hls/` proxy in Docker, or via Vite's `/hls` dev proxy locally).

**Simulating a drone camera feed (development):**
```bash
# Loop any video file into MediaMTX as if it were a live drone
ffmpeg -re -stream_loop -1 -i footage.mp4 \
  -c:v libx264 -preset ultrafast -tune zerolatency \
  -f rtsp rtsp://localhost:8554/sherlock-01

# Synthetic test pattern (no file needed)
ffmpeg -re -f lavfi \
  -i "testsrc2=size=1280x720:rate=30,drawtext=text='DRONE CAM SIM':fontsize=36:fontcolor=lime" \
  -c:v libx264 -preset ultrafast -tune zerolatency \
  -f rtsp rtsp://localhost:8554/sherlock-01
```

MediaMTX auto-creates the path on first push. No configuration file changes are needed for basic use.

---

## Authentication System

Spring Security secures all endpoints with stateless JWT (HS512). There is no sign-up flow — operators are added via direct DB insert only.

### Endpoint access rules

| Path                      | Access             |
|---------------------------|--------------------|
| `POST /api/auth/login`    | Public             |
| `OPTIONS /**`             | Public (CORS)      |
| `/ws-skytrack/**`         | Public HTTP (see below) |
| Everything else           | Requires `Authorization: Bearer <token>` |

### WebSocket authentication
The HTTP upgrade to `/ws-skytrack` is permitted without a token because browsers cannot set custom headers on WebSocket connections. Security is enforced at the STOMP level: `WebSocketAuthChannelInterceptor` validates the JWT sent in the `Authorization` header of the STOMP `CONNECT` frame. No token → connection rejected.

### Adding an operator (only way to create accounts)

**Development** — set `DEV_SEED_USER` and `DEV_SEED_PASSWORD` in your `.env` file.
`DevDataInitializer` creates the operator on startup (idempotent — skips if the username already exists).
The `.env.example` ships with `admin` / `sherlock` as defaults.

**Production** — insert directly into the database:
```sql
INSERT INTO operators (id, username, password_hash, is_enabled, failed_attempts, created_at)
VALUES (gen_random_uuid(), 'operator1', '$2a$12$<bcrypt-hash>', true, 0, now());
```
Generate the hash via `new BCryptPasswordEncoder(12).encode("password")` in a scratch main, or any BCrypt cost-12 tool.
Never set `DEV_SEED_USER` / `DEV_SEED_PASSWORD` in production.

### Lockout and audit
- `AuthService` locks an account for 30 minutes after 5 consecutive failures.
- Every attempt is written to `auth_audit_log` (never deleted, append-only).
- Logged-out tokens are blacklisted in `token_blacklist` by JTI; a `@Scheduled` job purges expired entries at 03:00 daily.
- Error messages are always generic — the caller cannot distinguish unknown user from wrong password.

### Adding a new protected endpoint
No extra steps — Spring Security's `anyRequest().authenticated()` rule covers all new mappings automatically. Do not add `.permitAll()` without a documented reason.

---

## Running the Backend Standalone

```bash
cd backend

# Requires a PostgreSQL instance at localhost:5432 with user/db 'sherlock'
mvn spring-boot:run

# Or build and run the JAR
mvn package -DskipTests
java -jar target/*.jar
```

The backend starts on port `8080`. The simulator begins immediately on startup.

---

## Docker Build

Multi-stage `Dockerfile`:
1. **Stage `build`:** `maven:3.9.6-eclipse-temurin-17` — dependency cache layer, then `mvn package -DskipTests`
2. **Stage runtime:** `eclipse-temurin:17-jre-alpine` — copies JAR, runs as non-root user `sherlock`

```bash
docker build -t sherlock-backend ./backend
```

JVM flags: `-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0`

---

## Lombok Annotations in Use

| Annotation          | Purpose                              |
|---------------------|--------------------------------------|
| `@Getter` / `@Setter` | Field accessors                    |
| `@NoArgsConstructor` | Required by JPA                    |
| `@AllArgsConstructor` | Used with `@Builder`              |
| `@Builder`          | Fluent construction in service layer |
| `@RequiredArgsConstructor` | Constructor injection (DI)  |
| `@Slf4j`            | `log` field for logging             |

Do not mix Lombok with manually written getters/setters on the same class.

---

## Logging

Use `log.debug(...)` for per-tick simulator output (suppressed in normal operation).  
Use `log.info(...)` for startup events or state changes.  
`application.yml` sets `com.sherlock: INFO` by default.
