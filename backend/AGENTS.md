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
│   ├── GlobalExceptionHandler.java # @RestControllerAdvice — auth + generic errors
│   ├── TelemetryController.java    # REST: GET /api/telemetry/history
│   └── DroneStreamController.java  # REST: GET /api/drones/{droneId}/stream
├── dto/
│   ├── LoginRequestDTO.java        # Wire: { username, password }
│   ├── LoginResponseDTO.java       # Wire: { token, username, expiresAt }
│   ├── TelemetryDTO.java           # Wire object (no JPA annotations)
│   ├── TelemetryLiteDTO.java       # Minimal wire object for Free Mode
│   └── StreamUrlDTO.java           # Wire object: { streamUrl } for live video
├── entity/
│   ├── AuthAuditLogEntity.java     # @Entity — append-only auth attempt log
│   ├── OperatorEntity.java         # @Entity — operator accounts (no sign-up; DB-managed)
│   ├── TelemetryEntity.java        # @Entity mapped to `telemetry` table
│   └── TokenBlacklistEntity.java   # @Entity — revoked JWT IDs (JTI)
├── exception/
│   ├── AccountLockedException.java
│   └── AuthenticationFailedException.java
├── repository/
│   ├── AuthAuditLogRepository.java
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
    ├── DroneStreamService.java      # Resolves HLS stream URL from MEDIAMTX_HLS_BASE_URL
    ├── TelemetryService.java        # persist() + getRecentHistory()
    └── TelemetrySimulator.java      # @Scheduled 500ms broadcast + persist
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
```

| Environment Variable       | Default                    | Purpose                                       |
|----------------------------|----------------------------|-----------------------------------------------|
| `JWT_SECRET`               | dev fallback               | Base64-encoded 512-bit HMAC key. **Override in production:** `openssl rand -base64 64` |
| `JWT_EXPIRATION_HOURS`     | `8`                        | Token lifetime in hours (one operator shift)  |
| `MEDIAMTX_HLS_BASE_URL`    | `http://localhost:8888`    | Base URL of MediaMTX HLS output as seen by the **browser**. In Docker use `/hls` (nginx proxies it). In local dev the default hits MediaMTX directly. |

For Docker, these are injected by `docker-compose.yml`. For local dev, the defaults work against a local PostgreSQL instance with user/db `sherlock`.

---

## WebSocket / STOMP Setup

`WebSocketConfig` registers:
- **Endpoint:** `/ws-skytrack` — SockJS enabled, `allowedOriginPatterns("*")`
- **Broker prefix:** `/topic`
- **App prefix:** `/app` (for client-to-server messages, not currently used)

To broadcast from any Spring bean:
```java
messagingTemplate.convertAndSend("/topic/telemetry", payloadObject);

// For Free Mode, we also broadcast a minimal payload:
messagingTemplate.convertAndSend("/topic/telemetry/lite", litePayloadObject);
```
Spring serialises the object to JSON automatically via Jackson.

---

## TelemetrySimulator — How It Works

`@Scheduled(fixedRate = 500)` calls `broadcastTelemetry()` every 500 ms.

State is maintained as instance fields (not thread-safe by design — single scheduler thread):
- `latitude`, `longitude` — advanced by heading + speed using great-circle approximation
- `altitude` — oscillates within 800–3500 m band
- `speed` — perturbates ±2 km/h per tick around cruise (120 km/h)
- `battery` — drains ~0.025–0.030% per tick (≈3%/min, ~30 min endurance demo)
- `heading` — drifts ±3° per tick to simulate waypoint navigation

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

## Adding a New REST Endpoint

1. Add a method to `TelemetryRepository` if a new query is needed (Spring Data derived query or `@Query`)
2. Add the business logic to `TelemetryService`
3. Add a `@GetMapping` / `@PostMapping` method to `TelemetryController`

There is no Spring Security configured. Do not add authentication without discussing it first.

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
```sql
INSERT INTO operators (id, username, password_hash, is_enabled, failed_attempts, created_at)
VALUES (gen_random_uuid(), 'operator1', '$2a$12$<bcrypt-hash>', true, 0, now());
```
Generate the hash via `new BCryptPasswordEncoder(12).encode("password")` in a scratch main, or any BCrypt cost-12 tool.

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
