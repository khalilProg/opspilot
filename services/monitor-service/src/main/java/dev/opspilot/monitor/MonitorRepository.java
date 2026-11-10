package dev.opspilot.monitor;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.DataClassRowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

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
                    updated_at = CURRENT_TIMESTAMP
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
                SET enabled = ?, updated_at = CURRENT_TIMESTAMP
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
}
