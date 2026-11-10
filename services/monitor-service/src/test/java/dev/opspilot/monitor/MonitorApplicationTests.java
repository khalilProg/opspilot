package dev.opspilot.monitor;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class MonitorApplicationTests {
    @Test
    void serviceIdentifiesItself() {
        assertThat(new InfoController().info()).containsEntry("service", "monitor-service");
    }
}
