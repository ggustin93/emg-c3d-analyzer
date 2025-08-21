"""
GHOSTLY+ Scoring Configuration API
==================================

API endpoints for managing configurable performance scoring weights.
Allows therapists and researchers to customize scoring algorithms.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, validator
from typing import Optional
import logging

from database.supabase_client import get_supabase_client
from services.clinical.performance_scoring_service import ScoringWeights

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/scoring", tags=["scoring"])


class ScoringConfigurationRequest(BaseModel):
    """Request model for creating/updating scoring configuration"""
    
    configuration_name: str = Field(..., max_length=100, description="Name of the configuration")
    description: Optional[str] = Field(None, max_length=500, description="Description of the configuration")
    
    # Main scoring weights (must sum to 1.0)
    weight_compliance: float = Field(0.400, ge=0.0, le=1.0, description="Therapeutic compliance weight")
    weight_symmetry: float = Field(0.250, ge=0.0, le=1.0, description="Muscle symmetry weight")
    weight_effort: float = Field(0.200, ge=0.0, le=1.0, description="Subjective effort weight")
    weight_game: float = Field(0.150, ge=0.0, le=1.0, description="Game performance weight")
    
    # Compliance sub-component weights (must sum to 1.0)
    weight_completion: float = Field(0.333, ge=0.0, le=1.0, description="Completion rate weight")
    weight_intensity: float = Field(0.333, ge=0.0, le=1.0, description="Intensity rate weight")
    weight_duration: float = Field(0.334, ge=0.0, le=1.0, description="Duration rate weight")
    
    @validator('weight_compliance', 'weight_symmetry', 'weight_effort', 'weight_game')
    def validate_main_weights(cls, v, values):
        """Validate that main weights sum to 1.0"""
        if len(values) == 3:  # All main weights are set
            total = (values.get('weight_compliance', 0) + 
                    values.get('weight_symmetry', 0) + 
                    values.get('weight_effort', 0) + v)
            if abs(total - 1.0) > 0.001:
                raise ValueError(f'Main weights must sum to 1.0, got {total}')
        return v
    
    @validator('weight_duration')
    def validate_compliance_weights(cls, v, values):
        """Validate that compliance sub-weights sum to 1.0"""
        completion = values.get('weight_completion', 0)
        intensity = values.get('weight_intensity', 0)
        total = completion + intensity + v
        
        if abs(total - 1.0) > 0.001:
            raise ValueError(f'Compliance weights must sum to 1.0, got {total}')
        return v


class ScoringConfigurationResponse(BaseModel):
    """Response model for scoring configuration"""
    
    id: str
    configuration_name: str
    description: Optional[str]
    
    weight_compliance: float
    weight_symmetry: float
    weight_effort: float
    weight_game: float
    
    weight_completion: float
    weight_intensity: float
    weight_duration: float
    
    active: bool
    created_at: str
    updated_at: str


@router.get("/configurations", response_model=list[ScoringConfigurationResponse])
async def get_scoring_configurations():
    """Get all available scoring configurations"""
    try:
        supabase = get_supabase_client(use_service_key=True)
        result = supabase.table('scoring_configuration').select('*').order('created_at', desc=True).execute()
        
        return result.data
        
    except Exception as e:
        logger.error(f"Failed to fetch scoring configurations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/configurations/active", response_model=ScoringConfigurationResponse)
async def get_active_scoring_configuration():
    """Get the currently active scoring configuration"""
    try:
        supabase = get_supabase_client(use_service_key=True)
        result = supabase.table('scoring_configuration').select('*').eq('active', True).order('created_at', desc=True).limit(1).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="No active scoring configuration found")
        
        return result.data[0]
        
    except Exception as e:
        logger.error(f"Failed to fetch active scoring configuration: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/configurations", response_model=ScoringConfigurationResponse)
async def create_scoring_configuration(config: ScoringConfigurationRequest):
    """Create a new scoring configuration"""
    try:
        supabase = get_supabase_client(use_service_key=True)
        
        # Create configuration data
        config_data = {
            'configuration_name': config.configuration_name,
            'description': config.description,
            'weight_compliance': config.weight_compliance,
            'weight_symmetry': config.weight_symmetry,
            'weight_effort': config.weight_effort,
            'weight_game': config.weight_game,
            'weight_completion': config.weight_completion,
            'weight_intensity': config.weight_intensity,
            'weight_duration': config.weight_duration,
            'active': False  # New configurations start as inactive
        }
        
        result = supabase.table('scoring_configuration').insert(config_data).execute()
        
        if not result.data:
            raise HTTPException(status_code=400, detail="Failed to create scoring configuration")
        
        logger.info(f"Created scoring configuration: {config.configuration_name}")
        return result.data[0]
        
    except Exception as e:
        logger.error(f"Failed to create scoring configuration: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/configurations/{config_id}/activate")
async def activate_scoring_configuration(config_id: str):
    """Activate a scoring configuration (deactivates others)"""
    try:
        supabase = get_supabase_client(use_service_key=True)
        
        # First, deactivate all configurations
        supabase.table('scoring_configuration').update({'active': False}).neq('id', 'dummy').execute()
        
        # Then activate the specified one
        result = supabase.table('scoring_configuration').update({'active': True}).eq('id', config_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Scoring configuration not found")
        
        logger.info(f"Activated scoring configuration: {config_id}")
        return {"message": "Configuration activated successfully", "config_id": config_id}
        
    except Exception as e:
        logger.error(f"Failed to activate scoring configuration: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/configurations/{config_id}")
async def delete_scoring_configuration(config_id: str):
    """Delete a scoring configuration"""
    try:
        supabase = get_supabase_client(use_service_key=True)
        
        # Check if it's the active configuration
        active_check = supabase.table('scoring_configuration').select('active').eq('id', config_id).execute()
        
        if active_check.data and active_check.data[0]['active']:
            raise HTTPException(status_code=400, detail="Cannot delete active scoring configuration")
        
        result = supabase.table('scoring_configuration').delete().eq('id', config_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Scoring configuration not found")
        
        logger.info(f"Deleted scoring configuration: {config_id}")
        return {"message": "Configuration deleted successfully"}
        
    except Exception as e:
        logger.error(f"Failed to delete scoring configuration: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/test-weights")
async def test_scoring_weights():
    """Test endpoint to verify current scoring weights"""
    try:
        from services.clinical.performance_scoring_service import PerformanceScoringService
        
        service = PerformanceScoringService()
        test_weights = service._load_scoring_weights_from_database("test-session")
        
        return {
            "default_weights": {
                "w_compliance": 0.400,
                "w_symmetry": 0.250,
                "w_effort": 0.200,
                "w_game": 0.150
            },
            "current_weights": {
                "w_compliance": test_weights.w_compliance,
                "w_symmetry": test_weights.w_symmetry,
                "w_effort": test_weights.w_effort,
                "w_game": test_weights.w_game,
                "w_completion": test_weights.w_completion,
                "w_intensity": test_weights.w_intensity,
                "w_duration": test_weights.w_duration
            },
            "weights_valid": test_weights.validate()
        }
        
    except Exception as e:
        logger.error(f"Failed to test scoring weights: {e}")
        raise HTTPException(status_code=500, detail=str(e))