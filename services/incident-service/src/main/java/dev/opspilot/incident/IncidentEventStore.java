package dev.opspilot.incident;

import java.sql.Types;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.DataClassRowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
class IncidentEventStore {
    private final JdbcClient jdbc;
    private final DataClassRowMapper<Incident> incidentMapper = new DataClassRowMapper<>(Incident.class);
    private final DataClassRowMapper<Incident.Transition> transitionMapper =
            new DataClassRowMapper<>(Incident.Transition.class);

    IncidentEventStore(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    List<Incident> findAll() {
        return jdbc.sql("SELECT * FROM incidents ORDER BY opened_at DESC, id").query(incidentMapper).list();
    }

    Optional<Incident> find(UUID id) {
        return jdbc.sql("SELECT * FROM incidents WHERE id = ?").param(id).query(incidentMapper).optional();
    }

    List<Incident.Transition> transitions(UUID id) {
        return jdbc.sql("""
                SELECT from_status, to_status, occurred_at FROM incident_transitions
                WHERE incident_id = ? ORDER BY sequence
                """).param(id).query(transitionMapper).list();
    }

    @Transactional
    public Optional<Incident> acknowledge(UUID id) {
        var updated = jdbc.sql("""
                UPDATE incidents SET status = 'ACKNOWLEDGED', acknowledged_at = CURRENT_TIMESTAMP
                WHERE id = ? AND status = 'OPEN' RETURNING *
                """).param(id).query(incidentMapper).optional();
        updated.ifPresent(incident -> recordTransition(id, "OPEN", "ACKNOWLEDGED", incident.acknowledgedAt()));
        return updated.or(() -> find(id));
    }

    @Transactional
    public void apply(MonitorEventListener.MonitorEvent event) {
        if (jdbc.sql("INSERT INTO processed_monitor_events (event_id) VALUES (?) ON CONFLICT DO NOTHING")
                .param(event.eventId()).update() == 0) {
            return;
        }

        boolean down = event.type().equals("monitor.down");
        Optional<UUID> incidentId = down ? open(event) : resolve(event);
        if (incidentId.isEmpty()) {
            return;
        }
        jdbc.sql("""
                INSERT INTO event_outbox (event_id, routing_key, payload)
                VALUES (:id, :type, jsonb_build_object(
                    'eventId', CAST(:id AS uuid), 'type', CAST(:type AS text), 'version', 1,
                    'monitorId', CAST(:monitorId AS uuid), 'incidentId', CAST(:incidentId AS uuid),
                    'occurredAt', CAST(:occurredAt AS timestamptz)))
                """)
                .param("id", UUID.randomUUID())
                .param("type", down ? "incident.opened" : "incident.resolved")
                .param("monitorId", event.monitorId())
                .param("incidentId", incidentId.get())
                .param("occurredAt", event.occurredAt())
                .update();
    }

    private Optional<UUID> open(MonitorEventListener.MonitorEvent event) {
        String reason = event.reason() == null || event.reason().isBlank()
                ? "Monitor reported DOWN" : event.reason();
        var id = jdbc.sql("""
                INSERT INTO incidents (monitor_id, opened_at, status, reason) VALUES (?, ?, 'OPEN', ?)
                ON CONFLICT (monitor_id) WHERE resolved_at IS NULL DO NOTHING RETURNING id
                """)
                .params(event.monitorId(), event.occurredAt(), reason)
                .query(UUID.class)
                .optional();
        id.ifPresent(value -> recordTransition(value, null, "OPEN", event.occurredAt()));
        return id;
    }

    private Optional<UUID> resolve(MonitorEventListener.MonitorEvent event) {
        var active = jdbc.sql("""
                SELECT * FROM incidents
                WHERE monitor_id = ? AND resolved_at IS NULL AND opened_at <= ? FOR UPDATE
                """).params(event.monitorId(), event.occurredAt()).query(incidentMapper).optional();
        active.ifPresent(incident -> {
            jdbc.sql("UPDATE incidents SET status = 'RESOLVED', resolved_at = ? WHERE id = ?")
                    .params(event.occurredAt(), incident.id()).update();
            recordTransition(incident.id(), incident.status(), "RESOLVED", event.occurredAt());
        });
        return active.map(Incident::id);
    }

    private void recordTransition(UUID id, String from, String to, OffsetDateTime occurredAt) {
        jdbc.sql("""
                INSERT INTO incident_transitions (incident_id, from_status, to_status, occurred_at)
                VALUES (:id, :fromStatus, :toStatus, :occurredAt)
                """)
                .param("id", id)
                .param("fromStatus", from, Types.VARCHAR)
                .param("toStatus", to)
                .param("occurredAt", occurredAt)
                .update();
    }
}
