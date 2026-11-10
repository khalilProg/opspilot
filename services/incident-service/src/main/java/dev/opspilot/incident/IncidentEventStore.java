package dev.opspilot.incident;

import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
class IncidentEventStore {
    private final JdbcClient jdbc;

    IncidentEventStore(JdbcClient jdbc) {
        this.jdbc = jdbc;
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
        return jdbc.sql("""
                INSERT INTO incidents (monitor_id, opened_at) VALUES (?, ?)
                ON CONFLICT (monitor_id) WHERE resolved_at IS NULL DO NOTHING RETURNING id
                """)
                .params(event.monitorId(), event.occurredAt())
                .query(UUID.class)
                .optional();
    }

    private Optional<UUID> resolve(MonitorEventListener.MonitorEvent event) {
        return jdbc.sql("""
                UPDATE incidents SET resolved_at = ? WHERE monitor_id = ? AND resolved_at IS NULL RETURNING id
                """)
                .params(event.occurredAt(), event.monitorId())
                .query(UUID.class)
                .optional();
    }
}
