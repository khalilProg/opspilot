package dev.opspilot.monitor;

import java.time.OffsetDateTime;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import jakarta.annotation.PreDestroy;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
class MonitorScheduler {
    private static final Logger log = LoggerFactory.getLogger(MonitorScheduler.class);
    private static final int WORKERS = 4;

    private final MonitorRepository monitors;
    private final MonitorHttpCheck http;
    private final ApplicationEventPublisher events;
    private final ExecutorService workers = Executors.newFixedThreadPool(WORKERS);
    private final Set<UUID> inFlight = ConcurrentHashMap.newKeySet();

    MonitorScheduler(MonitorRepository monitors, MonitorHttpCheck http, ApplicationEventPublisher events) {
        this.monitors = monitors;
        this.http = http;
        this.events = events;
    }

    @Scheduled(fixedDelay = 5000)
    void checkDueMonitors() {
        var running = Set.copyOf(inFlight);
        if (running.size() >= WORKERS) {
            return;
        }
        for (var monitor : monitors.findDue(WORKERS)) {
            if (inFlight.size() >= WORKERS) {
                break;
            }
            if (!running.contains(monitor.id()) && inFlight.add(monitor.id())) {
                workers.execute(() -> check(monitor));
            }
        }
    }

    private void check(MonitorRepository.DueMonitor monitor) {
        try {
            var result = http.run(monitor.url(), monitor.timeoutSeconds());
            int failures = result.healthy() ? 0 : Math.min(monitor.consecutiveFailures(), Integer.MAX_VALUE - 1) + 1;
            int successes = result.healthy() ? Math.min(monitor.consecutiveSuccesses(), 1) + 1 : 0;
            String status = monitor.status();
            if (failures >= 3) {
                status = "DOWN";
            } else if (result.healthy() && (!status.equals("DOWN") || successes >= 2)) {
                status = "UP";
            }
            if (monitors.saveCheck(monitor, result, status, failures, successes) && !status.equals(monitor.status())) {
                events.publishEvent(new MonitorStatusChanged(monitor.id(), monitor.status(), status, result.checkedAt()));
                log.info("Monitor {} changed from {} to {}", monitor.id(), monitor.status(), status);
            }
        } catch (RuntimeException ex) {
            log.error("Could not complete check for monitor {}", monitor.id(), ex);
        } finally {
            inFlight.remove(monitor.id());
        }
    }

    @PreDestroy
    void stop() {
        workers.shutdownNow();
    }

    record MonitorStatusChanged(UUID monitorId, String previousStatus, String status, OffsetDateTime checkedAt) {
    }
}
