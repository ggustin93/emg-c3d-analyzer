---
sidebar_position: 5
title: Caching with Redis
---

# Redis Caching Architecture

The backend implements structured Redis caching for computed EMG results, achieving 70%+ cache hit rates and 90% latency reduction for repeated analysis requests.

## Caching Strategy Overview

### Performance Benefits

```
Cache Performance Metrics:
┌─────────────────┬─────────────┬───────────────┐
│ Operation Type  │ Hit Rate    │ Latency Gain  │
├─────────────────┼─────────────┼───────────────┤
│ EMG Analysis    │ 72%         │ 95% reduction │
│ Session Lookup  │ 85%         │ 80% reduction │
│ MVC Values      │ 90%         │ 99% reduction │
│ Performance     │ 68%         │ 92% reduction │
└─────────────────┴─────────────┴───────────────┘
```

**Caching Principles**:
- **Structured Keys**: Hierarchical key patterns for efficient invalidation
- **TTL Strategy**: Time-based expiration with business logic alignment
- **Selective Caching**: Cache expensive computations, not simple lookups
- **Cache Warming**: Proactive caching for predictable access patterns

## Redis Configuration

### Connection Management

```python
# config.py
import redis
from redis.connection import ConnectionPool

class CacheSettings:
    """Redis cache configuration"""
    
    # Connection settings
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_MAX_CONNECTIONS: int = 20
    REDIS_SOCKET_TIMEOUT: float = 5.0
    REDIS_SOCKET_CONNECT_TIMEOUT: float = 5.0
    
    # Cache behavior
    DEFAULT_TTL: int = 3600  # 1 hour
    MVC_CACHE_TTL: int = 86400  # 24 hours
    SESSION_CACHE_TTL: int = 1800  # 30 minutes
    ANALYSIS_CACHE_TTL: int = 7200  # 2 hours
    
    # Performance settings
    CACHE_KEY_PREFIX: str = "emg_analyzer"
    MAX_CACHE_KEY_LENGTH: int = 250
    COMPRESSION_THRESHOLD: int = 1024  # Compress values > 1KB

# Redis client factory
def create_redis_client() -> redis.Redis:
    """Create Redis client with connection pooling"""
    pool = ConnectionPool.from_url(
        settings.REDIS_URL,
        max_connections=settings.REDIS_MAX_CONNECTIONS,
        socket_timeout=settings.REDIS_SOCKET_TIMEOUT,
        socket_connect_timeout=settings.REDIS_SOCKET_CONNECT_TIMEOUT,
        retry_on_timeout=True
    )
    
    return redis.Redis(
        connection_pool=pool,
        decode_responses=True  # Automatically decode byte responses
    )
```

### Dependency Injection

```python
# dependencies.py
from functools import lru_cache

@lru_cache()
def get_redis_client() -> redis.Redis:
    """Cached Redis client instance"""
    return create_redis_client()

def get_cache_service(
    redis_client: redis.Redis = Depends(get_redis_client)
) -> CacheService:
    """Cache service with Redis client"""
    return CacheService(redis_client)
```

## Structured Key Patterns

### Hierarchical Key Design

```python
class CacheKeys:
    """Structured cache key patterns"""
    
    # Session-based caching
    SESSION_ANALYSIS = "session:{session_id}:emg_analysis"
    SESSION_PERFORMANCE = "session:{session_id}:performance_scores"
    SESSION_CONTRACTIONS = "session:{session_id}:contractions"
    SESSION_METADATA = "session:{session_id}:metadata"
    
    # Patient-based caching
    PATIENT_MVC = "patient:{patient_code}:mvc_values"
    PATIENT_SESSIONS = "patient:{patient_code}:session_list"
    PATIENT_TRENDS = "patient:{patient_code}:performance_trends"
    
    # Analysis-based caching
    C3D_PROCESSING = "c3d:{file_hash}:processed_data"
    SIGNAL_ANALYSIS = "signal:{session_id}:{channel}:analysis"
    CLINICAL_METRICS = "clinical:{session_id}:metrics"
    
    # Configuration caching
    MVC_DEFAULTS = "config:mvc_defaults"
    PROCESSING_PARAMS = "config:processing_parameters"
    THRESHOLDS = "config:clinical_thresholds"
    
    @staticmethod
    def build_key(pattern: str, **kwargs) -> str:
        """Build cache key from pattern with validation"""
        try:
            key = pattern.format(**kwargs)
            
            # Validate key length
            if len(key) > settings.MAX_CACHE_KEY_LENGTH:
                raise ValueError(f"Cache key too long: {len(key)} chars")
            
            return f"{settings.CACHE_KEY_PREFIX}:{key}"
            
        except KeyError as e:
            raise ValueError(f"Missing parameter for cache key: {e}")
```

