package dev.opspilot.monitor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.env.MockEnvironment;

class MonitorTargetPolicyTests {
    @ParameterizedTest
    @ValueSource(strings = {
            "file:///etc/passwd", "gopher://8.8.8.8/", "http://user@8.8.8.8/",
            "http://localhost./", "http://127.0.0.1/", "http://2130706433/",
            "http://10.0.0.1/", "http://172.16.0.1/", "http://192.168.0.1/",
            "http://169.254.169.254/", "http://168.63.129.16/", "http://100.100.100.200/",
            "http://metadata.google.internal/", "http://[::1]/", "http://[::ffff:127.0.0.1]/",
            "http://[fd00:ec2::254]/", "http://[fe80::1]/", "http://[64:ff9b::7f00:1]/",
            "http://[2002:7f00:1::]/"
    })
    void blocksUnsafeTargets(String url) {
        var policy = new MonitorTargetPolicy(new MockEnvironment(), "");
        assertThatIllegalArgumentException().isThrownBy(() -> policy.resolve(url));
    }

    @Test
    void acceptsPublicTargetsAndKeepsTheAddressForTheConnection() {
        var policy = new MonitorTargetPolicy(new MockEnvironment(), "");
        assertThat(policy.resolve("https://8.8.8.8/").address().getHostAddress()).isEqualTo("8.8.8.8");
        assertThat(policy.resolve("http://[2606:4700::1111]/").address().getAddress()).hasSize(16);
    }

    @Test
    void exceptionRequiresDevelopmentAndAnExactOriginAndNeverPermitsMetadata() {
        var environment = new MockEnvironment();
        String allowlist = "http://127.0.0.1:8090,http://169.254.169.254";
        var defaultPolicy = new MonitorTargetPolicy(environment, allowlist);
        assertThatIllegalArgumentException().isThrownBy(() -> defaultPolicy.resolve("http://127.0.0.1:8090"));

        environment.setActiveProfiles("development");
        var developmentPolicy = new MonitorTargetPolicy(environment, allowlist);
        assertThat(developmentPolicy.resolve("http://127.0.0.1:8090/health").address().isLoopbackAddress()).isTrue();
        assertThatIllegalArgumentException().isThrownBy(() -> developmentPolicy.resolve("http://127.0.0.1:8091"));
        assertThatIllegalArgumentException().isThrownBy(() -> developmentPolicy.resolve("https://127.0.0.1:8090"));
        assertThatIllegalArgumentException().isThrownBy(() -> developmentPolicy.resolve("http://169.254.169.254"));
    }
}
