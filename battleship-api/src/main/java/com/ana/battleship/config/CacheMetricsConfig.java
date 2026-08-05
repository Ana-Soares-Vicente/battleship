package com.ana.battleship.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.cache.CacheManager;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Ensures the "lobby" cache is initialized at startup so Spring Boot
 * can register its metrics (cache_gets_total, cache_puts_total) with Micrometer.
 */
@Component
public class CacheMetricsConfig {

    private static final Logger log = LoggerFactory.getLogger(CacheMetricsConfig.class);

    private final CacheManager cacheManager;

    public CacheMetricsConfig(CacheManager cacheManager) {
        this.cacheManager = cacheManager;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void initializeCaches() {
        // Force cache initialization so metrics are registered
        cacheManager.getCache("lobby");
        log.info("Cache 'lobby' initialized. Available caches: {}", cacheManager.getCacheNames());
    }
}