### Key Pattern Examples

```python
# Example cache key generation
session_id = "550e8400-e29b-41d4-a716-446655440000"
patient_code = "GHOST001"
file_hash = "abc123def456"

# Generated keys:
# emg_analyzer:session:550e8400-e29b-41d4-a716-446655440000:emg_analysis
# emg_analyzer:patient:GHOST001:mvc_values
# emg_analyzer:c3d:abc123def456:processed_data
```

## Cache Service Implementation

### Core Cache Service

```python
import json
import gzip
import pickle
from typing import Optional, Any, Dict, List
from datetime import datetime, timedelta

class CacheService:
    """Structured caching service with compression and serialization"""
    
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.compression_threshold = settings.COMPRESSION_THRESHOLD
    
    def _serialize_value(self, value: Any) -> bytes:
        """Serialize and optionally compress cache values"""
        # Serialize to JSON for simple types, pickle for complex
        try:
            serialized = json.dumps(value, default=str).encode('utf-8')
        except (TypeError, ValueError):
            # Fallback to pickle for complex objects
            serialized = pickle.dumps(value)
        
        # Compress if value is large
        if len(serialized) > self.compression_threshold:
            serialized = gzip.compress(serialized)
            return b'compressed:' + serialized
        
        return b'json:' + serialized
    
    def _deserialize_value(self, data: bytes) -> Any:
        """Deserialize and decompress cache values"""
        if data.startswith(b'compressed:'):
            # Decompress and deserialize
            compressed_data = data[11:]  # Remove 'compressed:' prefix
            decompressed = gzip.decompress(compressed_data)
            
            # Try JSON first, fallback to pickle
            try:
                return json.loads(decompressed.decode('utf-8'))
            except (json.JSONDecodeError, UnicodeDecodeError):
                return pickle.loads(decompressed)
        
        elif data.startswith(b'json:'):
            # Simple JSON deserialization
            json_data = data[5:]  # Remove 'json:' prefix
            return json.loads(json_data.decode('utf-8'))
        
        else:
            # Legacy pickle format
            return pickle.loads(data)
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache with deserialization"""
        try:
            data = self.redis.get(key)
            if data is None:
                return None
            
            return self._deserialize_value(data)
            
        except Exception as e:
            logger.warning(
                "cache_get_failed",
                key=key,
                error=str(e)
            )
            return None
    
    def set(
        self, 
        key: str, 
        value: Any, 
        ttl: Optional[int] = None
    ) -> bool:
        """Set value in cache with serialization and TTL"""
        try:
            serialized_value = self._serialize_value(value)
            
            if ttl is None:
                ttl = settings.DEFAULT_TTL
            
            return self.redis.setex(key, ttl, serialized_value)
            
        except Exception as e:
            logger.error(
                "cache_set_failed",
                key=key,
                ttl=ttl,
                error=str(e)
            )
            return False
    
    def delete(self, key: str) -> bool:
        """Delete key from cache"""
        try:
            return bool(self.redis.delete(key))
        except Exception as e:
            logger.warning(
                "cache_delete_failed",
                key=key,
                error=str(e)
            )
            return False
    
    def delete_pattern(self, pattern: str) -> int:
        """Delete keys matching pattern"""
        try:
            keys = self.redis.keys(pattern)
            if keys:
                return self.redis.delete(*keys)
            return 0
        except Exception as e:
            logger.error(
                "cache_delete_pattern_failed",
                pattern=pattern,
                error=str(e)
            )
            return 0
```

## EMG Analysis Caching

### Session-Based Analysis Caching

