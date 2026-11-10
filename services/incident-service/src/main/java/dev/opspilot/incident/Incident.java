package dev.opspilot.incident;

import java.time.OffsetDateTime;
import java.util.UUID;

public record Incident(UUID id, UUID monitorId, String status, String reason,
        OffsetDateTime openedAt, OffsetDateTime acknowledgedAt, OffsetDateTime resolvedAt) {

    public record Transition(String fromStatus, String toStatus, OffsetDateTime occurredAt) {
    }
}
