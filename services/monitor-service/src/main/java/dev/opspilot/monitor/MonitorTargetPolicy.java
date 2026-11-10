package dev.opspilot.monitor;

import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
class MonitorTargetPolicy {
    private final Set<Origin> developmentOrigins;

    MonitorTargetPolicy(Environment environment,
            @Value("${opspilot.monitor.development-allowed-origins:}") String allowedOrigins) {
        developmentOrigins = environment.matchesProfiles("development")
                ? Arrays.stream(allowedOrigins.split(","))
                        .map(String::strip)
                        .filter(value -> !value.isEmpty())
                        .map(MonitorTargetPolicy::allowlistedOrigin)
                        .collect(Collectors.toUnmodifiableSet())
                : Set.of();
    }

    Target resolve(String url) {
        URI uri = URI.create(url);
        Origin origin = origin(uri);
        boolean development = developmentOrigins.contains(origin);
        if (origin.host().equals("metadata") || origin.host().startsWith("metadata.")) {
            throw new IllegalArgumentException("Metadata destinations are blocked");
        }
        if (!development && (origin.host().equals("localhost") || origin.host().endsWith(".localhost"))) {
            throw new IllegalArgumentException("Loopback destinations are blocked");
        }
        try {
            InetAddress[] addresses = InetAddress.getAllByName(origin.host());
            for (InetAddress address : addresses) {
                if (!isPublic(address) && !(development && isDevelopmentAddress(address))) {
                    throw new IllegalArgumentException("Monitor destination resolves to a blocked address");
                }
            }
            return new Target(uri, origin.host(), origin.port(), addresses[0]);
        } catch (UnknownHostException ex) {
            throw new IllegalArgumentException("Monitor destination could not be resolved", ex);
        }
    }

    private static Origin allowlistedOrigin(String value) {
        URI uri = URI.create(value);
        Origin origin = origin(uri);
        if ((!uri.getRawPath().isEmpty() && !uri.getRawPath().equals("/"))
                || uri.getRawQuery() != null || uri.getRawFragment() != null) {
            throw new IllegalArgumentException("Development allowlist entries must be HTTP(S) origins");
        }
        return origin;
    }

    private static Origin origin(URI uri) {
        String scheme = uri.getScheme();
        String host = uri.getHost();
        if (host == null || uri.getRawUserInfo() != null || host.contains("%")
                || (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme))
                || uri.getPort() == 0 || uri.getPort() > 65535) {
            throw new IllegalArgumentException("Monitor URL must be an absolute HTTP(S) URL without credentials");
        }
        host = host.toLowerCase(Locale.ROOT);
        if (host.startsWith("[")) {
            host = host.substring(1, host.length() - 1);
        }
        if (host.endsWith(".")) {
            host = host.substring(0, host.length() - 1);
        }
        scheme = scheme.toLowerCase(Locale.ROOT);
        return new Origin(scheme, host, uri.getPort() == -1 ? (scheme.equals("https") ? 443 : 80) : uri.getPort());
    }

    private static boolean isPublic(InetAddress address) {
        byte[] ip = address.getAddress();
        if (ip.length == 4) {
            int a = ip[0] & 255;
            int b = ip[1] & 255;
            int c = ip[2] & 255;
            return !isDevelopmentAddress(address) && a != 0 && a < 224
                    && !(a == 100 && b >= 64 && b <= 127)
                    && !(a == 169 && b == 254)
                    && !(a == 168 && b == 63 && c == 129 && (ip[3] & 255) == 16)
                    && !(a == 192 && b == 0 && (c == 0 || c == 2))
                    && !(a == 192 && b == 88 && c == 99)
                    && !(a == 198 && (b == 18 || b == 19 || (b == 51 && c == 100)))
                    && !(a == 203 && b == 0 && c == 113);
        }
        // Only global unicast, excluding special-purpose and transition ranges.
        return (ip[0] & 0xe0) == 0x20
                && !(ip[0] == 0x20 && ip[1] == 0x01
                        && ((ip[2] & 0xfe) == 0 || (ip[2] == 0x0d && (ip[3] & 255) == 0xb8)))
                && !(ip[0] == 0x20 && ip[1] == 0x02)
                && !(ip[0] == 0x3f && (ip[1] & 255) == 0xff);
    }

    private static boolean isDevelopmentAddress(InetAddress address) {
        return address.isLoopbackAddress() || address.isSiteLocalAddress() && address.getAddress().length == 4;
    }

    private record Origin(String scheme, String host, int port) {
    }

    record Target(URI uri, String host, int port, InetAddress address) {
    }
}