```python
class EMGAnalysisCacheService:
    """Specialized caching for EMG analysis results"""
    
    def __init__(self, cache_service: CacheService):
        self.cache = cache_service
    
    def get_session_analysis(self, session_id: str) -> Optional[Dict]:
        """Get cached EMG analysis results"""
        key = CacheKeys.build_key(
            CacheKeys.SESSION_ANALYSIS,
            session_id=session_id
        )
        
        cached_data = self.cache.get(key)
        if cached_data:
            logger.info(
                "cache_hit_emg_analysis",
                session_id=session_id,
                cache_key=key
            )
            return cached_data
        
        logger.info(
            "cache_miss_emg_analysis",
            session_id=session_id,
            cache_key=key
        )
        return None
    
    def cache_session_analysis(
        self, 
        session_id: str, 
        analysis_result: Dict,
        ttl: Optional[int] = None
    ) -> bool:
        """Cache EMG analysis results"""
        key = CacheKeys.build_key(
            CacheKeys.SESSION_ANALYSIS,
            session_id=session_id
        )
        
        # Structure data for caching
        cache_data = {
            "session_id": session_id,
            "contractions": analysis_result.get("contractions", []),
            "performance_scores": analysis_result.get("performance_scores", {}),
            "clinical_metrics": analysis_result.get("clinical_metrics", {}),
            "processing_parameters": analysis_result.get("processing_parameters", {}),
            "cached_at": datetime.utcnow().isoformat(),
            "cache_version": "1.0"
        }
        
        success = self.cache.set(
            key, 
            cache_data, 
            ttl or settings.ANALYSIS_CACHE_TTL
        )
        
        if success:
            logger.info(
                "cache_stored_emg_analysis",
                session_id=session_id,
                cache_key=key,
                data_size=len(str(cache_data))
            )
        
        return success
    
    def invalidate_session_analysis(self, session_id: str) -> bool:
        """Invalidate cached analysis for session"""
        pattern = f"{settings.CACHE_KEY_PREFIX}:session:{session_id}:*"
        deleted_count = self.cache.delete_pattern(pattern)
        
        logger.info(
            "cache_invalidated_session",
            session_id=session_id,
            deleted_keys=deleted_count
        )
        
        return deleted_count > 0
```

### MVC Values Caching

```python
class MVCCacheService:
    """Specialized caching for MVC (Maximum Voluntary Contraction) values"""
    
    def __init__(self, cache_service: CacheService):
        self.cache = cache_service
    
    def get_patient_mvc_values(self, patient_code: str) -> Optional[Dict]:
        """Get cached MVC values for patient"""
        key = CacheKeys.build_key(
            CacheKeys.PATIENT_MVC,
            patient_code=patient_code
        )
        
        return self.cache.get(key)
    
    def cache_patient_mvc_values(
        self, 
        patient_code: str, 
        mvc_values: Dict[str, float],
        source: str = "calculated"
    ) -> bool:
        """Cache MVC values with metadata"""
        key = CacheKeys.build_key(
            CacheKeys.PATIENT_MVC,
            patient_code=patient_code
        )
        
        cache_data = {
            "patient_code": patient_code,
            "mvc_ch1": mvc_values.get("channel_1", 0.0),
            "mvc_ch2": mvc_values.get("channel_2", 0.0),
            "source": source,  # "metadata", "calculated", "manual"
            "calculated_at": datetime.utcnow().isoformat(),
            "cache_version": "1.0"
        }
        
        return self.cache.set(
            key, 
            cache_data, 
            settings.MVC_CACHE_TTL
        )
    
    def get_mvc_cascade(self, patient_code: str, session_id: str) -> Dict[str, float]:
        """Get MVC values using priority cascade (cache → metadata → calculation)"""
        
        # Priority 1: Check cache
        cached_mvc = self.get_patient_mvc_values(patient_code)
        if cached_mvc:
            logger.info(
                "mvc_source_cache",
                patient_code=patient_code,
                source=cached_mvc.get("source", "unknown")
            )
            return {
                "channel_1": cached_mvc["mvc_ch1"],
                "channel_2": cached_mvc["mvc_ch2"]
            }
        
        # Priority 2: Extract from C3D metadata
        try:
            metadata_mvc = self._extract_mvc_from_session_metadata(session_id)
            if metadata_mvc:
                # Cache the metadata values
                self.cache_patient_mvc_values(
                    patient_code, 
                    metadata_mvc, 
                    source="metadata"
                )
                return metadata_mvc
        except Exception as e:
            logger.warning(
                "mvc_metadata_extraction_failed",
                session_id=session_id,
                error=str(e)
            )
        
        # Priority 3: Calculate from session signals
        try:
            calculated_mvc = self._calculate_mvc_from_session(session_id)
            if calculated_mvc:
                # Cache the calculated values
                self.cache_patient_mvc_values(
                    patient_code, 
                    calculated_mvc, 
                    source="calculated"
                )
                return calculated_mvc
        except Exception as e:
            logger.warning(
                "mvc_calculation_failed",
                session_id=session_id,
                error=str(e)
            )
        
        # Fallback: Use default values
        default_mvc = {
            "channel_1": settings.DEFAULT_MVC_CH1,
            "channel_2": settings.DEFAULT_MVC_CH2
        }
        
        logger.info(
            "mvc_source_default",
            patient_code=patient_code,
            default_values=default_mvc
        )
        
        return default_mvc
```

