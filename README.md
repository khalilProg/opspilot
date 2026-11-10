# OpsPilot

OpsPilot is a portfolio-focused, polyglot incident-management platform. Milestone 2 phase 1 adds the Monitor CRUD API to the three-service foundation.

## Architecture

| Service | Language | Local URL | Responsibility |
|---|---|---|---|
| monitor-service | Java / Spring Boot | http://localhost:8081 | Monitor CRUD API |
| incident-service | Java / Spring Boot | http://localhost:8082 | Incident lifecycle (future) |
| notification-service | Go | http://localhost:8083 | Notifications (future) |
| PostgreSQL | database | internal only | Separate `monitor_db` and `incident_db` databases |
| RabbitMQ | messaging | internal only | Event broker for later phases |

The Monitor service runs Flyway migrations against `monitor_db` at startup. Scheduled checks, incident lifecycle, and RabbitMQ events are planned for later phases.

## Prerequisites

- Docker Engine with the Docker Compose v2 plugin
- `curl` for smoke tests
- No local Java, Maven, Go, or database installation is required to use Compose.

## Quick start

```bash
cp .env.example .env
docker compose up --build -d
docker compose ps
./scripts/smoke-test.sh
```

Open:

- http://localhost:8081/api/info
- http://localhost:8082/api/info
- http://localhost:8083/api/info
- http://localhost:8081/actuator/health
- http://localhost:8082/actuator/health
- http://localhost:8083/health

Check logs with `docker compose logs -f monitor-service incident-service notification-service`. Stop without deleting data using `docker compose down`.

**Be careful:** `docker compose down -v` removes PostgreSQL and RabbitMQ volumes, including all local data. Run it only when you explicitly want a clean slate.

## Monitor API

| Method | Path | Success |
|---|---|---|
| POST | `/api/monitors` | `201 Created` with the new monitor and its `Location` |
| GET | `/api/monitors` | `200 OK` with the list |
| GET | `/api/monitors/{id}` | `200 OK` with one monitor |
| PUT | `/api/monitors/{id}` | `200 OK` with the updated configuration |
| DELETE | `/api/monitors/{id}` | `204 No Content` |
| PATCH | `/api/monitors/{id}/enabled` | `200 OK` with the updated monitor |

POST and PUT require all five configuration fields.

```json
{
  "name": "Example website",
  "url": "https://example.com/health",
  "intervalSeconds": 30,
  "timeoutSeconds": 5,
  "enabled": true
}
```

PATCH accepts an object such as `{"enabled": false}`. New monitors start with status `UNKNOWN` and zero consecutive failures. The service generates the UUID and timestamps. Invalid requests return `400 Bad Request`. Requests for an unknown monitor UUID return `404 Not Found`.

## Tests

```bash
docker compose run --rm --no-deps monitor-service-test
docker compose run --rm --no-deps incident-service-test
docker compose run --rm --no-deps notification-service-test
```

The Java tests check each service's identity controller directly. The Go tests exercise both HTTP handlers using the standard library. The smoke test checks the running services, including PostgreSQL connectivity through the Java health endpoints.

With the Monitor service running, use Python 3 to test all six CRUD endpoints, validation errors, and missing IDs.

```bash
python3 scripts/test-monitor-api.py
```

Set `MONITOR_BASE_URL` if the service is running at an address other than `http://127.0.0.1:8081`.

If health returns `200` but `/api/monitors` returns `404` after an upgrade, rebuild the Monitor image before rerunning the test.

```bash
docker compose up -d --build --wait monitor-service
python3 scripts/test-monitor-api.py
```

## Design notes

- The database container is not published to the host. Services use Docker DNS (`postgres:5432`) and connect using least-privilege per-service users.
- `.env` is ignored by Git. `.env.example` contains local-development values only; use managed secrets in deployment environments.
- Container images run the app with non-root users.
- The HTTP application ports are bound to `127.0.0.1`, not all host interfaces.
- Docker Compose waits for database and broker health checks before starting the Java/Go services, but applications should still handle transient dependency failure.
- For production, avoid exposing Actuator details, use TLS, secret rotation, database migrations, durable messaging settings, and immutable image references.

## Roadmap

1. **Foundation**: builds, container networking, separate databases, health checks, smoke tests.
2. **Core API**: monitor CRUD, scheduled checks, incident lifecycle, RabbitMQ events and Go consumer.
3. **Frontend**: React dashboard and gateway.
4. **Delivery**: GitHub Actions CI, image publishing, staging deployment and rollback.
5. **Observability**: Prometheus, Grafana, logs, tracing, alerts.
6. **Platform**: Terraform, Ansible, K3s, Helm and GitOps.
