package dev.opspilot.monitor;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class MonitorValidationTests {
    private final MockMvc mvc = MockMvcBuilders.standaloneSetup(new MonitorController(
            new MonitorRepository(null), new MonitorTargetPolicy(new MockEnvironment(), ""))).build();

    @Test
    void returnsFieldErrorsForInvalidConfiguration() throws Exception {
        mvc.perform(post("/api/monitors")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":" ", "url":"", "intervalSeconds":0, "timeoutSeconds":-1}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.path").value("/api/monitors"))
                .andExpect(jsonPath("$.fieldErrors.name").value("Enter a monitor name."))
                .andExpect(jsonPath("$.fieldErrors.url").value("Enter a monitor URL."))
                .andExpect(jsonPath("$.fieldErrors.intervalSeconds").value("Enter a check interval greater than zero."))
                .andExpect(jsonPath("$.fieldErrors.timeoutSeconds").value("Enter a timeout greater than zero."))
                .andExpect(jsonPath("$.fieldErrors.enabled").value("Choose whether to enable checks."));
    }

    @Test
    void returnsTargetPolicyRejectionAsUrlError() throws Exception {
        mvc.perform(put("/api/monitors/00000000-0000-0000-0000-000000000000")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Monitor", "url":"http://localhost/health",
                                 "intervalSeconds":30, "timeoutSeconds":5, "enabled":false}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.url").value("Loopback destinations are blocked"));
    }
}
