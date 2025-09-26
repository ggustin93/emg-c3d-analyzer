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

    # Main scoring weights (must sum to 1.0) - Research-determined defaults from metricsDefinitions.md
    weight_compliance: float = Field(
        0.500, ge=0.0, le=1.0, description="Therapeutic compliance weight (50% default)"
    )
    weight_symmetry: float = Field(0.250, ge=0.0, le=1.0, description="Muscle symmetry weight (25% default)")
    weight_effort: float = Field(0.250, ge=0.0, le=1.0, description="Subjective effort weight (25% default)")
    weight_game: float = Field(0.000, ge=0.0, le=1.0, description="Game performance weight (0% default - game-dependent)")

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
    """Activate a scoring configuration (deactivates others except GHOSTLY-TRIAL-DEFAULT)."""
    try:
        supabase = get_supabase_client(use_service_key=True)

        # First, deactivate all configurations except the protected GHOSTLY-TRIAL-DEFAULT
        # The database trigger will prevent deactivation of GHOSTLY-TRIAL-DEFAULT during trial
        supabase.table("scoring_configuration").update({"active": False}).neq(
            "configuration_name", "GHOSTLY-TRIAL-DEFAULT"
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



@router.put("/configurations/default", response_model=ScoringConfigurationResponse)
async def update_default_configuration(config: ScoringConfigurationRequest):
    """Update the GHOSTLY-TRIAL-DEFAULT configuration (admin only).
    
    This endpoint updates the system default scoring configuration.
    Only administrators can modify this during the clinical trial.
    """
    try:
        supabase = get_supabase_client(use_service_key=True)
        
        # Fixed ID for GHOSTLY-TRIAL-DEFAULT configuration
        default_config_id = "a0000000-0000-0000-0000-000000000001"
        
        # Prepare update data
        update_data = {
            "configuration_name": "GHOSTLY-TRIAL-DEFAULT",  # Always use this name
            "description": config.description or "Default scoring configuration for GHOSTLY+ clinical trial. All patients use this configuration.",
            "weight_compliance": config.weight_compliance,
            "weight_symmetry": config.weight_symmetry,
            "weight_effort": config.weight_effort,
            "weight_game": config.weight_game,
            "weight_completion": config.weight_completion,
            "weight_intensity": config.weight_intensity,
            "weight_duration": config.weight_duration,
            "updated_at": "now()",
            "is_global": True,  # This is the global default
            "active": True,  # Always active
        }
        
        # Update the default configuration
        result = (
            supabase.table("scoring_configuration")
            .update(update_data)
            .eq("id", default_config_id)
            .execute()
        )
        
        if not result.data:
            # Configuration doesn't exist, create it
            logger.warning(f"GHOSTLY-TRIAL-DEFAULT not found, creating it")
            create_data = {**update_data, "id": default_config_id}
            result = supabase.table("scoring_configuration").insert(create_data).execute()
            
            if not result.data:
                raise HTTPException(
                    status_code=500,
                    detail="Failed to create default scoring configuration"
                )
        
        logger.info(f"Updated GHOSTLY-TRIAL-DEFAULT configuration")
        return result.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to update default scoring configuration: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/adherence/{patient_code}")
async def get_patient_adherence(patient_code: str, sessions_completed: int = None):
    """Get adherence score for a patient by patient_code.
    
    Args:
        patient_code: Patient identifier (e.g., P001)
        sessions_completed: Optional number of completed sessions (C3D files).
                          If not provided, will attempt to count from storage.
    """
    try:
        from services.clinical.performance_scoring_service import PerformanceScoringService
        
        supabase = get_supabase_client(use_service_key=True)
        
        # Convert patient_code to patient_id (UUID)
        patient_result = (
            supabase.table("patients")
            .select("id, created_at, treatment_start_date, total_sessions_planned")
            .eq("patient_code", patient_code)
            .execute()
        )
        
        if not patient_result.data:
            raise HTTPException(status_code=404, detail=f"Patient not found: {patient_code}")
        
        patient_id = patient_result.data[0]["id"]
        
        # Calculate protocol day based on treatment start date (production-ready with error handling)
        # 
        # IMPORTANT: This uses treatment_start_date from database, not actual session dates
        # For demo data, this may cause date mismatches with C3D file upload dates
        # In production, ensure treatment_start_date matches actual therapy start
        #
        from datetime import datetime, timezone
        import logging
        
        logger = logging.getLogger(__name__)
        
        # Get treatment configuration with proper fallback
        treatment_start_str = patient_result.data[0].get("treatment_start_date")
        if not treatment_start_str:
            logger.warning(f"No treatment_start_date for patient {patient_code}, using created_at as fallback")
            treatment_start_str = patient_result.data[0]["created_at"]
        
        # Get total sessions planned (will be from patients table after migration)
        total_sessions_planned = patient_result.data[0].get("total_sessions_planned", 30)
        
        # Handle various datetime formats from Supabase with timezone safety
        if '+' in treatment_start_str and '.' in treatment_start_str:
            # Fix microseconds if they have too many digits
            parts = treatment_start_str.split('.')
            microsec_and_tz = parts[1].split('+')
            microsec = microsec_and_tz[0][:6].ljust(6, '0')  # Ensure exactly 6 digits
            treatment_start_str = f"{parts[0]}.{microsec}+{microsec_and_tz[1]}"
        
        # Parse datetime and calculate protocol day
        treatment_start = datetime.fromisoformat(treatment_start_str.replace('Z', '+00:00'))
        current_date = datetime.now(timezone.utc)
        days_since_start = (current_date - treatment_start).days + 1
        
        # Cap protocol_day at 14 for the GHOSTLY+ 14-day trial protocol
        # After day 14, patients are considered to have completed the trial period
        protocol_day = min(14, max(1, days_since_start))
        
        # Log if patient is beyond the trial period
        if days_since_start > 14:
            logger.info(f"Patient {patient_code} is beyond 14-day trial period (day {days_since_start}), using day 14 for adherence calculation")
        
        # Use provided sessions_completed or let service count them
        service = PerformanceScoringService()
        adherence_data = service.calculate_adherence_score(
            patient_id, 
            protocol_day,
            sessions_completed=sessions_completed
        )
        
        # Override patient_id with patient_code for frontend compatibility
        adherence_data['patient_id'] = patient_code
        
        # Add protocol day and trial information to response
        adherence_data['protocol_day'] = protocol_day
        adherence_data['trial_duration'] = 14  # 14-day trial period
        adherence_data['total_sessions_planned'] = total_sessions_planned
        
        return adherence_data

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to calculate adherence for patient {patient_code}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
