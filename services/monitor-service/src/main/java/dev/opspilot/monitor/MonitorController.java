package dev.opspilot.monitor;

import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

@RestController
@RequestMapping("/api/monitors")
class MonitorController {
    private final MonitorRepository monitors;

    private final MonitorTargetPolicy targets;

    MonitorController(MonitorRepository monitors, MonitorTargetPolicy targets) {
        this.monitors = monitors;
        this.targets = targets;
    }

    @PostMapping
    ResponseEntity<Monitor> create(@Valid @RequestBody Configuration config, UriComponentsBuilder uri) {
        validateTarget(config.url());
        Monitor monitor = monitors.create(config.name(), config.url(), config.intervalSeconds(),
                config.timeoutSeconds(), config.enabled());
        return ResponseEntity.created(uri.path("/api/monitors/{id}").buildAndExpand(monitor.id()).toUri())
                .body(monitor);
    }

    @GetMapping
    List<Monitor> list() {
        return monitors.findAll();
    }

    @GetMapping("/{id}")
    Monitor get(@PathVariable UUID id) {
        return monitors.find(id).orElseThrow(MonitorController::notFound);
    }

    @PutMapping("/{id}")
    Monitor update(@PathVariable UUID id, @Valid @RequestBody Configuration config) {
        validateTarget(config.url());
        return monitors.update(id, config.name(), config.url(), config.intervalSeconds(), config.timeoutSeconds(),
                config.enabled()).orElseThrow(MonitorController::notFound);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable UUID id) {
        if (!monitors.delete(id)) {
            throw notFound();
        }
    }

    @PatchMapping("/{id}/enabled")
    Monitor updateEnabled(@PathVariable UUID id, @Valid @RequestBody EnabledUpdate update) {
        return monitors.updateEnabled(id, update.enabled()).orElseThrow(MonitorController::notFound);
    }

    private void validateTarget(String url) {
        try {
            targets.resolve(url);
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage(), ex);
        }
    }

    private static ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Monitor not found");
    }

    record Configuration(
            @NotBlank @Size(max = 100) String name,
            @NotBlank @Size(max = 2048) String url,
            @NotNull @Positive Integer intervalSeconds,
            @NotNull @Positive Integer timeoutSeconds,
            @NotNull Boolean enabled) {
    }

    record EnabledUpdate(@NotNull Boolean enabled) {
    }
}
