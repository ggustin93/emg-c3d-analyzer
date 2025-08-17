"""
Service Dependencies
===================

Service injection patterns for dependency inversion.
Provides clean service instantiation and lifecycle management.
"""

from services.c3d_processor import GHOSTLYC3DProcessor
from services.mvc_service import mvc_service
from services.export_service import EMGDataExporter


def get_c3d_processor(file_path: str = "") -> GHOSTLYC3DProcessor:
    """
    Factory for C3D processor instances.
    
    Args:
        file_path: Path to C3D file (set later for upload endpoints)
        
    Returns:
        GHOSTLYC3DProcessor: Configured processor instance
    """
    return GHOSTLYC3DProcessor(file_path)


def get_mvc_service():
    """
    Get MVC service singleton.
    
    Returns:
        MVCService: MVC estimation service instance
    """
    return mvc_service


def get_export_service(processor: GHOSTLYC3DProcessor) -> EMGDataExporter:
    """
    Factory for export service instances.
    
    Args:
        processor: C3D processor instance
        
    Returns:
        EMGDataExporter: Export service instance
    """
    return EMGDataExporter(processor)