"""
Test suite for Redis-based CacheService
Tests all cache operations, TTL management, and error handling
"""
import pytest
import json
import asyncio
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch
from uuid import uuid4

from backend.services.redis_cache_service import RedisCacheService, CacheConfig
from backend.config import get_settings


class TestRedisCacheService:
    """Test Redis cache service implementation"""
    
    @pytest.fixture
    def mock_redis(self):
        """Mock Redis client with async methods"""
        redis_mock = Mock()
        redis_mock.setex = AsyncMock()
        redis_mock.get = AsyncMock()
        redis_mock.delete = AsyncMock()
        redis_mock.exists = AsyncMock()
        redis_mock.ttl = AsyncMock()
        redis_mock.flushdb = AsyncMock()
        redis_mock.info = AsyncMock(return_value={"used_memory": 1024})
        return redis_mock
    
    @pytest.fixture
    def cache_service(self, mock_redis):
        """Cache service with mocked Redis"""
        config = CacheConfig(
            ttl_seconds=3600,
            max_size_mb=100,
            key_prefix="test_analysis"
        )
        service = RedisCacheService(config=config)
        service.redis = mock_redis
        return service
    
    @pytest.fixture
    def sample_analysis_data(self):
        """Sample EMG analysis data for testing"""
        return {
            "analytics": {
                "channels": {
                    "EMG1": {"rms_mean": 0.45, "mvc_value": 0.8},
                    "EMG2": {"rms_mean": 0.52, "mvc_value": 0.9}
                },
                "performance": {"overall_score": 85.5}
            },
            "processing_params": {
                "mvc_thresholds": {"EMG1": 0.7, "EMG2": 0.75},
                "filter_settings": {"cutoff": 50}
            },
            "metadata": {
                "processing_time_ms": 1250,
                "version": "1.2.0"
            }
        }


class TestCacheOperations:
    """Test basic cache operations"""
    
    async def test_cache_analysis_success(self, cache_service, mock_redis, sample_analysis_data):
        """Test successful caching of analysis data"""
        file_hash = "abc123def456"
        
        # Mock successful Redis operation
        mock_redis.setex.return_value = True
        
        # Cache the data
        result = await cache_service.cache_analysis_results(
            file_hash=file_hash,
            analysis_data=sample_analysis_data,
            processing_time_ms=1250
        )
        
        # Verify result
        assert result is True
        
        # Verify Redis was called correctly
        mock_redis.setex.assert_called_once()
        call_args = mock_redis.setex.call_args
        
        assert call_args[0][0] == f"test_analysis:{file_hash}"  # Key
        assert call_args[0][1] == 3600  # TTL
        
        # Verify cached data structure
        cached_data = json.loads(call_args[0][2])
        assert cached_data["analytics"] == sample_analysis_data["analytics"]
        assert cached_data["processing_time_ms"] == 1250
        assert "cached_at" in cached_data
    
    async def test_get_cached_analysis_hit(self, cache_service, mock_redis, sample_analysis_data):
        """Test cache hit scenario"""
        file_hash = "abc123def456"
        
        # Prepare cached data
        cached_data = {
            **sample_analysis_data,
            "cached_at": datetime.utcnow().isoformat(),
            "processing_time_ms": 1250
        }
        mock_redis.get.return_value = json.dumps(cached_data)
        
        # Get cached data
        result = await cache_service.get_cached_analysis(file_hash)
        
        # Verify result
        assert result is not None
        assert result["analytics"] == sample_analysis_data["analytics"]
        assert result["processing_time_ms"] == 1250
        
        # Verify Redis was called correctly
        mock_redis.get.assert_called_once_with(f"test_analysis:{file_hash}")
    
    async def test_get_cached_analysis_miss(self, cache_service, mock_redis):
        """Test cache miss scenario"""
        file_hash = "nonexistent123"
        
        # Mock cache miss
        mock_redis.get.return_value = None
        
        # Get cached data
        result = await cache_service.get_cached_analysis(file_hash)
        
        # Verify result
        assert result is None
        
        # Verify Redis was called correctly
        mock_redis.get.assert_called_once_with(f"test_analysis:{file_hash}")
    
    async def test_invalidate_cache(self, cache_service, mock_redis):
        """Test cache invalidation"""
        file_hash = "abc123def456"
        
        # Mock successful deletion
        mock_redis.delete.return_value = 1
        
        # Invalidate cache
        result = await cache_service.invalidate_cache(file_hash)
        
        # Verify result
        assert result is True
        
        # Verify Redis was called correctly
        mock_redis.delete.assert_called_once_with(f"test_analysis:{file_hash}")
    
    async def test_cache_exists(self, cache_service, mock_redis):
        """Test cache existence check"""
        file_hash = "abc123def456"
        
        # Mock cache exists
        mock_redis.exists.return_value = 1
        
        # Check existence
        result = await cache_service.cache_exists(file_hash)
        
        # Verify result
        assert result is True
        
        # Verify Redis was called correctly
        mock_redis.exists.assert_called_once_with(f"test_analysis:{file_hash}")


