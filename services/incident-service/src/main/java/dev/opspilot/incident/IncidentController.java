package dev.opspilot.incident;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/incidents")
class IncidentController {
    private final IncidentEventStore incidents;

    IncidentController(IncidentEventStore incidents) {
        this.incidents = incidents;
    }

    @GetMapping
    List<Incident> list() {
        return incidents.findAll();
    }

    @GetMapping("/{id}")
    Incident get(@PathVariable UUID id) {
        return incidents.find(id).orElseThrow(IncidentController::notFound);
    }

    @GetMapping("/{id}/transitions")
    List<Incident.Transition> transitions(@PathVariable UUID id) {
        get(id);
        return incidents.transitions(id);
    }

    @PostMapping("/{id}/acknowledge")
    Incident acknowledge(@PathVariable UUID id) {
        Incident incident = incidents.acknowledge(id).orElseThrow(IncidentController::notFound);
        if (incident.status().equals("RESOLVED")) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Incident is already resolved");
        }
        return incident;
    }

    private static ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Incident not found");
    }
}
