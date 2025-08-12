"""
Cache Service for EMG analysis results
Manages caching of processed analysis data to avoid reprocessing identical files
"""
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from uuid import UUID, uuid4
import json

from ..database.supabase_client import get_supabase_client
from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class CacheService:
    """Service for caching and retrieving EMG analysis results"""
    
    def __init__(self):
        self.supabase = get_supabase_client(use_service_key=True)  # Use service key for admin operations
        self.default_expiry_days = 30  # Configurable cache expiry
    
    async def cache_analysis_results(
        self,
        c3d_metadata_id: UUID,
        file_hash: str,
        analysis_result: Dict[str, Any],
        processing_params: Optional[Dict[str, Any]] = None,
        processing_time_ms: Optional[int] = None
    ) -> UUID:
        """
        Cache processed analysis results
        
        Args:
            c3d_metadata_id: UUID of C3D metadata entry
            file_hash: SHA-256 hash of source file
            analysis_result: Complete EMG analysis results
            processing_params: Parameters used for processing (MVC values, thresholds)
            processing_time_ms: Time taken to process in milliseconds
            
        Returns:
            UUID of cached entry
        """
        cache_id = uuid4()
        
        try:
            # Extract clinical metrics for quick queries
            clinical_metrics = self._extract_clinical_metrics(analysis_result)
            
            # Prepare cache entry
            cache_entry = {
                "id": str(cache_id),
                "c3d_metadata_id": str(c3d_metadata_id),
                "file_hash": file_hash,
                "processing_version": settings.PROCESSING_VERSION,
                "processing_params": processing_params or {},
                "analytics_data": analysis_result,
                "processing_time_ms": processing_time_ms,
                "expires_at": (datetime.utcnow() + timedelta(days=self.default_expiry_days)).isoformat()
            }
            
            # Add clinical metrics
            cache_entry.update(clinical_metrics)
            
            # Insert into database
            result = self.supabase.table("analysis_results").insert(cache_entry).execute()
            
            logger.info(f"Cached analysis results for file hash: {file_hash[:16]}...")
            return cache_id
            
        except Exception as e:
            logger.error(f"Failed to cache analysis results: {str(e)}")
            raise
    
    async def get_cached_analysis(
        self,
        file_hash: str,
        processing_version: str,
        processing_params: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Retrieve cached analysis results
        
        Args:
            file_hash: SHA-256 hash of source file
            processing_version: Processing version to ensure compatibility
            processing_params: Parameters used for processing (optional for exact match)
            
        Returns:
            Cached analysis results or None if not found
        """
        try:
            query = (
                self.supabase.table("analysis_results")
                .select("*")
                .eq("file_hash", file_hash)
                .eq("processing_version", processing_version)
                .gt("expires_at", datetime.utcnow().isoformat())
                .order("created_at", desc=True)
                .limit(1)
            )
            
            result = query.execute()
            
            if not result.data:
                logger.debug(f"No cached results found for file hash: {file_hash[:16]}...")
                return None
            
            cached_data = result.data[0]
            
            # If specific processing params provided, validate they match
            if processing_params and cached_data.get("processing_params"):
                if not self._params_match(processing_params, cached_data["processing_params"]):
                    logger.debug(f"Processing params mismatch for file hash: {file_hash[:16]}...")
                    return None
            
            logger.info(f"Retrieved cached results for file hash: {file_hash[:16]}...")
            return cached_data
            
        except Exception as e:
            logger.error(f"Failed to retrieve cached analysis: {str(e)}")
            return None
    
    async def increment_cache_hits(self, cache_id: str) -> None:
        """
        Increment cache hit counter and update last accessed time
        
        Args:
            cache_id: UUID of cache entry
        """
        try:
            # Get current hit count
            result = self.supabase.table("analysis_results").select("cache_hits").eq("id", cache_id).execute()
            
            if result.data:
                current_hits = result.data[0].get("cache_hits", 0)
                
                # Update hit count and last accessed time
                update_data = {
                    "cache_hits": current_hits + 1,
                    "last_accessed_at": datetime.utcnow().isoformat()
                }
                
                self.supabase.table("analysis_results").update(update_data).eq("id", cache_id).execute()
                
                logger.debug(f"Incremented cache hits for entry: {cache_id}")
            
        except Exception as e:
            logger.warning(f"Failed to increment cache hits: {str(e)}")
    
    async def invalidate_cache_by_hash(self, file_hash: str) -> int:
        """
        Invalidate (delete) cached entries for a specific file hash
        
        Args:
            file_hash: SHA-256 hash of source file
            
        Returns:
            Number of entries invalidated
        """
        try:
            # Delete all cache entries for this file hash
            result = self.supabase.table("analysis_results").delete().eq("file_hash", file_hash).execute()
            
            count = len(result.data) if result.data else 0
            logger.info(f"Invalidated {count} cache entries for file hash: {file_hash[:16]}...")
            
            return count
            
        except Exception as e:
            logger.error(f"Failed to invalidate cache: {str(e)}")
            return 0
    
    async def cleanup_expired_cache(self) -> int:
        """
        Remove expired cache entries
        
        Returns:
            Number of entries removed
        """
        try:
            # Delete expired entries
            result = (
                self.supabase.table("analysis_results")
                .delete()
                .lt("expires_at", datetime.utcnow().isoformat())
                .execute()
            )
            
            count = len(result.data) if result.data else 0
            logger.info(f"Cleaned up {count} expired cache entries")
            
            return count
            
        except Exception as e:
            logger.error(f"Failed to cleanup expired cache: {str(e)}")
            return 0
    
    async def get_cache_statistics(self) -> Dict[str, Any]:
        """
        Get cache usage statistics
        
        Returns:
            Dict with cache statistics
        """
        try:
            # Get total entries
            total_result = self.supabase.table("analysis_results").select("id", count="exact").execute()
            total_count = total_result.count or 0
            
            # Get expired entries
            expired_result = (
                self.supabase.table("analysis_results")
                .select("id", count="exact")
                .lt("expires_at", datetime.utcnow().isoformat())
                .execute()
            )
            expired_count = expired_result.count or 0
            
            # Get cache hits statistics
            hits_result = (
                self.supabase.table("analysis_results")
                .select("cache_hits")
                .gt("expires_at", datetime.utcnow().isoformat())
                .execute()
            )
            
            total_hits = sum(entry.get("cache_hits", 0) for entry in hits_result.data) if hits_result.data else 0
            avg_hits = total_hits / max(1, total_count - expired_count) if total_count > expired_count else 0
            
            return {
                "total_entries": total_count,
                "active_entries": total_count - expired_count,
                "expired_entries": expired_count,
                "total_hits": total_hits,
                "average_hits_per_entry": round(avg_hits, 2)
            }
            
        except Exception as e:
            logger.error(f"Failed to get cache statistics: {str(e)}")
            return {
                "total_entries": 0,
                "active_entries": 0,
                "expired_entries": 0,
                "total_hits": 0,
                "average_hits_per_entry": 0
            }
    
    def _extract_clinical_metrics(self, analysis_result: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract clinical metrics from analysis result for denormalized storage
        
        Args:
            analysis_result: Complete analysis results
            
        Returns:
            Dict with extracted clinical metrics
        """
        clinical_metrics = {}
        
        try:
            # Extract MVC values
            if "mvc_analysis" in analysis_result:
                mvc_data = analysis_result["mvc_analysis"]
                clinical_metrics["mvc_values"] = mvc_data.get("mvc_values", {})
            
            # Extract contraction counts
            if "contractions" in analysis_result:
                contractions = analysis_result["contractions"]
                total_contractions = len(contractions)
                good_contractions = len([c for c in contractions if c.get("quality_flags", {}).get("is_good", False)])
                
                clinical_metrics["total_contractions_count"] = total_contractions
                clinical_metrics["good_contractions_count"] = good_contractions
                clinical_metrics["contractions_data"] = contractions
            
            # Extract compliance scores
            if "compliance_scores" in analysis_result:
                clinical_metrics["compliance_scores"] = analysis_result["compliance_scores"]
            
            # Extract temporal statistics
            if "temporal_stats" in analysis_result:
                clinical_metrics["temporal_stats"] = analysis_result["temporal_stats"]
                
            # Store EMG signals if present (for quick retrieval)
            if "emg_signals" in analysis_result:
                clinical_metrics["emg_signals"] = analysis_result["emg_signals"]
            
        except Exception as e:
            logger.warning(f"Failed to extract clinical metrics: {str(e)}")
        
        return clinical_metrics
    
    def _params_match(self, params1: Dict[str, Any], params2: Dict[str, Any]) -> bool:
        """
        Check if processing parameters match (allowing for minor differences)
        
        Args:
            params1: First set of parameters
            params2: Second set of parameters
            
        Returns:
            True if parameters are considered matching
        """
        try:
            # For now, do simple equality check
            # In future, could add tolerance for floating point values
            return params1 == params2
            
        except Exception as e:
            logger.warning(f"Error comparing parameters: {str(e)}")
            return False
    
    async def get_cached_results_by_metadata_id(self, c3d_metadata_id: UUID) -> List[Dict[str, Any]]:
        """
        Get all cached results for a specific C3D metadata entry
        
        Args:
            c3d_metadata_id: UUID of C3D metadata entry
            
        Returns:
            List of cached analysis results
        """
        try:
            result = (
                self.supabase.table("analysis_results")
                .select("*")
                .eq("c3d_metadata_id", str(c3d_metadata_id))
                .gt("expires_at", datetime.utcnow().isoformat())
                .order("created_at", desc=True)
                .execute()
            )
            
            return result.data if result.data else []
            
        except Exception as e:
            logger.error(f"Failed to get cached results by metadata ID: {str(e)}")
            return []
    
    async def update_cache_expiry(self, cache_id: str, new_expiry_days: int) -> bool:
        """
        Update cache expiry for a specific entry
        
        Args:
            cache_id: UUID of cache entry
            new_expiry_days: New expiry in days from now
            
        Returns:
            True if successful
        """
        try:
            new_expiry = (datetime.utcnow() + timedelta(days=new_expiry_days)).isoformat()
            
            self.supabase.table("analysis_results").update({
                "expires_at": new_expiry
            }).eq("id", cache_id).execute()
            
            logger.info(f"Updated cache expiry for entry: {cache_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to update cache expiry: {str(e)}")
            return False