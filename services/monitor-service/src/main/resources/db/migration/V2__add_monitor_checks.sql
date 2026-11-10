ALTER TABLE monitors
    ADD COLUMN last_checked_at TIMESTAMPTZ,
    ADD COLUMN consecutive_successes INTEGER NOT NULL DEFAULT 0 CHECK (consecutive_successes >= 0),
    ADD COLUMN check_version BIGINT NOT NULL DEFAULT 0;

CREATE TABLE monitor_checks (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    monitor_id UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    checked_at TIMESTAMPTZ NOT NULL,
    response_time_ms BIGINT NOT NULL CHECK (response_time_ms >= 0),
    http_status INTEGER,
    error TEXT
);

CREATE INDEX monitor_checks_monitor_id_idx ON monitor_checks (monitor_id, id);
