"""
Therapist Resolution Service for patient-to-therapist mapping.

This service provides clean business logic for resolving therapist information
from patient codes, following SOLID principles and KISS design.
"""

from typing import Optional, Dict, List
import logging
import re

from services.user.repositories.therapist_repository import TherapistRepository

logger = logging.getLogger(__name__)


class TherapistResolutionService:
    """Service for resolving therapist information from patient codes.
    
    Single Responsibility: Patient-to-therapist resolution logic
    Open/Closed: Extensible for future resolution strategies
    Dependency Inversion: Depends on repository abstraction
    """
    
    def __init__(self, therapist_repository: TherapistRepository):
        """Initialize service with therapist repository.
        
        Args:
            therapist_repository: Repository for therapist data access
        """
        self.repository = therapist_repository
        self.logger = logger
        # Cache for resolved therapists to avoid repeated queries
        self._cache: Dict[str, Optional[Dict]] = {}
    
    def resolve_therapist(self, patient_code: str) -> Optional[Dict]:
        """Resolve therapist for a single patient code.
        
        KISS: Simple resolution with caching for performance.
        
        Args:
            patient_code: Patient code (e.g., 'P001')
            
        Returns:
            Dictionary with therapist info or None if not found
        """
        if not patient_code:
            return None
        
        # Check cache first (DRY - avoid repeated queries)
        cache_key = patient_code.upper()
        if cache_key in self._cache:
            return self._cache[cache_key]
        
        try:
            therapist = self.repository.get_therapist_for_patient_code(patient_code)
            self._cache[cache_key] = therapist
            
            if therapist:
                self.logger.info(
                    f"Resolved therapist {therapist['display_name']} "
                    f"for patient {patient_code}"
                )
            else:
                self.logger.debug(f"No therapist found for patient {patient_code}")
            
            return therapist
            
        except Exception as e:
            self.logger.error(f"Failed to resolve therapist for {patient_code}: {e}")
            self._cache[cache_key] = None
            return None
    
    def resolve_therapists_batch(self, patient_codes: List[str]) -> Dict[str, Dict]:
        """Resolve therapists for multiple patient codes.
        
        KISS: Simple batch operation with error handling and caching.
        
        Args:
            patient_codes: List of patient codes
            
        Returns:
            Dictionary mapping patient_code to therapist info
        """
        if not patient_codes:
            return {}
        
        # Filter out codes already in cache (DRY)
        uncached_codes = []
        result = {}
        
        for code in patient_codes:
            cache_key = code.upper()
            if cache_key in self._cache:
                if self._cache[cache_key]:
                    result[cache_key] = self._cache[cache_key]
            else:
                uncached_codes.append(code)
        
        # Fetch uncached codes if any
        if uncached_codes:
            try:
                fetched = self.repository.get_therapists_for_patient_codes(uncached_codes)
                
                # Update cache and result
                for code in uncached_codes:
                    cache_key = code.upper()
                    therapist = fetched.get(cache_key)
                    self._cache[cache_key] = therapist
                    if therapist:
                        result[cache_key] = therapist
                
                self.logger.info(
                    f"Batch resolved {len(fetched)} therapists "
                    f"for {len(uncached_codes)} patient codes"
                )
                
            except Exception as e:
                self.logger.error(f"Batch therapist resolution failed: {e}")
        
        return result
    
    def resolve_therapist_by_id(self, therapist_id: str) -> Optional[Dict]:
        """Resolve therapist by their UUID.
        
        Args:
            therapist_id: Therapist UUID
            
        Returns:
            Dictionary with therapist info or None if not found
        """
        if not therapist_id:
            return None
        
        try:
            return self.repository.get_therapist_by_id(therapist_id)
        except Exception as e:
            self.logger.error(f"Failed to resolve therapist by ID {therapist_id}: {e}")
            return None
    
    def extract_patient_code_from_path(self, file_path: str) -> Optional[str]:
        """Extract patient code from file path.
        
        DRY: Centralized extraction logic used across the system.
        
        Patterns supported:
        - bucket/P001/filename.c3d
        - P001/filename.c3d
        - path/P001_filename.c3d
        
        Args:
            file_path: Full or relative file path
            
        Returns:
            Patient code (e.g., 'P001') or None if not found
        """
        if not file_path:
            return None
        
        # Pattern 1: Directory structure (P001/...)
        match = re.search(r'/(P\d{3})/', file_path)
        if match:
            return match.group(1)
        
        # Pattern 2: Filename prefix (P001_...)
        match = re.search(r'(P\d{3})[_/]', file_path)
        if match:
            return match.group(1)
        
        # Pattern 3: Anywhere in path with word boundaries
        match = re.search(r'\b(P\d{3})\b', file_path)
        if match:
            return match.group(1)
        
        return None
    
    def clear_cache(self):
        """Clear the internal cache.
        
        Useful for testing or when data might have changed.
        """
        self._cache.clear()
        self.logger.debug("Therapist resolution cache cleared")
    
    def get_cache_stats(self) -> Dict:
        """Get cache statistics for monitoring.
        
        Returns:
            Dictionary with cache statistics
        """
        return {
            'size': len(self._cache),
            'hits': sum(1 for v in self._cache.values() if v is not None),
            'misses': sum(1 for v in self._cache.values() if v is None)
        }