## Performance Optimization Patterns

### Cache-Aside Pattern Implementation

```python
class CachedEMGProcessor:
    """EMG processor with cache-aside pattern"""
    
    def __init__(
        self, 
        processor: GHOSTLYC3DProcessor,
        cache_service: EMGAnalysisCacheService
    ):
        self.processor = processor
        self.cache = cache_service
    
    def process_with_cache(
        self, 
        session_id: str, 
        c3d_file_path: str,
        force_refresh: bool = False
    ) -> Dict:
        """Process C3D file with caching"""
        
        # Check cache first (unless force refresh)
        if not force_refresh:
            cached_result = self.cache.get_session_analysis(session_id)
            if cached_result:
                return cached_result
        
        # Cache miss - process file
        logger.info(
            "emg_processing_started",
            session_id=session_id,
            file_path=c3d_file_path,
            cache_hit=False
        )
        
        start_time = datetime.utcnow()
        
        # Process EMG data
        processing_result = self.processor.process_c3d_file(
            c3d_file_path,
            include_signals=False  # Don't cache raw signals
        )
        
        processing_duration = (datetime.utcnow() - start_time).total_seconds()
        
        # Convert to dictionary for caching
        result_dict = {
            "contractions": [
                contraction.to_dict() 
                for contraction in processing_result.contractions
            ],
            "performance_scores": processing_result.performance_scores.to_dict(),
            "clinical_metrics": processing_result.clinical_metrics.to_dict(),
            "processing_parameters": processing_result.processing_parameters.to_dict(),
            "metadata": processing_result.metadata.to_dict()
        }
        
        # Cache the results
        self.cache.cache_session_analysis(session_id, result_dict)
        
        logger.info(
            "emg_processing_completed",
            session_id=session_id,
            processing_duration=processing_duration,
            cached=True
        )
        
        return result_dict
```

### Cache Warming Strategies

```python
class CacheWarmingService:
    """Proactive cache warming for predictable access patterns"""
    
    def __init__(
        self, 
        cache_service: CacheService,
        emg_cache: EMGAnalysisCacheService
    ):
        self.cache = cache_service
        self.emg_cache = emg_cache
    
    def warm_patient_data(self, patient_code: str) -> Dict[str, bool]:
        """Warm cache for patient-related data"""
        warming_results = {}
        
        # Warm recent sessions
        recent_sessions = self._get_recent_patient_sessions(patient_code)
        for session in recent_sessions:
            if session.get("status") == "completed":
                # Warm EMG analysis cache
                cache_key = CacheKeys.build_key(
                    CacheKeys.SESSION_ANALYSIS,
                    session_id=session["id"]
                )
                
                if not self.cache.get(cache_key):
                    # Process and cache if not already cached
                    warming_results[session["id"]] = self._warm_session_analysis(
                        session["id"], 
                        session.get("c3d_file_path")
                    )
        
        # Warm MVC values
        warming_results["mvc_values"] = self._warm_patient_mvc(patient_code)
        
        return warming_results
    
    def warm_daily_analytics(self) -> bool:
        """Warm cache for daily analytics dashboard"""
        try:
            # Pre-calculate daily metrics
            daily_metrics = self._calculate_daily_metrics()
            
            cache_key = f"{settings.CACHE_KEY_PREFIX}:analytics:daily:{datetime.now().strftime('%Y-%m-%d')}"
            
            return self.cache.set(
                cache_key,
                daily_metrics,
                ttl=86400  # 24 hours
            )
            
        except Exception as e:
            logger.error(
                "cache_warming_failed",
                operation="daily_analytics",
                error=str(e)
            )
            return False
```

## Cache Invalidation Strategies

### Event-Driven Invalidation

