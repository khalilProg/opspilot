package dev.opspilot.monitor;

import java.io.IOException;
import java.io.InterruptedIOException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Set;
import java.util.concurrent.ScheduledThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

import jakarta.annotation.PreDestroy;

import org.apache.hc.client5.http.classic.methods.HttpGet;
import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.ManagedHttpClientConnectionFactory;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.client5.http.protocol.HttpClientContext;
import org.apache.hc.core5.http.Header;
import org.apache.hc.core5.http.HttpHost;
import org.apache.hc.core5.http.config.Http1Config;
import org.apache.hc.core5.util.Timeout;
import org.springframework.stereotype.Component;

@Component
class MonitorHttpCheck {
    private static final int MAX_REDIRECTS = 5;
    private static final Set<Integer> REDIRECT_CODES = Set.of(301, 302, 303, 307, 308);

    private final MonitorTargetPolicy targets;
    private final ScheduledThreadPoolExecutor deadlines = new ScheduledThreadPoolExecutor(1);
    private final CloseableHttpClient client = HttpClients.custom()
            .setConnectionManager(PoolingHttpClientConnectionManagerBuilder.create()
                    .setConnectionFactory(ManagedHttpClientConnectionFactory.builder()
                            .http1Config(Http1Config.custom().setMaxHeaderCount(100).setMaxLineLength(8192).build())
                            .build())
                    .build())
            .disableRedirectHandling()
            .disableAutomaticRetries()
            .disableCookieManagement()
            .disableAuthCaching()
            .setConnectionReuseStrategy((request, response, context) -> false)
            .build();

    MonitorHttpCheck(MonitorTargetPolicy targets) {
        this.targets = targets;
        deadlines.setRemoveOnCancelPolicy(true);
    }

    Result run(String url, int timeoutSeconds) {
        long start = System.nanoTime();
        long deadline = start + TimeUnit.SECONDS.toNanos(timeoutSeconds);
        Integer status = null;
        String error = null;
        try {
            for (int redirects = 0; ; redirects++) {
                var target = targets.resolve(url);
                var response = request(target, deadline);
                status = response.status();
                if (!REDIRECT_CODES.contains(status)) {
                    if (status < 200 || status >= 300) {
                        error = "HTTP " + status;
                    }
                    break;
                }
                if (redirects == MAX_REDIRECTS || response.location() == null) {
                    error = "Redirect limit exceeded or Location missing";
                    break;
                }
                url = target.uri().resolve(response.location()).toString();
            }
        } catch (IllegalArgumentException ex) {
            error = "Blocked or invalid destination";
        } catch (IOException ex) {
            error = System.nanoTime() - deadline >= 0 || ex instanceof InterruptedIOException
                    ? "HTTP check timed out" : "HTTP connection failed";
        }
        return new Result(OffsetDateTime.now(ZoneOffset.UTC),
                TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start), status, error);
    }

    private Hop request(MonitorTargetPolicy.Target target, long deadline) throws IOException {
        long remaining = deadline - System.nanoTime();
        if (remaining <= 0) {
            throw new InterruptedIOException("Check deadline expired");
        }
        var timeout = Timeout.ofMilliseconds(Math.max(1, TimeUnit.NANOSECONDS.toMillis(remaining)));
        var request = new HttpGet(target.uri());
        request.setConfig(RequestConfig.custom()
                .setConnectionRequestTimeout(timeout)
                .setResponseTimeout(timeout)
                .build());

        // Pin the vetted address for the socket while retaining the hostname for HTTP and TLS.
        var host = new HttpHost(target.uri().getScheme(), target.address(), target.host(), target.port());
        var cancellation = deadlines.schedule(request::cancel, remaining, TimeUnit.NANOSECONDS);
        try (var response = client.executeOpen(host, request, HttpClientContext.create())) {
            try {
                Header location = response.getFirstHeader("Location");
                return new Hop(response.getCode(), location == null ? null : location.getValue());
            } finally {
                // A health check only needs headers. Abort before closing so the body is not drained.
                request.cancel();
            }
        } finally {
            cancellation.cancel(false);
        }
    }

    @PreDestroy
    void close() throws IOException {
        deadlines.shutdownNow();
        client.close();
    }

    private record Hop(int status, String location) {
    }

    record Result(OffsetDateTime checkedAt, long responseTimeMs, Integer httpStatus, String error) {
        boolean healthy() {
            return error == null;
        }
    }
}
