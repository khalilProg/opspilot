# OpsPilot

OpsPilot is a portfolio-focused, polyglot incident-management platform. Milestone 2 adds Monitor CRUD, automated health checks, a RabbitMQ event pipeline, and the Incident API to the three-service foundation.

## Architecture

| Service | Language | Local URL | Responsibility |
|---|---|---|---|
| monitor-service | Java / Spring Boot | http://localhost:8081 | Monitor CRUD API |
| incident-service | Java / Spring Boot | http://localhost:8082 | Opens and resolves incidents from monitor events |
| notification-service | Go | http://localhost:8083 | Records incident notifications |
| PostgreSQL | database | internal only | Separate `monitor_db` and `incident_db` databases |
| RabbitMQ | messaging | internal only | Topic exchange for monitor and incident events |

The Java services run Flyway migrations against their respective databases at startup.

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

## Automated monitoring

Every five seconds the Monitor service dispatches due, enabled monitors to up to four workers. Each monitor uses its configured interval and HTTP timeout. HTTP 2xx is healthy. One success takes an `UNKNOWN` monitor to `UP`, three consecutive failures take it to `DOWN`, and two consecutive successes recover it. PostgreSQL stores the timestamp, elapsed time, status code, and error for each completed check in `monitor_checks`. State changes publish an in-process Spring event and appear in the service log.

Monitor URLs accept HTTP and HTTPS without embedded credentials. The service rejects private, loopback, link-local, metadata, and other non-public destinations. It checks all resolved addresses on create and update, then resolves and validates each scheduled request and redirect again. Each connection uses a validated IP while preserving the hostname for HTTPS certificate verification.

For local testing, the `development` Spring profile can use `OPSPILOT_MONITOR_DEVELOPMENT_ALLOWED_ORIGINS`, a comma-separated list of exact scheme, host, and port combinations. An entry permits IPv4 private and loopback destinations or IPv6 loopback for that origin. Link-local and known metadata destinations stay blocked. The base Compose configuration uses the default policy.

From the project root, rebuild with the development fixture and run the integration script. It exercises private DNS, blocked and permitted redirects, timeouts, the state transitions, and the recorded check history.

```bash
docker compose -f compose.yml -f compose.monitor-dev.yml up -d --build --wait monitor-service monitor-fixture
python3 scripts/test-monitor-checks.py
```

The script reads check history through `docker compose exec`. If you start Compose with `sudo`, run `python3 scripts/test-monitor-checks.py --sudo-docker` so the database checks use the same Docker access.

To return the Monitor service to the default policy after testing, run `docker compose up -d --wait monitor-service`.

## RabbitMQ event pipeline

The durable `opspilot.events` topic exchange routes events to two independent consumer queues.

| Publisher | Routing keys | Queue | Consumer |
|---|---|---|---|
| Monitor | `monitor.down`, `monitor.recovered` | `incident.monitor-events` (`monitor.*`) | Incident |
| Incident | `incident.opened`, `incident.resolved` | `notification.incident-events` (`incident.*`) | Notification |

Messages carry JSON with `eventId`, `type`, `version`, `monitorId`, and `occurredAt`. Incident events also carry `incidentId`. The AMQP message ID matches the stable event ID. Monitor emits recovery only for `DOWN → UP`.

Each Java publisher stores an event in its PostgreSQL outbox in the same transaction as the state change. The relay marks the row published after a broker confirm and successful routing. An unavailable broker leaves the event pending for a later polling cycle. Delivery is at least once, so a lost confirm can result in a replay with the same ID.

Consumers acknowledge after committing their side effects. Incident deduplicates in PostgreSQL, and Notification writes one JSON file per event ID to the `notification_data` volume. Malformed events go to the corresponding `.dlq` queue. Processing failures are requeued with a quorum queue delivery limit of five.

Rebuild all three services with the local monitoring fixture, then run the event pipeline test from the project root.

```bash
docker compose -f compose.yml -f compose.monitor-dev.yml up -d --build --wait \
  monitor-service incident-service notification-service monitor-fixture
python3 scripts/test-event-pipeline.py
```

If you start Compose with `sudo`, use `python3 scripts/test-event-pipeline.py --sudo-docker`. The test deletes its monitor and leaves its incident, published events, and notification records available for inspection.

To verify failure and replay behavior, run `python3 scripts/test-event-reliability.py --sudo-docker` on the same development stack. This test briefly stops RabbitMQ, replays its own events, and leaves two synthetic messages in the Incident dead-letter queue for inspection. It temporarily adds a database check constraint scoped to one test event ID and removes it after the retry test.

## Incident API

| Method | Path | Behavior |
|---|---|---|
| GET | `/api/incidents` | List incidents, newest first |
| GET | `/api/incidents/{id}` | Get an incident, including its reason and lifecycle timestamps |
| GET | `/api/incidents/{id}/transitions` | Read the incident's transition history in recorded order |
| POST | `/api/incidents/{id}/acknowledge` | Acknowledge an open incident with no request body |

The Incident service opens an incident from a `monitor.down` event and resolves the active incident from `monitor.recovered`. Acknowledgement can be repeated without adding another transition. Acknowledging a resolved incident returns `409 Conflict`, and unknown incident IDs return `404 Not Found`. Flyway backfills opening and resolution history for Phase 3 records. Incident state, history, and consumed event IDs live in `incident_db`. The Incident service reads monitor details from event payloads.

Rebuild and run the lifecycle test from the project root. The script publishes synthetic monitor events through the existing outbox and keeps the resulting incidents and history available for inspection.

```bash
sudo docker compose up -d --build --wait monitor-service incident-service notification-service
python3 scripts/test-incident-lifecycle.py --sudo-docker
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
