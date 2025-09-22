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
from services.user.repositories.therapist_repository import TherapistRepository
from services.user.therapist_resolution_service import TherapistResolutionService
from database.supabase_client import get_supabase_client
from api.dependencies.auth import get_current_user

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




def get_therapist_repository(
    supabase_client: Client = Depends(get_authenticated_supabase)
) -> TherapistRepository:
    """
    Factory for Therapist Repository instances.
    
    SOLID: Dependency Inversion - depends on abstraction not concrete implementation.
    
    Uses authenticated client to properly respect RLS policies while allowing
    authorized users (researchers, therapists, admins) to access patient data.
    
    Args:
        supabase_client: Authenticated Supabase client with user's JWT token
        
    Returns:
        TherapistRepository: Repository instance for therapist data access
    """
    return TherapistRepository(supabase_client)


def get_therapist_resolution_service(
    repository: TherapistRepository = Depends(get_therapist_repository)
) -> TherapistResolutionService:
    """
    Factory for Therapist Resolution Service instances.
    
    KISS: Simple service instantiation with repository injection.
    DRY: Centralized service creation logic.
    
    Args:
        repository: Therapist repository instance
        
    Returns:
        TherapistResolutionService: Service instance for therapist resolution
    """
    return TherapistResolutionService(repository)