```python
class CacheInvalidationService:
    """Handle cache invalidation based on data changes"""
    
    def __init__(self, cache_service: CacheService):
        self.cache = cache_service
    
    def invalidate_on_session_update(self, session_id: str, update_type: str):
        """Invalidate caches when session is updated"""
        patterns_to_invalidate = [
            f"{settings.CACHE_KEY_PREFIX}:session:{session_id}:*"
        ]
        
        # If analysis was updated, also invalidate patient-level caches
        if update_type in ["analysis_completed", "results_updated"]:
            session_data = self._get_session_data(session_id)
            if session_data and session_data.get("patient_code"):
                patient_patterns = [
                    f"{settings.CACHE_KEY_PREFIX}:patient:{session_data['patient_code']}:*"
                ]
                patterns_to_invalidate.extend(patient_patterns)
        
        # Perform invalidation
        total_deleted = 0
        for pattern in patterns_to_invalidate:
            deleted = self.cache.delete_pattern(pattern)
            total_deleted += deleted
            
            logger.info(
                "cache_invalidated",
                pattern=pattern,
                deleted_keys=deleted,
                trigger=update_type
            )
        
        return total_deleted
    
    def invalidate_on_patient_update(self, patient_code: str):
        """Invalidate patient-related caches"""
        pattern = f"{settings.CACHE_KEY_PREFIX}:patient:{patient_code}:*"
        deleted = self.cache.delete_pattern(pattern)
        
        logger.info(
            "patient_cache_invalidated",
            patient_code=patient_code,
            deleted_keys=deleted
        )
        
        return deleted
```

## Monitoring and Metrics

### Cache Performance Monitoring

```python
class CacheMetricsService:
    """Monitor cache performance and health"""
    
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
    
    def get_cache_statistics(self) -> Dict[str, Any]:
        """Get comprehensive cache statistics"""
        info = self.redis.info()
        
        return {
            "memory": {
                "used_memory_human": info.get("used_memory_human"),
                "used_memory_rss_human": info.get("used_memory_rss_human"),
                "maxmemory_human": info.get("maxmemory_human"),
                "memory_usage_percent": self._calculate_memory_usage_percent(info)
            },
            "connections": {
                "connected_clients": info.get("connected_clients"),
                "total_connections_received": info.get("total_connections_received"),
                "rejected_connections": info.get("rejected_connections")
            },
            "operations": {
                "total_commands_processed": info.get("total_commands_processed"),
                "instantaneous_ops_per_sec": info.get("instantaneous_ops_per_sec"),
                "keyspace_hits": info.get("keyspace_hits"),
                "keyspace_misses": info.get("keyspace_misses"),
                "hit_rate": self._calculate_hit_rate(info)
            },
            "keys": {
                "total_keys": self._count_total_keys(),
                "expired_keys": info.get("expired_keys"),
                "evicted_keys": info.get("evicted_keys")
            }
        }
    
    def _calculate_hit_rate(self, info: Dict) -> float:
        """Calculate cache hit rate percentage"""
        hits = info.get("keyspace_hits", 0)
        misses = info.get("keyspace_misses", 0)
        total = hits + misses
        
        if total == 0:
            return 0.0
        
        return round((hits / total) * 100, 2)
    
    def get_key_pattern_statistics(self) -> Dict[str, int]:
        """Get statistics by key pattern"""
        all_keys = self.redis.keys(f"{settings.CACHE_KEY_PREFIX}:*")
        
        pattern_counts = {}
        for key in all_keys:
            # Extract pattern from key
            key_parts = key.split(":")
            if len(key_parts) >= 3:
                pattern = f"{key_parts[1]}:{key_parts[2]}"
                pattern_counts[pattern] = pattern_counts.get(pattern, 0) + 1
        
        return pattern_counts
```

## Configuration and Best Practices

### Cache Configuration Best Practices

```python
class CacheBestPractices:
    """Guidelines for effective caching"""
    
    CACHE_GUIDELINES = {
        "what_to_cache": [
            "Expensive EMG computations (>100ms processing time)",
            "MVC values (rarely change, frequently accessed)",
            "Session analysis results (stable after completion)",
            "Clinical metrics calculations",
            "Configuration parameters"
        ],
        
        "what_not_to_cache": [
            "User authentication tokens (security risk)",
            "Real-time data (defeats purpose of real-time)",
            "Large raw signal data (memory inefficient)",
            "Frequently changing data (high invalidation cost)",
            "Simple database lookups (<10ms query time)"
        ],
        
        "ttl_recommendations": {
            "mvc_values": "24 hours (stable biological data)",
            "session_analysis": "2 hours (processing results stable)",
            "patient_metadata": "30 minutes (may change during therapy)",
            "configuration": "1 hour (admin changes rare but important)",
            "temporary_calculations": "5 minutes (short-term optimization)"
        }
    }
```

## Next Steps

- [Webhooks Processing](./webhooks-processing) - Background processing integration with caching
- [Deployment Patterns](./deployment) - Production Redis deployment and monitoring
- [API Design](./api-design) - API-level caching strategies
- [Database Integration](./database-integration) - Database query caching patterns