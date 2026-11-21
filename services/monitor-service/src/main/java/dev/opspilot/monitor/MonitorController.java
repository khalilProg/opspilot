package dev.opspilot.monitor;

import java.net.URISyntaxException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
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

    @GetMapping("/{id}/checks")
    List<MonitorCheck> checks(@PathVariable UUID id) {
        return monitors.findRecentChecks(id).orElseThrow(MonitorController::notFound);
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
            String message = ex.getCause() instanceof URISyntaxException
                    ? "Enter a valid absolute HTTP(S) URL."
                    : ex.getMessage();
            throw new InvalidTargetException(message);
        }
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    ValidationFailure invalidFields(MethodArgumentNotValidException ex, HttpServletRequest request) {
        var fields = new LinkedHashMap<String, String>();
        ex.getBindingResult().getFieldErrors()
                .forEach(error -> fields.putIfAbsent(error.getField(), error.getDefaultMessage()));
        return validationFailure(request, fields);
    }

    @ExceptionHandler(InvalidTargetException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    ValidationFailure invalidTarget(InvalidTargetException ex, HttpServletRequest request) {
        return validationFailure(request, Map.of("url", ex.getMessage()));
    }

    private static ValidationFailure validationFailure(HttpServletRequest request, Map<String, String> fields) {
        return new ValidationFailure(Instant.now(), 400, "Bad Request",
                "Check the highlighted fields.", request.getRequestURI(), fields);
    }

    private static ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Monitor not found");
    }

    record Configuration(
            @NotBlank(message = "Enter a monitor name.")
            @Size(max = 100, message = "Use 100 characters or fewer.") String name,
            @NotBlank(message = "Enter a monitor URL.")
            @Size(max = 2048, message = "Use 2048 characters or fewer.") String url,
            @NotNull(message = "Enter a check interval.")
            @Positive(message = "Enter a check interval greater than zero.") Integer intervalSeconds,
            @NotNull(message = "Enter a timeout.")
            @Positive(message = "Enter a timeout greater than zero.") Integer timeoutSeconds,
            @NotNull(message = "Choose whether to enable checks.") Boolean enabled) {
    }

    record EnabledUpdate(@NotNull Boolean enabled) {
    }

    record ValidationFailure(Instant timestamp, int status, String error, String message, String path,
            Map<String, String> fieldErrors) {
    }

    private static final class InvalidTargetException extends RuntimeException {
        InvalidTargetException(String message) {
            super(message);
        }
    }
}
