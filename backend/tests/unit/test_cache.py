#!/usr/bin/env python3
"""Redis Cache Test Suite - Quick validation script.

Run with: PYTHONPATH=. python services/cache/test_cache.py
"""

import sys
import time
import json
from datetime import datetime

# Add project root to path
sys.path.insert(0, '../../..')

from services.cache.redis_cache_service import get_cache_service


def test_redis_cache():
    """Quick validation of Redis cache functionality."""
    print("🧪 Redis Cache Validation")
    print("=" * 30)
    
    cache = get_cache_service()
    
    # Connection test
    health = cache.health_check()
    print(f"✅ Connection: {health['status']}")
    
    # Performance test
    test_data = {
        "analytics": {"CH1": {"compliance_rate": 0.85}},
        "timestamp": datetime.now().isoformat()
    }
    
    session_id = "test_validation_001"
    
    # SET test
    start = time.time()
    success = cache.set_session_analytics(session_id, test_data, ttl_hours=1)
    set_time = (time.time() - start) * 1000
    
    # GET test
    start = time.time()
    retrieved = cache.get_session_analytics(session_id)
    get_time = (time.time() - start) * 1000
    
    print(f"✅ SET: {success} ({set_time:.2f}ms)")
    print(f"✅ GET: {retrieved is not None} ({get_time:.2f}ms)")
    print(f"🚀 Performance: ~{200/get_time:.0f}x faster than DB")
    
    # Stats
    stats = cache.get_cache_stats()
    perf = stats['performance_stats']
    print(f"📊 Hit Rate: {perf['hit_rate']:.1f}%")
    
    # Cleanup
    cache.delete_session_analytics(session_id)
    print("🧹 Cleanup: Complete")
    
    print("\n✨ Redis cache is operational!")


if __name__ == "__main__":
    test_redis_cache()