class TestTTLManagement:
    """Test TTL and expiration management"""
    
    async def test_get_cache_ttl(self, cache_service, mock_redis):
        """Test TTL retrieval"""
        file_hash = "abc123def456"
        
        # Mock TTL response (2 hours remaining)
        mock_redis.ttl.return_value = 7200
        
        # Get TTL
        ttl = await cache_service.get_cache_ttl(file_hash)
        
        # Verify result
        assert ttl == 7200
        
        # Verify Redis was called correctly
        mock_redis.ttl.assert_called_once_with(f"test_analysis:{file_hash}")
    
    async def test_extend_cache_ttl(self, cache_service, mock_redis):
        """Test TTL extension"""
        file_hash = "abc123def456"
        new_ttl = 7200  # 2 hours
        
        # Mock successful TTL update
        mock_redis.expire = AsyncMock(return_value=1)
        
        # Extend TTL
        result = await cache_service.extend_cache_ttl(file_hash, new_ttl)
        
        # Verify result
        assert result is True
        
        # Verify Redis was called correctly
        mock_redis.expire.assert_called_once_with(f"test_analysis:{file_hash}", new_ttl)


class TestErrorHandling:
    """Test error handling and resilience"""
    
    async def test_cache_redis_connection_error(self, cache_service, mock_redis):
        """Test handling Redis connection errors"""
        file_hash = "abc123def456"
        
        # Mock Redis connection error
        from redis.exceptions import ConnectionError
        mock_redis.get.side_effect = ConnectionError("Connection refused")
        
        # Should return None gracefully, not raise
        result = await cache_service.get_cached_analysis(file_hash)
        assert result is None
    
    async def test_cache_json_decode_error(self, cache_service, mock_redis):
        """Test handling corrupted cache data"""
        file_hash = "abc123def456"
        
        # Mock corrupted JSON data
        mock_redis.get.return_value = "invalid json data {"
        
        # Should return None gracefully
        result = await cache_service.get_cached_analysis(file_hash)
        assert result is None
    
    async def test_cache_oversized_data(self, cache_service, mock_redis, sample_analysis_data):
        """Test handling oversized cache data"""
        file_hash = "abc123def456"
        
        # Create oversized data (>100MB config limit)
        oversized_data = {**sample_analysis_data}
        oversized_data["large_field"] = "x" * (100 * 1024 * 1024)  # 100MB string
        
        # Should reject oversized data
        result = await cache_service.cache_analysis_results(
            file_hash=file_hash,
            analysis_data=oversized_data,
            processing_time_ms=1250
        )
        
        # Verify rejection
        assert result is False
        
        # Verify Redis was not called
        mock_redis.setex.assert_not_called()


