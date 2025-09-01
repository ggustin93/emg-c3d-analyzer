#!/usr/bin/env python3
"""
Populate GHOSTLY+ Default Scoring Configuration in Database
==========================================================

This script ensures the required default scoring configuration exists in the database.
It's needed for the performance scoring service to function properly.

Usage:
    python scripts/database/populate_scoring_config.py
"""

import os
import sys
from pathlib import Path

# Add backend to path for imports
backend_path = Path(__file__).parent.parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from database.supabase_client import get_supabase_client
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def populate_scoring_configuration():
    """Populate the GHOSTLY+ Default scoring configuration."""
    try:
        # Get Supabase client with service key for admin operations
        client = get_supabase_client(use_service_key=True)
        
        # Check if configuration already exists
        existing = (
            client.table("scoring_configuration")
            .select("id, configuration_name")
            .eq("configuration_name", "GHOSTLY+ Default")
            .eq("is_global", True)
            .execute()
        )
        
        if existing.data:
            logger.info(f"✅ GHOSTLY+ Default configuration already exists with ID: {existing.data[0]['id']}")
            return existing.data[0]['id']
        
        # Insert the default configuration
        config_data = {
            "configuration_name": "GHOSTLY+ Default",
            "description": "Default scoring configuration for GHOSTLY+ protocol with balanced weights across all performance dimensions",
            "is_global": True,
            "weight_compliance": 0.40,  # 40%
            "weight_symmetry": 0.25,    # 25%
            "weight_effort": 0.20,       # 20%
            "weight_game": 0.15,         # 15%
            "weight_completion": 0.333,  # 33.3%
            "weight_intensity": 0.333,   # 33.3%
            "weight_duration": 0.334,    # 33.4%
            "created_by": "00000000-0000-0000-0000-000000000000"  # System user
        }
        
        result = client.table("scoring_configuration").insert(config_data).execute()
        
        if result.data:
            logger.info(f"✅ Successfully created GHOSTLY+ Default configuration with ID: {result.data[0]['id']}")
            return result.data[0]['id']
        else:
            logger.error("❌ Failed to create scoring configuration")
            return None
            
    except Exception as e:
        logger.error(f"❌ Error populating scoring configuration: {e}")
        return None


def populate_rpe_mapping_configuration():
    """Populate the default RPE mapping configuration (optional)."""
    try:
        client = get_supabase_client(use_service_key=True)
        
        # Check if configuration already exists
        existing = (
            client.table("rpe_mapping_configuration")
            .select("id, configuration_name")
            .eq("configuration_name", "GHOSTLY+ Default RPE")
            .execute()
        )
        
        if existing.data:
            logger.info(f"✅ GHOSTLY+ Default RPE configuration already exists with ID: {existing.data[0]['id']}")
            return existing.data[0]['id']
        
        # Insert the default RPE mapping
        rpe_data = {
            "configuration_name": "GHOSTLY+ Default RPE",
            "description": "Default RPE mapping for GHOSTLY+ protocol based on modified Borg scale",
            "optimal_range": [4, 5, 6],      # Moderate effort
            "acceptable_range": [3, 7],      # Slightly easier or harder
            "suboptimal_range": [2, 8],      # Too easy or too hard
            "poor_range": [0, 1, 9, 10],     # Extremely easy or extremely hard
            "optimal_score": 100.0,
            "acceptable_score": 80.0,
            "suboptimal_score": 60.0,
            "poor_score": 20.0,
            "default_score": 50.0,
            "active": False,  # Inactive by default
            "created_by": "00000000-0000-0000-0000-000000000000"  # System user
        }
        
        result = client.table("rpe_mapping_configuration").insert(rpe_data).execute()
        
        if result.data:
            logger.info(f"✅ Successfully created GHOSTLY+ Default RPE configuration with ID: {result.data[0]['id']}")
            return result.data[0]['id']
        else:
            logger.error("❌ Failed to create RPE mapping configuration")
            return None
            
    except Exception as e:
        logger.error(f"❌ Error populating RPE mapping configuration: {e}")
        return None


def main():
    """Main function to populate all required configurations."""
    logger.info("🚀 Starting database configuration population...")
    
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
            .eq("configuration_name", "GHOSTLY+ Default")
            .eq("is_global", True)
            .execute()
        )
        
        if scoring.data:
            config = scoring.data[0]
            logger.info("\n📊 Scoring Configuration Weights:")
            logger.info(f"  - Compliance: {config['weight_compliance']*100:.0f}%")
            logger.info(f"  - Symmetry: {config['weight_symmetry']*100:.0f}%")
            logger.info(f"  - Effort: {config['weight_effort']*100:.0f}%")
            logger.info(f"  - Game: {config['weight_game']*100:.0f}%")
    
    except Exception as e:
        logger.error(f"❌ Error verifying configurations: {e}")


if __name__ == "__main__":
    main()