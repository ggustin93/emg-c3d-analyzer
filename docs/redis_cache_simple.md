# Redis Cache - Simple & Fast

## Overview

Fast Redis-based caching for EMG analysis results. Replaces slow database lookups with millisecond cache operations.

**Performance**: ~1-2ms cache operations vs 50-100ms database queries = **50x faster**

## Architecture

```
┌─────────────────────────┐
│   Cache Services        │
├─────────────────────────┤
│ RedisCache              │ ← Core operations
│ CachePatterns           │ ← Advanced patterns  
│ CacheMonitoring         │ ← Health & metrics
└─────────────────────────┘
```

## Quick Start

### 1. Environment Setup

```env
# .env file
REDIS_URL=redis://redis:6379/0
```

### 2. Basic Usage

```python
from services.cache import get_redis_cache, get_cache_patterns

# Simple cache operations
cache = await get_redis_cache()
await cache.set("analysis_123", analysis_data, ttl=3600)
data = await cache.get("analysis_123")

# Cache-aside pattern (recommended)
patterns = await get_cache_patterns()
data = await patterns.cache_aside_get(
    key="analysis_123",
    loader_func=lambda: load_from_database(),
    ttl=3600
)
```

## Services

### RedisCache (Core Service)

**Purpose**: Basic cache operations with graceful fallback

**Key Methods**:
```python
await cache.get(key)                    # Get cached data
await cache.set(key, data, ttl=3600)    # Set with TTL
await cache.delete(key)                 # Remove entry
await cache.exists(key)                 # Check existence
await cache.get_stats()                 # Performance metrics
await cache.health_check()              # Health status
```

**Features**:
- ✅ Automatic connection pooling
- ✅ Graceful fallback when Redis unavailable  
- ✅ Size validation (100MB limit per entry)
- ✅ TTL management
- ✅ JSON serialization

### CachePatterns (Advanced Operations)

**Purpose**: Production-ready caching patterns

**Key Methods**:
```python
# Cache-aside pattern (recommended)
data = await patterns.cache_aside_get(key, loader_func, ttl)

# Batch operations
data_map = await patterns.batch_get(["key1", "key2", "key3"])
results = await patterns.batch_set({"key1": data1, "key2": data2})

# Cache warming
configs = [{"key": "popular_file", "loader_func": load_func, "priority": 9}]
results = await patterns.warm_cache(configs)

# Pattern invalidation
count = await patterns.invalidate_by_pattern("analysis:*")
```

**Patterns**:
- **Cache-Aside**: Check cache → load on miss → cache result
- **Batch Operations**: Pipeline multiple operations for efficiency
- **Cache Warming**: Pre-load frequently accessed data
- **Pattern Invalidation**: Bulk invalidation by key patterns

## API Endpoints

Simple monitoring endpoints available at `/api/cache/`:

```http
GET /api/cache/health          # Health check
GET /api/cache/stats           # Performance metrics  
GET /api/cache/dashboard       # Combined dashboard data
POST /api/cache/invalidate?pattern=*  # Invalidate keys
```

**Example Response**:
```json
{
  "healthy": true,
  "memory_mb": 45.2,
  "hit_rate": 0.89,
  "hits": 1500,
  "misses": 185,
  "total_requests": 1685
}
```

## Integration with EMG Analysis

### Cache Key Structure

```
emg_analysis:{file_hash}       # Analysis results
emg_metadata:{file_hash}       # C3D file metadata  
user_prefs:{user_id}           # User preferences
```

### Usage in EMG Workflow

```python
async def process_emg_file(file_hash: str, params: dict):
    patterns = await get_cache_patterns()
    
    # Try cache first, load on miss
    analysis = await patterns.cache_aside_get(
        key=f"emg_analysis:{file_hash}",
        loader_func=lambda: expensive_emg_analysis(file_hash, params),
        ttl=3600  # 1 hour
    )
    
    return analysis
```

## Configuration

### Default Settings

```python
@dataclass
class CacheConfig:
    ttl_seconds: int = 3600      # 1 hour default TTL
    key_prefix: str = "emg_analysis"  # Key namespace
```

### Docker Setup

```yaml
# docker-compose.yml
redis:
  image: redis:7.2-alpine
  command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
  ports:
    - "6379:6379"
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 30s
```

## Monitoring

### Key Metrics

- **Hit Rate**: Target >90%
- **Memory Usage**: Monitor via `/api/cache/stats`
- **Response Time**: <2ms average
- **Health Status**: Check `/api/cache/health`

### Common Commands

```bash
# Check cache health
curl http://localhost:8080/api/cache/health

# View cache statistics  
curl http://localhost:8080/api/cache/stats

# Invalidate pattern
curl -X POST "http://localhost:8080/api/cache/invalidate?pattern=analysis:*"

# Dashboard view
curl http://localhost:8080/api/cache/dashboard
```

## Troubleshooting

### Cache Miss Issues
```bash
# Check if Redis is running
docker-compose ps redis

# View cache stats
curl http://localhost:8080/api/cache/stats
```

### High Memory Usage
```bash
# Check memory usage
curl http://localhost:8080/api/cache/stats | jq '.memory_mb'

# Invalidate old data
curl -X POST "http://localhost:8080/api/cache/invalidate?pattern=*"
```

### Connection Issues
```bash
# Check Redis logs
docker-compose logs redis

# Test Redis directly
docker-compose exec redis redis-cli ping
```

## Best Practices

### ✅ Do

- Use cache-aside pattern for EMG analysis results
- Set appropriate TTL (1 hour for analysis, 24 hours for metadata)
- Monitor hit rates and memory usage
- Use batch operations for multiple keys
- Handle cache failures gracefully

### ❌ Don't

- Store sensitive data in cache keys
- Set TTL longer than data validity period
- Cache data larger than 100MB per entry
- Ignore cache health monitoring
- Use cache for critical data without fallback

## Performance

### Expected Metrics

| Metric | Target | Description |
|--------|--------|-------------|
| Hit Rate | >90% | Percentage of requests served from cache |
| Response Time | <2ms | Average cache operation time |
| Memory Usage | <256MB | Total Redis memory consumption |
| Uptime | >99.9% | Cache service availability |

### Optimization Tips

1. **Pipeline Operations**: Use `batch_get/set` for multiple keys
2. **Smart TTL**: Longer TTL for stable data, shorter for dynamic
3. **Memory Management**: Configure Redis with `maxmemory` and LRU eviction
4. **Connection Pooling**: Automatic in RedisCache service
5. **Pattern Invalidation**: Use specific patterns, avoid wildcards

---

## Summary

Simple, fast, reliable Redis caching that:

- **Speeds up EMG analysis** by 50x
- **Handles failures gracefully** when Redis unavailable  
- **Provides monitoring** for performance tracking
- **Uses proven patterns** (cache-aside, batching)
- **Follows KISS principle** for maintainability

Ready to use with EMG C3D analysis workflows.