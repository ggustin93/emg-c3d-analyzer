"""Service Dependencies.
===================

Service injection patterns for dependency inversion.
Provides clean service instantiation and lifecycle management.

Authentication is handled separately in auth.py dependency.
"""

from fastapi import Depends
from supabase import Client

from services.analysis import mvc_service
from services.c3d.processor import GHOSTLYC3DProcessor
from services.clinical.notes_service import ClinicalNotesService
from database.supabase_client import get_supabase_client
from api.dependencies.auth import get_current_user

# Export service implementation pending - tracked in domain architecture


def get_c3d_processor(file_path: str = "") -> GHOSTLYC3DProcessor:
    """Factory for C3D processor instances.

    Args:
        file_path: Path to C3D file (set later for upload endpoints)

    Returns:
        GHOSTLYC3DProcessor: Configured processor instance
    """
    return GHOSTLYC3DProcessor(file_path)


def get_mvc_service():
    """Get MVC service singleton.

    Returns:
        MVCService: MVC estimation service instance
    """
    return mvc_service


def get_authenticated_supabase(
    current_user: dict = Depends(get_current_user)
) -> Client:
    """
    Get an authenticated Supabase client using the user's JWT token.
    This ensures RLS policies are properly enforced.
    
    Args:
        current_user: Authenticated user from auth dependency
        
    Returns:
        Client: Authenticated Supabase client with user's token for RLS
    """
    # Create a Supabase client with the user's JWT token for RLS enforcement
    return get_supabase_client(jwt_token=current_user['token'])


def get_clinical_notes_service(
    supabase: Client = Depends(get_authenticated_supabase)
) -> ClinicalNotesService:
    """
    Factory for Clinical Notes Service instances.
    Uses authenticated Supabase client to respect RLS policies.
    
    Args:
        supabase: Authenticated Supabase client instance
        
    Returns:
        ClinicalNotesService: Notes service instance
    """
    return ClinicalNotesService(supabase)


# def get_export_service(processor: GHOSTLYC3DProcessor) -> EMGDataExporter:
#     """
#     Factory for export service instances.
#
#     Args:
#         processor: C3D processor instance
#
#     Returns:
#         EMGDataExporter: Export service instance
#     """
#     return EMGDataExporter(processor)
# TODO: Implement export service
