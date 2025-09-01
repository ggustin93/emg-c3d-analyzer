"""GHOSTLY+ Scoring Configuration API.
==================================

API endpoints for managing configurable performance scoring weights.
Allows therapists and researchers to customize scoring algorithms.
"""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

from database.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/scoring", tags=["scoring"])


class ScoringConfigurationRequest(BaseModel):
    """Request model for creating/updating scoring configuration."""

    configuration_name: str = Field(..., max_length=100, description="Name of the configuration")
    description: str | None = Field(
        None, max_length=500, description="Description of the configuration"
    )

    # Main scoring weights (must sum to 1.0)
    weight_compliance: float = Field(
        0.400, ge=0.0, le=1.0, description="Therapeutic compliance weight"
    )
    weight_symmetry: float = Field(0.250, ge=0.0, le=1.0, description="Muscle symmetry weight")
    weight_effort: float = Field(0.200, ge=0.0, le=1.0, description="Subjective effort weight")
    weight_game: float = Field(0.150, ge=0.0, le=1.0, description="Game performance weight")

    # Compliance sub-component weights (must sum to 1.0)
    weight_completion: float = Field(0.333, ge=0.0, le=1.0, description="Completion rate weight")
    weight_intensity: float = Field(0.333, ge=0.0, le=1.0, description="Intensity rate weight")
    weight_duration: float = Field(0.334, ge=0.0, le=1.0, description="Duration rate weight")

    # Optional therapist/patient association for custom configurations
    therapist_id: str | None = Field(None, description="Therapist ID for custom configuration")
    patient_id: str | None = Field(None, description="Patient ID for custom configuration")

    @field_validator("weight_game")  # Only validate on the last weight field
    @classmethod
    def validate_main_weights(cls, v, info):
        """Validate that main weights sum to 1.0."""
        # Calculate total including the current weight being validated
        data = info.data if hasattr(info, 'data') else {}
        total = (
            data.get("weight_compliance", 0)
            + data.get("weight_symmetry", 0)
            + data.get("weight_effort", 0)
            + v
        )
        if abs(total - 1.0) > 0.001:
            raise ValueError(f"Main weights must sum to 1.0, got {total}")
        return v

    @field_validator("weight_duration")
    @classmethod
    def validate_compliance_weights(cls, v, info):
        """Validate that compliance sub-weights sum to 1.0."""
        data = info.data if hasattr(info, 'data') else {}
        completion = data.get("weight_completion", 0)
        intensity = data.get("weight_intensity", 0)
        total = completion + intensity + v

        if abs(total - 1.0) > 0.001:
            raise ValueError(f"Compliance weights must sum to 1.0, got {total}")
        return v


class ScoringConfigurationResponse(BaseModel):
    """Response model for scoring configuration."""

    id: str
    configuration_name: str
    description: str | None

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

    # Optional therapist/patient association fields
    therapist_id: str | None = None
    patient_id: str | None = None


