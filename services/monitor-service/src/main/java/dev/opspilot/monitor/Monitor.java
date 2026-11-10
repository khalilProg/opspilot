package dev.opspilot.monitor;

import java.time.OffsetDateTime;
import java.util.UUID;

public record Monitor(
        UUID id,
        String name,
        String url,
        int intervalSeconds,
        int timeoutSeconds,
        boolean enabled,
        String status,
        int consecutiveFailures,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {
}
