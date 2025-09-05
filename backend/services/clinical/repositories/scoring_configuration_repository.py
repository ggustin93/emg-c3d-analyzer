"""Scoring Configuration Repository - Clean access to scoring config database operations."""

import logging
from typing import Optional
from uuid import UUID

from database.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)


class ScoringConfigurationRepository:
    """Repository for scoring configuration database operations.
    
    Provides a clean interface to database functions and tables related to scoring.
    This follows the repository pattern to isolate database logic from business logic.
    """
    
    def __init__(self, supabase_client=None):
        """Initialize repository with Supabase client."""
        self.client = supabase_client or get_supabase_client(use_service_key=True)
    
    def get_session_scoring_config(
        self, 
        session_id: Optional[str] = None, 
        patient_id: Optional[str] = None
    ) -> Optional[str]:
        """Get appropriate scoring configuration for a session.
        
        This wraps the database function get_session_scoring_config() which implements
        the priority hierarchy:
        1. Session's immutable scoring_config_id (historical accuracy)
        2. Patient's current_scoring_config_id (for new sessions)  
        3. Global GHOSTLY-TRIAL-DEFAULT configuration
        4. Any active configuration as last resort
        
        Args:
            session_id: The therapy session UUID
            patient_id: The patient's UUID (used if session doesn't have config)
            
        Returns:
            Scoring configuration UUID or None if error/not found
        """
        try:
            result = self.client.rpc(
                "get_session_scoring_config",
                {
                    "p_session_id": session_id,
                    "p_patient_id": patient_id
                }
            ).execute()
            
            if result.data:
                logger.debug(f"Retrieved scoring config {result.data} for session {session_id or 'new'}")
                return result.data
            
            logger.warning(f"No scoring config found for session={session_id}, patient={patient_id}")
            return None
            
        except Exception as e:
            logger.exception(f"Error calling get_session_scoring_config: {e}")
            return None
    
    def get_default_scoring_config(self) -> Optional[dict]:
        """Get the default GHOSTLY-TRIAL-DEFAULT configuration.
        
        Returns:
            Dictionary with scoring configuration or None if not found
        """
        try:
            result = self.client.table("scoring_configuration").select("*").eq(
                "name", "GHOSTLY-TRIAL-DEFAULT"
            ).eq("active", True).limit(1).execute()
            
            if result.data:
                return result.data[0]
            
            logger.warning("No GHOSTLY-TRIAL-DEFAULT configuration found")
            return None
            
        except Exception as e:
            logger.exception(f"Error fetching default scoring config: {e}")
            return None
    
    def get_scoring_config_by_id(self, config_id: str) -> Optional[dict]:
        """Get a specific scoring configuration by ID.
        
        Args:
            config_id: The scoring configuration UUID
            
        Returns:
            Dictionary with scoring configuration or None if not found
        """
        try:
            result = self.client.table("scoring_configuration").select("*").eq(
                "id", config_id
            ).limit(1).execute()
            
            if result.data:
                return result.data[0]
            
            logger.warning(f"No scoring configuration found with id={config_id}")
            return None
            
        except Exception as e:
            logger.exception(f"Error fetching scoring config {config_id}: {e}")
            return None
    
    def create_scoring_config(self, config_data: dict) -> Optional[str]:
        """Create a new scoring configuration.
        
        Args:
            config_data: Dictionary with scoring configuration data
            
        Returns:
            UUID of created configuration or None if error
        """
        try:
            result = self.client.table("scoring_configuration").insert(config_data).execute()
            
            if result.data:
                logger.info(f"Created scoring configuration: {result.data[0]['id']}")
                return result.data[0]["id"]
            
            logger.error("Failed to create scoring configuration")
            return None
            
        except Exception as e:
            logger.exception(f"Error creating scoring config: {e}")
            return None
    
    def update_patient_scoring_config(
        self, 
        patient_id: str, 
        scoring_config_id: str
    ) -> bool:
        """Update a patient's current scoring configuration.
        
        Args:
            patient_id: The patient UUID
            scoring_config_id: The new scoring configuration UUID
            
        Returns:
            True if successful, False otherwise
        """
        try:
            result = self.client.table("patients").update({
                "current_scoring_config_id": scoring_config_id
            }).eq("id", patient_id).execute()
            
            if result.data:
                logger.info(f"Updated patient {patient_id} scoring config to {scoring_config_id}")
                return True
            
            logger.warning(f"No patient found with id={patient_id}")
            return False
            
        except Exception as e:
            logger.exception(f"Error updating patient scoring config: {e}")
            return False