@router.get("/configurations", response_model=list[ScoringConfigurationResponse])
async def get_scoring_configurations():
    """Get all available scoring configurations."""
    try:
        supabase = get_supabase_client(use_service_key=True)
        result = (
            supabase.table("scoring_configuration")
            .select("*")
            .order("created_at", desc=True)
            .execute()
        )

        return result.data

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to fetch scoring configurations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/configurations/active", response_model=ScoringConfigurationResponse)
async def get_active_scoring_configuration():
    """Get the currently active scoring configuration."""
    try:
        supabase = get_supabase_client(use_service_key=True)
        result = (
            supabase.table("scoring_configuration")
            .select("*")
            .eq("active", True)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=404, detail="No active scoring configuration found")

        return result.data[0]

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to fetch active scoring configuration: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/configurations", response_model=ScoringConfigurationResponse)
async def create_scoring_configuration(config: ScoringConfigurationRequest):
    """Create a new scoring configuration."""
    try:
        supabase = get_supabase_client(use_service_key=True)

        # Create configuration data
        config_data = {
            "configuration_name": config.configuration_name,
            "description": config.description,
            "weight_compliance": config.weight_compliance,
            "weight_symmetry": config.weight_symmetry,
            "weight_effort": config.weight_effort,
            "weight_game": config.weight_game,
            "weight_completion": config.weight_completion,
            "weight_intensity": config.weight_intensity,
            "weight_duration": config.weight_duration,
            "active": False,  # New configurations start as inactive
        }

        result = supabase.table("scoring_configuration").insert(config_data).execute()

        if not result.data:
            raise HTTPException(status_code=400, detail="Failed to create scoring configuration")

        logger.info(f"Created scoring configuration: {config.configuration_name}")
        return result.data[0]

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to create scoring configuration: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/configurations/{config_id}/activate")
async def activate_scoring_configuration(config_id: str):
    """Activate a scoring configuration (deactivates others)."""
    try:
        supabase = get_supabase_client(use_service_key=True)

        # First, deactivate all configurations
        supabase.table("scoring_configuration").update({"active": False}).neq(
            "id", "00000000-0000-0000-0000-000000000000"
        ).execute()

        # Then activate the specified one
        result = (
            supabase.table("scoring_configuration")
            .update({"active": True})
            .eq("id", config_id)
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=404, detail="Scoring configuration not found")

        logger.info(f"Activated scoring configuration: {config_id}")
        return {"message": "Configuration activated successfully", "config_id": config_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to activate scoring configuration: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/configurations/{config_id}")
async def delete_scoring_configuration(config_id: str):
    """Delete a scoring configuration."""
    try:
        supabase = get_supabase_client(use_service_key=True)

        # Check if it's the active configuration
        active_check = (
            supabase.table("scoring_configuration").select("active").eq("id", config_id).execute()
        )

        if active_check.data and active_check.data[0]["active"]:
            raise HTTPException(
                status_code=400, detail="Cannot delete active scoring configuration"
            )

        result = supabase.table("scoring_configuration").delete().eq("id", config_id).execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Scoring configuration not found")

        logger.info(f"Deleted scoring configuration: {config_id}")
        return {"message": "Configuration deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to delete scoring configuration: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/configurations/custom")
async def get_custom_scoring_configuration(
    therapist_id: str | None = None, patient_id: str | None = None
):
    """Get custom scoring configuration for therapist/patient."""
    try:
        supabase = get_supabase_client(use_service_key=True)

        # Build query for custom configuration
        query = supabase.table("scoring_configuration").select("*")

        if therapist_id and patient_id:
            # Look for therapist+patient specific config first
            query = query.eq("therapist_id", therapist_id).eq("patient_id", patient_id)
        elif therapist_id:
            # Look for therapist-specific config
            query = query.eq("therapist_id", therapist_id).is_("patient_id", "null")
        else:
            raise HTTPException(status_code=400, detail="therapist_id is required")

        result = query.order("created_at", desc=True).limit(1).execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="No custom configuration found")

        return result.data[0]

    except HTTPException:
        raise
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to fetch custom scoring configuration: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/configurations/custom", response_model=ScoringConfigurationResponse)
async def create_custom_scoring_configuration(config: ScoringConfigurationRequest):
    """Create a custom scoring configuration for therapist/patient."""
    try:
        if not config.therapist_id:
            raise HTTPException(
                status_code=400, detail="therapist_id is required for custom configurations"
            )

        supabase = get_supabase_client(use_service_key=True)

        # Check if custom config already exists for this therapist/patient combination
        existing_query = supabase.table("scoring_configuration").select("id")
        existing_query = existing_query.eq("therapist_id", config.therapist_id)

        if config.patient_id:
            existing_query = existing_query.eq("patient_id", config.patient_id)
        else:
            existing_query = existing_query.is_("patient_id", "null")

        existing_result = existing_query.execute()

        # Create configuration data
        config_data = {
            "configuration_name": config.configuration_name,
            "description": config.description,
            "weight_compliance": config.weight_compliance,
            "weight_symmetry": config.weight_symmetry,
            "weight_effort": config.weight_effort,
            "weight_game": config.weight_game,
            "weight_completion": config.weight_completion,
            "weight_intensity": config.weight_intensity,
            "weight_duration": config.weight_duration,
            "therapist_id": config.therapist_id,
            "patient_id": config.patient_id,
            "active": False,  # Custom configurations are not globally active
        }

        if existing_result.data:
            # Update existing custom configuration
            result = (
                supabase.table("scoring_configuration")
                .update(config_data)
                .eq("id", existing_result.data[0]["id"])
                .execute()
            )
            logger.info(
                f"Updated custom scoring configuration for therapist {config.therapist_id}, patient {config.patient_id}"
            )
        else:
            # Create new custom configuration
            result = supabase.table("scoring_configuration").insert(config_data).execute()
            logger.info(
                f"Created custom scoring configuration for therapist {config.therapist_id}, patient {config.patient_id}"
            )

        if not result.data:
            raise HTTPException(
                status_code=400, detail="Failed to save custom scoring configuration"
            )

        return result.data[0]

    except HTTPException:
        raise
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to create custom scoring configuration: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/test-weights")
async def test_scoring_weights():
    """Test endpoint to verify current scoring weights."""
    try:
        from services.clinical.performance_scoring_service import (
            PerformanceScoringService,
        )

        service = PerformanceScoringService()
        test_weights = service._load_scoring_weights_from_database("test-session")

        return {
            "metricsDefinitions_weights": {
                "w_compliance": 0.400,
                "w_symmetry": 0.250,
                "w_effort": 0.200,
                "w_game": 0.150,
            },
            "current_active_weights": {
                "w_compliance": test_weights.w_compliance,
                "w_symmetry": test_weights.w_symmetry,
                "w_effort": test_weights.w_effort,
                "w_game": test_weights.w_game,
                "w_completion": test_weights.w_completion,
                "w_intensity": test_weights.w_intensity,
                "w_duration": test_weights.w_duration,
            },
            "weights_valid": test_weights.validate(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to test scoring weights: {e}")
        raise HTTPException(status_code=500, detail=str(e))
