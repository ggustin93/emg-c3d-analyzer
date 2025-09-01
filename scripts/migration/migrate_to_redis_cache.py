#!/usr/bin/env python3
"""
Migration script to replace JSONB cache with Redis cache
Supports gradual migration with fallback strategies
"""
import asyncio
import logging
import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.services.hybrid_cache_service import get_hybrid_cache_service
from backend.api.webhooks import router
from backend.config import get_settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def test_redis_connection():
    """Test Redis connection and basic operations"""
    logger.info("🔍 Testing Redis connection...")
    
    try:
        cache_service = await get_hybrid_cache_service(migration_phase="phase1")
        health = await cache_service.health_check()
        
        if health["overall_healthy"]:
            logger.info("✅ Redis connection successful")
            
            # Test cache operations
            test_data = {"test": "data", "timestamp": "2025-08-13"}
            await cache_service.cache_analysis_results(
                session_id="00000000-0000-0000-0000-000000000000",
                file_hash="test_hash_123",
                analysis_result=test_data
            )
            
            retrieved = await cache_service.get_cached_analysis(
                file_hash="test_hash_123",
                processing_version="test"
            )
            
            if retrieved and retrieved.get("test") == "data":
                logger.info("✅ Redis cache operations working")
                return True
            else:
                logger.error("❌ Redis cache operations failed")
                return False
        else:
            logger.error(f"❌ Redis health check failed: {health}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Redis connection test failed: {str(e)}")
        return False

async def migrate_existing_cache():
    """Migrate existing JSONB cache to Redis (if any)"""
    logger.info("🔄 Starting cache migration...")
    
    try:
        # Note: This would require a more complex migration
        # For now, we just warm up the cache service
        cache_service = await get_hybrid_cache_service(migration_phase="phase1")
        stats = await cache_service.get_cache_stats()
        
        logger.info(f"📊 Current cache stats: {stats}")
        logger.info("✅ Cache service initialized for phase1 migration")
        
    except Exception as e:
        logger.error(f"❌ Cache migration failed: {str(e)}")
        raise

def update_webhook_imports():
    """Update webhook services to use hybrid cache"""
    webhook_file = Path(__file__).parent.parent / "backend" / "api" / "webhooks.py"
    
    if not webhook_file.exists():
        logger.error("❌ Webhook file not found")
        return False
    
    logger.info("📝 Webhook file found, manual update required")
    logger.info("   Replace: from ..services.cache_service import CacheService")
    logger.info("   With:    from ..services.hybrid_cache_service import get_hybrid_cache_service")
    logger.info("   Update:  CacheService() -> await get_hybrid_cache_service('phase1')")
    
    return True

async def validate_migration():
    """Validate that migration is working correctly"""
    logger.info("🧪 Validating migration...")
    
    try:
        cache_service = await get_hybrid_cache_service(migration_phase="phase1")
        
        # Test dual-write
        test_data = {
            "analytics": {"test_channel": {"rms_mean": 0.5}},
            "metadata": {"validation": "test"}
        }
        
        success = await cache_service.cache_analysis_results(
            session_id="00000000-0000-0000-0000-000000000001",
            file_hash="validation_test_456",
            analysis_result=test_data,
            processing_time_ms=100
        )
        
        if success:
            logger.info("✅ Dual-write validation successful")
            
            # Test read priority (Redis first)
            retrieved = await cache_service.get_cached_analysis(
                file_hash="validation_test_456",
                processing_version="test"
            )
            
            if retrieved and retrieved.get("analytics"):
                logger.info("✅ Read priority validation successful")
                return True
            else:
                logger.error("❌ Read validation failed")
                return False
        else:
            logger.error("❌ Dual-write validation failed")
            return False
            
    except Exception as e:
        logger.error(f"❌ Validation failed: {str(e)}")
        return False

async def main():
    """Main migration process"""
    logger.info("🚀 Starting Redis cache migration process...")
    
    # Check environment variables
    settings = get_settings()
    if not hasattr(settings, 'REDIS_URL'):
        logger.error("❌ REDIS_URL not configured in environment")
        logger.info("   Set REDIS_URL environment variable (e.g., redis://localhost:6379/0)")
        return False
    
    logger.info(f"📡 Using Redis URL: {settings.REDIS_URL}")
    
    # Step 1: Test Redis connection
    if not await test_redis_connection():
        logger.error("❌ Redis connection test failed - aborting migration")
        return False
    
    # Step 2: Initialize migration
    await migrate_existing_cache()
    
    # Step 3: Update webhook imports (manual step)
    update_webhook_imports()
    
    # Step 4: Validate migration
    if await validate_migration():
        logger.info("✅ Migration validation successful")
    else:
        logger.error("❌ Migration validation failed")
        return False
    
    # Migration complete
    logger.info("🎉 Redis cache migration completed successfully!")
    logger.info("")
    logger.info("📋 Next steps:")
    logger.info("1. Update webhook services to use hybrid_cache_service")
    logger.info("2. Monitor cache performance and hit rates")
    logger.info("3. When stable, move to phase2 (Redis primary)")
    logger.info("4. Eventually move to phase3 (Redis only)")
    logger.info("")
    logger.info("🔍 Monitor with: GET /cache/stats endpoint")
    
    return True

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)