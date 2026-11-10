package dev.opspilot.incident;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class IncidentApplicationTests {
    @Test
    void serviceIdentifiesItself() {
        assertThat(new InfoController().info()).containsEntry("service", "incident-service");
    }
}
