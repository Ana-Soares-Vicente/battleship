package com.ana.battleship.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Rate limiting filter with two tiers:
 * - Auth endpoints (login/register): 5 requests per minute per IP (anti brute-force)
 * - Unauthenticated general requests: 100 requests per minute per IP
 * - Authenticated requests (with valid Bearer token): not rate-limited at app level
 *   (NGINX Ingress provides infrastructure-level rate limiting at 50 rps)
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final int AUTH_MAX_TOKENS = 5;
    private static final int AUTH_REFILL_SECONDS = 60;
    private static final int GENERAL_MAX_TOKENS = 100;
    private static final int GENERAL_REFILL_SECONDS = 60;

    private final ConcurrentHashMap<String, TokenBucket> authBuckets = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, TokenBucket> generalBuckets = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String clientIp = getClientIp(request);
        String path = request.getRequestURI();

        if (isAuthEndpoint(path)) {
            // Strict rate limiting for auth endpoints (anti brute-force)
            TokenBucket bucket = authBuckets.computeIfAbsent(clientIp,
                    k -> new TokenBucket(AUTH_MAX_TOKENS, AUTH_REFILL_SECONDS));
            if (!bucket.tryConsume()) {
                sendRateLimitResponse(response, "Authentication rate limit exceeded. Maximum 5 requests per minute.");
                return;
            }
        } else if (!hasAuthorizationHeader(request)) {
            // Rate limit only unauthenticated requests without Bearer token
            // Authenticated users are protected by NGINX-level rate limiting (50 rps)
            TokenBucket bucket = generalBuckets.computeIfAbsent(clientIp,
                    k -> new TokenBucket(GENERAL_MAX_TOKENS, GENERAL_REFILL_SECONDS));
            if (!bucket.tryConsume()) {
                sendRateLimitResponse(response, "Rate limit exceeded. Maximum 100 requests per minute.");
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    private boolean isAuthEndpoint(String path) {
        return path.startsWith("/api/auth/login") || path.startsWith("/api/auth/register");
    }

    private boolean hasAuthorizationHeader(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        return header != null && header.startsWith("Bearer ");
    }

    private String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isBlank()) {
            return xRealIp.trim();
        }
        return request.getRemoteAddr();
    }

    private void sendRateLimitResponse(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        String timestamp = Instant.now().toString();
        String json = """
                {"status":429,"error":"Too Many Requests","message":"%s","timestamp":"%s"}""".formatted(message, timestamp);
        response.getWriter().write(json);
    }

    @Scheduled(fixedRate = 300000)
    public void cleanupExpiredEntries() {
        Instant now = Instant.now();
        authBuckets.entrySet().removeIf(entry -> entry.getValue().isExpired(now));
        generalBuckets.entrySet().removeIf(entry -> entry.getValue().isExpired(now));
    }

    private static class TokenBucket {
        private final int maxTokens;
        private final int refillSeconds;
        private int tokens;
        private Instant lastRefill;
        private Instant lastAccess;

        TokenBucket(int maxTokens, int refillSeconds) {
            this.maxTokens = maxTokens;
            this.refillSeconds = refillSeconds;
            this.tokens = maxTokens;
            this.lastRefill = Instant.now();
            this.lastAccess = Instant.now();
        }

        synchronized boolean tryConsume() {
            refill();
            lastAccess = Instant.now();
            if (tokens > 0) {
                tokens--;
                return true;
            }
            return false;
        }

        private void refill() {
            Instant now = Instant.now();
            long elapsedSeconds = now.getEpochSecond() - lastRefill.getEpochSecond();
            if (elapsedSeconds >= refillSeconds) {
                long periods = elapsedSeconds / refillSeconds;
                tokens = (int) Math.min(maxTokens, tokens + (periods * maxTokens));
                lastRefill = lastRefill.plusSeconds(periods * refillSeconds);
            }
        }

        boolean isExpired(Instant now) {
            return now.getEpochSecond() - lastAccess.getEpochSecond() > 300;
        }
    }
}
