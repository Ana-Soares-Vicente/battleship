package com.ana.battleship.config;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Business metrics for the Battleship API.
 * Exposes domain-specific counters, gauges and timers via Micrometer/Prometheus.
 *
 * Metrics exposed:
 * - battleship_matches_finished_total (counter)
 * - battleship_ships_sunk_total (counter)
 * - battleship_shots_hit_total (counter)
 * - battleship_shots_miss_total (counter)
 * - battleship_matches_active (gauge)
 * - battleship_match_duration_seconds (timer with p50/p95)
 * - battleship_lobby_wait_time_seconds (timer with p50/p95)
 */
@Component
public class BusinessMetrics {

    private final Counter matchesFinished;
    private final Counter shipsSunk;
    private final Counter shotsHit;
    private final Counter shotsMiss;
    private final AtomicInteger matchesActive = new AtomicInteger(0);
    private final Timer matchDuration;
    private final Timer lobbyWaitTime;

    public BusinessMetrics(MeterRegistry registry) {
        this.matchesFinished = Counter.builder("battleship_matches_finished_total")
                .description("Total number of matches finished")
                .tag("application", "battleship-api")
                .register(registry);

        this.shipsSunk = Counter.builder("battleship_ships_sunk_total")
                .description("Total number of ships sunk")
                .tag("application", "battleship-api")
                .register(registry);

        this.shotsHit = Counter.builder("battleship_shots_hit_total")
                .description("Total number of shots that hit a ship")
                .tag("application", "battleship-api")
                .register(registry);

        this.shotsMiss = Counter.builder("battleship_shots_miss_total")
                .description("Total number of shots that missed")
                .tag("application", "battleship-api")
                .register(registry);

        registry.gauge("battleship_matches_active", matchesActive);

        this.matchDuration = Timer.builder("battleship_match_duration")
                .description("Duration of matches from start to finish")
                .tag("application", "battleship-api")
                .publishPercentiles(0.5, 0.95)
                .register(registry);

        this.lobbyWaitTime = Timer.builder("battleship_lobby_wait_time")
                .description("Time players wait in lobby before match starts")
                .tag("application", "battleship-api")
                .publishPercentiles(0.5, 0.95)
                .register(registry);
    }

    public void recordMatchFinished() {
        matchesFinished.increment();
    }

    public void recordShipSunk() {
        shipsSunk.increment();
    }

    public void recordShotHit() {
        shotsHit.increment();
    }

    public void recordShotMiss() {
        shotsMiss.increment();
    }

    public void matchStarted() {
        matchesActive.incrementAndGet();
    }

    public void matchEnded() {
        matchesActive.decrementAndGet();
    }

    public void recordMatchDuration(Duration duration) {
        if (duration != null && !duration.isNegative()) {
            matchDuration.record(duration);
        }
    }

    public void recordLobbyWaitTime(Duration duration) {
        if (duration != null && !duration.isNegative()) {
            lobbyWaitTime.record(duration);
        }
    }
}
