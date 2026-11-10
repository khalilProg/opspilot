package dev.opspilot.monitor;

import java.sql.Types;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.DataClassRowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
class MonitorRepository {
    private final JdbcClient jdbc;
    private final DataClassRowMapper<Monitor> rowMapper = new DataClassRowMapper<>(Monitor.class);

    MonitorRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    Monitor create(String name, String url, int intervalSeconds, int timeoutSeconds, boolean enabled) {
        return jdbc.sql("""
                INSERT INTO monitors (name, url, interval_seconds, timeout_seconds, enabled)
                VALUES (?, ?, ?, ?, ?)
                RETURNING *
                """)
                .params(name, url, intervalSeconds, timeoutSeconds, enabled)
                .query(rowMapper)
                .single();
    }

    List<Monitor> findAll() {
        return jdbc.sql("SELECT * FROM monitors ORDER BY created_at, id")
                .query(rowMapper)
                .list();
    }

    Optional<Monitor> find(UUID id) {
        return jdbc.sql("SELECT * FROM monitors WHERE id = ?")
                .param(id)
                .query(rowMapper)
                .optional();
    }

    Optional<Monitor> update(UUID id, String name, String url, int intervalSeconds, int timeoutSeconds,
            boolean enabled) {
        return jdbc.sql("""
                UPDATE monitors
                SET name = ?, url = ?, interval_seconds = ?, timeout_seconds = ?, enabled = ?,
                    updated_at = CURRENT_TIMESTAMP, check_version = check_version + 1
                WHERE id = ?
                RETURNING *
                """)
                .params(name, url, intervalSeconds, timeoutSeconds, enabled, id)
                .query(rowMapper)
                .optional();
    }

    Optional<Monitor> updateEnabled(UUID id, boolean enabled) {
        return jdbc.sql("""
                UPDATE monitors
                SET enabled = ?, updated_at = CURRENT_TIMESTAMP, check_version = check_version + 1
                WHERE id = ?
                RETURNING *
                """)
                .params(enabled, id)
                .query(rowMapper)
                .optional();
    }

    boolean delete(UUID id) {
        return jdbc.sql("DELETE FROM monitors WHERE id = ?").param(id).update() == 1;
    }

    List<DueMonitor> findDue(int limit) {
        return jdbc.sql("""
                SELECT id, url, timeout_seconds, status, consecutive_failures, consecutive_successes, check_version
                FROM monitors
                WHERE enabled AND (last_checked_at IS NULL
                    OR last_checked_at + make_interval(secs => interval_seconds) <= CURRENT_TIMESTAMP)
                ORDER BY last_checked_at NULLS FIRST, id
                LIMIT ?
                """)
                .param(limit)
                .query(new DataClassRowMapper<>(DueMonitor.class))
                .list();
    }

    @Transactional
    public boolean saveCheck(DueMonitor monitor, MonitorHttpCheck.Result result, String status, int failures, int successes) {
        boolean saved = jdbc.sql("""
                WITH checked AS (
                    UPDATE monitors SET status = :status, consecutive_failures = :failures,
                        consecutive_successes = :successes, last_checked_at = :checkedAt,
                        check_version = check_version + 1
                    WHERE id = :id AND enabled AND check_version = :version
                    RETURNING id
                )
                INSERT INTO monitor_checks (monitor_id, checked_at, response_time_ms, http_status, error)
                SELECT id, :checkedAt, :responseTime, :httpStatus, :error FROM checked
                """)
                .param("status", status)
                .param("failures", failures)
                .param("successes", successes)
                .param("checkedAt", result.checkedAt())
                .param("id", monitor.id())
                .param("version", monitor.checkVersion())
                .param("responseTime", result.responseTimeMs())
                .param("httpStatus", result.httpStatus(), Types.INTEGER)
                .param("error", result.error(), Types.VARCHAR)
                .update() == 1;
        if (saved && !status.equals(monitor.status())) {
            if (status.equals("DOWN")) {
                enqueue(monitor, result, "monitor.down");
            } else if (monitor.status().equals("DOWN")) {
                enqueue(monitor, result, "monitor.recovered");
            }
        }
        return saved;
    }

    private void enqueue(DueMonitor monitor, MonitorHttpCheck.Result result, String routingKey) {
        jdbc.sql("""
                INSERT INTO event_outbox (event_id, routing_key, payload)
                VALUES (:id, :type, jsonb_build_object(
                    'eventId', CAST(:id AS uuid), 'type', CAST(:type AS text), 'version', 1,
                    'monitorId', CAST(:monitorId AS uuid), 'occurredAt', CAST(:occurredAt AS timestamptz)))
                """)
                .param("id", UUID.randomUUID())
                .param("type", routingKey)
                .param("monitorId", monitor.id())
                .param("occurredAt", result.checkedAt())
                .update();
    }

    record DueMonitor(UUID id, String url, int timeoutSeconds, String status, int consecutiveFailures,
            int consecutiveSuccesses, long checkVersion) {
    }
}
