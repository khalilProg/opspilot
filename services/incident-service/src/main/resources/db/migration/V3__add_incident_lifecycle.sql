ALTER TABLE incidents
    ADD COLUMN status VARCHAR(20),
    ADD COLUMN reason TEXT NOT NULL DEFAULT 'Monitor reported DOWN',
    ADD COLUMN acknowledged_at TIMESTAMPTZ;

UPDATE incidents SET status = CASE WHEN resolved_at IS NULL THEN 'OPEN' ELSE 'RESOLVED' END;

ALTER TABLE incidents ALTER COLUMN status SET NOT NULL;
ALTER TABLE incidents ADD CONSTRAINT incidents_lifecycle_check CHECK (
    (status = 'OPEN' AND acknowledged_at IS NULL AND resolved_at IS NULL)
    OR (status = 'ACKNOWLEDGED' AND acknowledged_at IS NOT NULL AND resolved_at IS NULL)
    OR (status = 'RESOLVED' AND resolved_at IS NOT NULL)
);

CREATE TABLE incident_transitions (
    sequence BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    from_status VARCHAR(20),
    to_status VARCHAR(20) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT incident_transition_check CHECK (
        (from_status IS NULL AND to_status = 'OPEN')
        OR (from_status IS NOT NULL AND (
            (from_status = 'OPEN' AND to_status IN ('ACKNOWLEDGED', 'RESOLVED'))
            OR (from_status = 'ACKNOWLEDGED' AND to_status = 'RESOLVED')
        ))
    )
);

CREATE INDEX incident_transitions_incident_idx ON incident_transitions (incident_id, sequence);

INSERT INTO incident_transitions (incident_id, from_status, to_status, occurred_at)
SELECT id, NULL, 'OPEN', opened_at FROM incidents;

INSERT INTO incident_transitions (incident_id, from_status, to_status, occurred_at)
SELECT id, 'OPEN', 'RESOLVED', resolved_at FROM incidents WHERE resolved_at IS NOT NULL;
