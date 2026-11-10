package dev.opspilot.incident;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class IncidentApplication {
    public static void main(String[] args) {
        SpringApplication.run(IncidentApplication.class, args);
    }
}
