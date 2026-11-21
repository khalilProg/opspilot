package dev.opspilot.incident;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class IncidentApplicationTests {
    @Test
    void serviceIdentifiesItself() {
        assertThat(new InfoController().info()).containsEntry("service", "incident-service");
    }

    @Test
    void monitorOutageSeverityIsIndependentOfLifecycleStatus() {
        var mapper = new ObjectMapper();
        for (String status : new String[] {"OPEN", "ACKNOWLEDGED", "RESOLVED"}) {
            var incident = new Incident(UUID.randomUUID(), UUID.randomUUID(), status, "HTTP 503",
                    null, null, null);
            assertThat(mapper.valueToTree(incident).get("severity").asText()).isEqualTo("HIGH");
        }
    }
}
