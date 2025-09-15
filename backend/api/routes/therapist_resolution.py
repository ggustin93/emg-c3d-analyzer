"""
FastAPI endpoints for therapist resolution.

Provides RESTful API for resolving therapist information from patient codes,
following KISS principle with clean endpoint design.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional, Dict
from pydantic import BaseModel, Field
import logging

from services.user.therapist_resolution_service import TherapistResolutionService
from api.dependencies.services import get_therapist_resolution_service
from api.dependencies.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/therapists", tags=["therapists"])


class TherapistResponse(BaseModel):
    """Response model for therapist information."""
    id: str = Field(..., description="Therapist UUID")
    first_name: Optional[str] = Field(None, description="Therapist first name")
    last_name: Optional[str] = Field(None, description="Therapist last name")
    user_code: str = Field(..., description="Therapist user code")
    role: Optional[str] = Field(None, description="User role")
    display_name: str = Field(..., description="Formatted display name")


class BatchResolutionRequest(BaseModel):
    """Request model for batch therapist resolution."""
    patient_codes: List[str] = Field(
        ..., 
        description="List of patient codes to resolve",
        min_items=1,
        max_items=100  # Limit batch size for performance
    )


class BatchResolutionResponse(BaseModel):
    """Response model for batch therapist resolution."""
    therapists: Dict[str, TherapistResponse] = Field(
        ..., 
        description="Map of patient codes to therapist info"
    )
    not_found: List[str] = Field(
        default_factory=list,
        description="Patient codes with no therapist found"
    )


class CacheStatsResponse(BaseModel):
    """Response model for cache statistics."""
    size: int = Field(..., description="Total cache entries")
    hits: int = Field(..., description="Cache entries with data")
    misses: int = Field(..., description="Cache entries without data")


@router.get(
    "/resolve/{patient_code}",
    response_model=Optional[TherapistResponse],
    summary="Resolve therapist for patient code",
    description="Get therapist information for a specific patient code"
)
async def resolve_therapist(
    patient_code: str,
    service: TherapistResolutionService = Depends(get_therapist_resolution_service),
    current_user: dict = Depends(get_current_user)
):
    """Resolve therapist for a single patient code.
    
    KISS: Simple endpoint with clear purpose and error handling.
    """
    logger.info(f"User {current_user.get('email')} resolving therapist for patient {patient_code}")
    
    therapist = service.resolve_therapist(patient_code)
    if not therapist:
        raise HTTPException(
            status_code=404,
            detail=f"No therapist found for patient code: {patient_code}"
        )
    
    return TherapistResponse(**therapist)


@router.post(
    "/resolve/batch",
    response_model=BatchResolutionResponse,
    summary="Batch resolve therapists",
    description="Resolve therapists for multiple patient codes in a single request"
)
async def resolve_therapists_batch(
    request: BatchResolutionRequest,
    service: TherapistResolutionService = Depends(get_therapist_resolution_service),
    current_user: dict = Depends(get_current_user)
):
    """Resolve therapists for multiple patient codes.
    
    DRY: Batch operation endpoint for efficiency.
    """
    logger.info(
        f"User {current_user.get('email')} batch resolving "
        f"{len(request.patient_codes)} patient codes"
    )
    
    # Get therapists for all codes
    therapists_dict = service.resolve_therapists_batch(request.patient_codes)
    
    # Convert to response format and identify missing codes
    therapists = {}
    not_found = []
    
    for code in request.patient_codes:
        normalized_code = code.upper()
        if normalized_code in therapists_dict:
            therapists[normalized_code] = TherapistResponse(**therapists_dict[normalized_code])
        else:
            not_found.append(normalized_code)
    
    return BatchResolutionResponse(
        therapists=therapists,
        not_found=not_found
    )


@router.get(
    "/by-id/{therapist_id}",
    response_model=Optional[TherapistResponse],
    summary="Get therapist by ID",
    description="Get therapist information by their UUID"
)
async def get_therapist_by_id(
    therapist_id: str,
    service: TherapistResolutionService = Depends(get_therapist_resolution_service),
    current_user: dict = Depends(get_current_user)
):
    """Get therapist by their UUID.
    
    Additional endpoint for direct therapist lookup.
    """
    therapist = service.resolve_therapist_by_id(therapist_id)
    if not therapist:
        raise HTTPException(
            status_code=404,
            detail=f"Therapist not found: {therapist_id}"
        )
    
    return TherapistResponse(**therapist)


@router.get(
    "/extract-patient-code",
    response_model=Dict[str, Optional[str]],
    summary="Extract patient code from path",
    description="Utility endpoint to extract patient code from a file path"
)
async def extract_patient_code(
    file_path: str = Query(..., description="File path to extract patient code from"),
    service: TherapistResolutionService = Depends(get_therapist_resolution_service),
    current_user: dict = Depends(get_current_user)
):
    """Extract patient code from file path.
    
    Utility endpoint for testing and debugging.
    """
    patient_code = service.extract_patient_code_from_path(file_path)
    return {"patient_code": patient_code, "file_path": file_path}


@router.get(
    "/cache/stats",
    response_model=CacheStatsResponse,
    summary="Get cache statistics",
    description="Get statistics about the therapist resolution cache"
)
async def get_cache_stats(
    service: TherapistResolutionService = Depends(get_therapist_resolution_service),
    current_user: dict = Depends(get_current_user)
):
    """Get cache statistics for monitoring.
    
    Useful for debugging and performance monitoring.
    """
    stats = service.get_cache_stats()
    return CacheStatsResponse(**stats)


@router.post(
    "/cache/clear",
    response_model=Dict[str, str],
    summary="Clear resolution cache",
    description="Clear the therapist resolution cache (admin only)"
)
async def clear_cache(
    service: TherapistResolutionService = Depends(get_therapist_resolution_service),
    current_user: dict = Depends(get_current_user)
):
    """Clear the therapist resolution cache.
    
    Admin operation for cache management.
    """
    # Check if user is admin (simple role check)
    user_role = current_user.get('user_metadata', {}).get('role')
    if user_role != 'ADMIN':
        raise HTTPException(
            status_code=403,
            detail="Only administrators can clear the cache"
        )
    
    service.clear_cache()
    logger.info(f"Cache cleared by admin user {current_user.get('email')}")
    
    return {"message": "Cache cleared successfully"}