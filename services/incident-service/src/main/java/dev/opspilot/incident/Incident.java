package dev.opspilot.incident;

import java.time.OffsetDateTime;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonProperty;

public record Incident(UUID id, UUID monitorId, String status, String reason,
        OffsetDateTime openedAt, OffsetDateTime acknowledgedAt, OffsetDateTime resolvedAt) {

    @JsonProperty("severity")
    public String severity() {
        return "HIGH";
    }

    public record Transition(String fromStatus, String toStatus, OffsetDateTime occurredAt) {
    }
}