class TestCacheMetrics:
    """Test cache metrics and monitoring"""
    
    async def test_get_cache_stats(self, cache_service, mock_redis):
        """Test cache statistics retrieval"""
        # Mock Redis info response
        mock_redis.info.return_value = {
            "used_memory": 1024 * 1024,  # 1MB
            "used_memory_human": "1.00M",
            "keyspace_hits": 150,
            "keyspace_misses": 50
        }
        
        # Get cache stats
        stats = await cache_service.get_cache_stats()
        
        # Verify stats structure
        assert "memory_usage_mb" in stats
        assert "hit_rate" in stats
        assert "total_requests" in stats
        assert stats["memory_usage_mb"] == 1.0
        assert stats["hit_rate"] == 0.75  # 150/(150+50)
        assert stats["total_requests"] == 200


class TestCacheConfiguration:
    """Test cache configuration and validation"""
    
    def test_cache_config_validation(self):
        """Test cache configuration validation"""
        # Valid configuration
        config = CacheConfig(
            ttl_seconds=3600,
            max_size_mb=100,
            key_prefix="analysis"
        )
        
        assert config.ttl_seconds == 3600
        assert config.max_size_mb == 100
        assert config.key_prefix == "analysis"
    
    def test_cache_config_invalid_ttl(self):
        """Test invalid TTL configuration"""
        with pytest.raises(ValueError, match="TTL must be positive"):
            CacheConfig(ttl_seconds=-1, max_size_mb=100, key_prefix="test")
    
    def test_cache_config_invalid_size(self):
        """Test invalid size configuration"""
        with pytest.raises(ValueError, match="Max size must be positive"):
            CacheConfig(ttl_seconds=3600, max_size_mb=-1, key_prefix="test")


class TestIntegration:
    """Integration tests with real scenarios"""
    
    async def test_cache_lifecycle(self, cache_service, mock_redis, sample_analysis_data):
        """Test complete cache lifecycle: store -> retrieve -> invalidate"""
        file_hash = "integration_test_123"
        
        # Step 1: Cache data
        mock_redis.setex.return_value = True
        cache_result = await cache_service.cache_analysis_results(
            file_hash=file_hash,
            analysis_data=sample_analysis_data,
            processing_time_ms=1500
        )
        assert cache_result is True
        
        # Step 2: Retrieve data
        cached_data = {
            **sample_analysis_data,
            "cached_at": datetime.utcnow().isoformat(),
            "processing_time_ms": 1500
        }
        mock_redis.get.return_value = json.dumps(cached_data)
        
        retrieved_data = await cache_service.get_cached_analysis(file_hash)
        assert retrieved_data["analytics"] == sample_analysis_data["analytics"]
        
        # Step 3: Invalidate cache
        mock_redis.delete.return_value = 1
        invalidate_result = await cache_service.invalidate_cache(file_hash)
        assert invalidate_result is True
        
        # Step 4: Verify cache miss after invalidation
        mock_redis.get.return_value = None
        final_result = await cache_service.get_cached_analysis(file_hash)
        assert final_result is None


class TestPerformanceComparison:
    """Test performance improvements vs JSONB cache"""
    
    async def test_cache_performance_simulation(self, cache_service, mock_redis):
        """Simulate performance improvements over JSONB cache"""
        # Simulate Redis response times (much faster)
        import time
        
        # Mock ultra-fast Redis responses
        async def fast_get(key):
            await asyncio.sleep(0.001)  # 1ms
            return '{"test": "data"}'
        
        mock_redis.get = fast_get
        
        # Measure cache retrieval time
        start_time = time.time()
        result = await cache_service.get_cached_analysis("perf_test")
        end_time = time.time()
        
        # Verify sub-10ms response (vs 100-500ms for database queries)
        assert (end_time - start_time) < 0.01  # 10ms
        assert result == {"test": "data"}


# Run tests with coverage
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--cov=backend.services.redis_cache_service"])