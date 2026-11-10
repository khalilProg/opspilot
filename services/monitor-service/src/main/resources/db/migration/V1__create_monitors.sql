CREATE TABLE monitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    url VARCHAR(2048) NOT NULL,
    interval_seconds INTEGER NOT NULL CHECK (interval_seconds > 0),
    timeout_seconds INTEGER NOT NULL CHECK (timeout_seconds > 0),
    enabled BOOLEAN NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN' CHECK (status IN ('UNKNOWN', 'UP', 'DOWN')),
    consecutive_failures INTEGER NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
