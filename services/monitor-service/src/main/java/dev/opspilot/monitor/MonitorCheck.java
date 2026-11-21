package dev.opspilot.monitor;

import java.time.OffsetDateTime;

record MonitorCheck(long id, OffsetDateTime checkedAt, long responseTimeMs, Integer httpStatus, String error) {
}
