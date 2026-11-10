package dev.opspilot.incident;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class InfoController {
    @GetMapping("/api/info")
    public Map<String, String> info() {
        return Map.of("service", "incident-service", "version", "0.1.0");
    }
}
