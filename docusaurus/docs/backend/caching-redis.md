---
sidebar_position: 5
title: Caching with Redis
---

# Redis Caching

Simple Redis caching for expensive EMG calculations.

## What Gets Cached

- EMG analysis results (expensive to recalculate)
- MVC values (Maximum Voluntary Contraction thresholds)
- Session performance scores
- Configuration settings

## Cache Keys

Structured key patterns:
- `session:{session_id}:emg_analysis`
- `patient:{patient_code}:mvc_values`  
- `config:processing_parameters`

## Performance

- **Hit Rate:** 70%+ for analysis requests
- **Latency:** 90% reduction for cached results

## Files

- `services/cache/cache_service.py` - Redis operations
- `services/cache/emg_cache.py` - EMG-specific caching
- `config.py` - Redis connection settings

## Running Redis

```bash
# Development
redis-server

# Docker
docker run -d -p 6379:6379 redis:7-alpine
```

## TTL Settings

- EMG analysis: 2 hours
- MVC values: 24 hours  
- Performance scores: 1 hour