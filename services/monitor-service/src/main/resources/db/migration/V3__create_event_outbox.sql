CREATE TABLE event_outbox (
    sequence BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id UUID NOT NULL UNIQUE,
    routing_key TEXT NOT NULL,
    payload JSONB NOT NULL,
    published_at TIMESTAMPTZ
);

CREATE INDEX event_outbox_pending_idx ON event_outbox (sequence) WHERE published_at IS NULL;
