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
│   ├── WebSocketConfig.java        # STOMP broker, /ws-skytrack endpoint
│   └── CorsConfig.java             # Global CORS filter bean
├── controller/
│   └── TelemetryController.java    # REST: GET /api/telemetry/history
├── dto/
│   └── TelemetryDTO.java           # Wire object (no JPA annotations)
├── entity/
│   └── TelemetryEntity.java        # @Entity mapped to `telemetry` table
├── repository/
│   └── TelemetryRepository.java    # JpaRepository, custom finder
└── service/
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
```

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
