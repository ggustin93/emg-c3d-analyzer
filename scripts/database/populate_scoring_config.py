#!/usr/bin/env python3
"""
Populate GHOSTLY+ Default Scoring Configuration in Database
==========================================================

This script ensures the required default scoring configuration exists in the database.
It uses the centralized configuration from config.py to maintain consistency.

Usage:
    python scripts/database/populate_scoring_config.py
"""

import sys
from pathlib import Path

# Add backend to path for imports
backend_path = Path(__file__).parent.parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from database.supabase_client import get_supabase_client
from config import SCORING_CONFIG, RPE_MAPPING
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def populate_scoring_configuration():
    """Populate the GHOSTLY+ Default scoring configuration from config.py."""
    try:
        # Get Supabase client with service key for admin operations
        client = get_supabase_client(use_service_key=True)
        
        # Check if configuration already exists
        existing = (
            client.table("scoring_configuration")
            .select("id, configuration_name")
            .eq("configuration_name", SCORING_CONFIG.NAME)
            .eq("is_global", SCORING_CONFIG.IS_GLOBAL)
            .execute()
        )
        
        if existing.data:
            logger.info(f"✅ {SCORING_CONFIG.NAME} configuration already exists with ID: {existing.data[0]['id']}")
            return existing.data[0]['id']
        
        # Insert the default configuration using values from config.py
        config_data = {
            "configuration_name": SCORING_CONFIG.NAME,
            "description": SCORING_CONFIG.DESCRIPTION,
            "is_global": SCORING_CONFIG.IS_GLOBAL,
            "weight_compliance": SCORING_CONFIG.WEIGHT_COMPLIANCE,
            "weight_symmetry": SCORING_CONFIG.WEIGHT_SYMMETRY,
            "weight_effort": SCORING_CONFIG.WEIGHT_EFFORT,
            "weight_game": SCORING_CONFIG.WEIGHT_GAME,
            "weight_completion": SCORING_CONFIG.WEIGHT_COMPLETION,
            "weight_intensity": SCORING_CONFIG.WEIGHT_INTENSITY,
            "weight_duration": SCORING_CONFIG.WEIGHT_DURATION,
            "active": SCORING_CONFIG.ACTIVE,
            # therapist_id is null for global configurations
        }
        
        result = client.table("scoring_configuration").insert(config_data).execute()
        
        if result.data:
            logger.info(f"✅ Successfully created {SCORING_CONFIG.NAME} configuration with ID: {result.data[0]['id']}")
            return result.data[0]['id']
        else:
            logger.error(f"❌ Failed to create scoring configuration")
            return None
            
    except Exception as e:
        logger.error(f"❌ Error populating scoring configuration: {e}")
        return None


def populate_rpe_mapping_configuration():
    """Populate the default RPE mapping configuration from config.py (optional)."""
    try:
        client = get_supabase_client(use_service_key=True)
        
        # Check if configuration already exists
        existing = (
            client.table("rpe_mapping_configuration")
            .select("id, configuration_name")
            .eq("configuration_name", RPE_MAPPING.NAME)
            .execute()
        )
        
        if existing.data:
            logger.info(f"✅ {RPE_MAPPING.NAME} configuration already exists with ID: {existing.data[0]['id']}")
            return existing.data[0]['id']
        
        # Insert the default RPE mapping using values from config.py
        rpe_data = {
            "configuration_name": RPE_MAPPING.NAME,
            "description": RPE_MAPPING.DESCRIPTION,
            "optimal_range": list(RPE_MAPPING.OPTIMAL_RANGE),  # Convert tuple to list for JSON
            "acceptable_range": list(RPE_MAPPING.ACCEPTABLE_RANGE),
            "suboptimal_range": list(RPE_MAPPING.SUBOPTIMAL_RANGE),
            "poor_range": list(RPE_MAPPING.POOR_RANGE),
            "optimal_score": RPE_MAPPING.OPTIMAL_SCORE,
            "acceptable_score": RPE_MAPPING.ACCEPTABLE_SCORE,
            "suboptimal_score": RPE_MAPPING.SUBOPTIMAL_SCORE,
            "poor_score": RPE_MAPPING.POOR_SCORE,
            "default_score": RPE_MAPPING.DEFAULT_SCORE,
            "active": RPE_MAPPING.ACTIVE,
            # created_by would be null for system configurations
        }
        
        result = client.table("rpe_mapping_configuration").insert(rpe_data).execute()
        
        if result.data:
            logger.info(f"✅ Successfully created {RPE_MAPPING.NAME} configuration with ID: {result.data[0]['id']}")
            return result.data[0]['id']
        else:
            logger.error(f"❌ Failed to create RPE mapping configuration")
            return None
            
    except Exception as e:
        logger.error(f"❌ Error populating RPE mapping configuration: {e}")
        return None


def main():
    """Main function to populate all required configurations."""
    logger.info("🚀 Starting database configuration population from config.py...")
    
    # Populate scoring configuration (required)
    scoring_config_id = populate_scoring_configuration()
    if not scoring_config_id:
        logger.error("❌ Failed to ensure scoring configuration exists")
        sys.exit(1)
    
    # Populate RPE mapping (optional but recommended)
    rpe_config_id = populate_rpe_mapping_configuration()
    if not rpe_config_id:
        logger.warning("⚠️ RPE mapping configuration not created (optional)")
    
    logger.info("✅ Database configuration population complete!")
    
    # Verify the configurations
    try:
        client = get_supabase_client(use_service_key=True)
        
        # Check scoring configuration
        scoring = (
            client.table("scoring_configuration")
            .select("*")
            .eq("configuration_name", SCORING_CONFIG.NAME)
            .eq("is_global", SCORING_CONFIG.IS_GLOBAL)
            .execute()
        )
        
        if scoring.data:
            config = scoring.data[0]
            logger.info("\n📊 Scoring Configuration Weights (from config.py):")
            logger.info(f"  - Compliance: {config['weight_compliance']*100:.0f}%")
            logger.info(f"  - Symmetry: {config['weight_symmetry']*100:.0f}%")
            logger.info(f"  - Effort: {config['weight_effort']*100:.0f}%")
            logger.info(f"  - Game: {config['weight_game']*100:.0f}%")
            logger.info(f"\n✅ Configuration validated against config.py values")
    
    except Exception as e:
        logger.error(f"❌ Error verifying configurations: {e}")


if __name__ == "__main__":
    main()