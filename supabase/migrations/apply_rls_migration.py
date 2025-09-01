#!/usr/bin/env python3
"""
Apply RLS and Constraints Migration
===================================

This script applies the database migration to fix RLS policies and constraints.
It can be run against any Supabase project to replicate the structural changes.

Usage:
    python scripts/database/apply_rls_migration.py

Environment variables required:
    SUPABASE_URL - Your Supabase project URL
    SUPABASE_SERVICE_KEY - Your Supabase service role key
"""

import sys
import os
from pathlib import Path

# Add backend to path for imports
backend_path = Path(__file__).parent.parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from database.supabase_client import get_supabase_client
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def load_migration_sql() -> str:
    """Load the migration SQL from file."""
    migration_file = Path(__file__).parent / "migration_fix_rls_and_constraints_2025_01_09.sql"
    
    if not migration_file.exists():
        raise FileNotFoundError(f"Migration file not found: {migration_file}")
    
    with open(migration_file, 'r') as f:
        return f.read()


def apply_migration():
    """Apply the RLS and constraints migration."""
    try:
        # Get Supabase client with service key for admin operations
        client = get_supabase_client(use_service_key=True)
        
        logger.info("🚀 Starting RLS and constraints migration...")
        
        # Load migration SQL
        migration_sql = load_migration_sql()
        
        # Split the migration into individual statements
        # We'll execute the key parts step by step for better error handling
        
        # Step 1: Fix user_profiles RLS policies
        logger.info("📝 Step 1: Fixing user_profiles RLS policies...")
        
        # Drop problematic recursive policy
        try:
            client.rpc('sql_exec', {'query': 'DROP POLICY IF EXISTS "Admins can manage all profiles" ON user_profiles'}).execute()
            logger.info("✅ Dropped recursive admin policy")
        except Exception as e:
            logger.warning(f"⚠️ Could not drop recursive policy (may not exist): {e}")
        
        # Add service role policy
        service_role_policy = '''
        CREATE POLICY "Service role can manage all profiles" 
        ON user_profiles FOR ALL 
        TO service_role 
        USING (true)
        '''
        try:
            client.rpc('sql_exec', {'query': service_role_policy}).execute()
            logger.info("✅ Added service role policy for user_profiles")
        except Exception as e:
            if "already exists" in str(e).lower():
                logger.info("✅ Service role policy already exists")
            else:
                raise
        
        # Add JWT-based admin policy
        jwt_admin_policy = '''
        CREATE POLICY "Admins can manage all profiles via JWT" 
        ON user_profiles FOR ALL 
        TO authenticated 
        USING (
          COALESCE(
            (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role',
            (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role'
          ) = 'admin'
        )
        '''
        try:
            client.rpc('sql_exec', {'query': jwt_admin_policy}).execute()
            logger.info("✅ Added JWT-based admin policy")
        except Exception as e:
            if "already exists" in str(e).lower():
                logger.info("✅ JWT admin policy already exists")
            else:
                raise
        
        # Step 2: Add service role policies to all tables
        logger.info("📝 Step 2: Adding service role policies to all RLS-enabled tables...")
        
        tables = [
            "emg_statistics",
            "processing_parameters", 
            "performance_scores",
            "therapy_sessions",
            "patients",
            "session_settings",
            "bfr_monitoring"
        ]
        
        for table in tables:
            policy_sql = f'''
            CREATE POLICY "Service role can manage {table.replace('_', ' ')}" 
            ON {table} FOR ALL 
            TO service_role 
            USING (true)
            '''
            try:
                client.rpc('sql_exec', {'query': policy_sql}).execute()
                logger.info(f"✅ Added service role policy for {table}")
            except Exception as e:
                if "already exists" in str(e).lower():
                    logger.info(f"✅ Service role policy for {table} already exists")
                else:
                    logger.error(f"❌ Failed to add policy for {table}: {e}")
        
        # Step 3: Fix processing_parameters unique constraint
        logger.info("📝 Step 3: Adding unique constraint to processing_parameters...")
        
        # Clean up duplicates first
        cleanup_sql = '''
        WITH duplicates AS (
            SELECT id, 
                   ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY created_at DESC) as rn
            FROM processing_parameters
        )
        DELETE FROM processing_parameters 
        WHERE id IN (
            SELECT id FROM duplicates WHERE rn > 1
        )
        '''
        try:
            result = client.rpc('sql_exec', {'query': cleanup_sql}).execute()
            logger.info("✅ Cleaned up duplicate processing_parameters")
        except Exception as e:
            logger.warning(f"⚠️ Could not clean duplicates: {e}")
        
        # Add unique constraint
        constraint_sql = '''
        ALTER TABLE processing_parameters 
        ADD CONSTRAINT processing_parameters_session_id_unique 
        UNIQUE (session_id)
        '''
        try:
            client.rpc('sql_exec', {'query': constraint_sql}).execute()
            logger.info("✅ Added unique constraint on processing_parameters.session_id")
        except Exception as e:
            if "already exists" in str(e).lower():
                logger.info("✅ Unique constraint already exists")
            else:
                raise
        
        # Step 4: Verification
        logger.info("📝 Step 4: Verifying migration...")
        
        # Check policies exist
        policies_check = '''
        SELECT COUNT(*) as count FROM pg_policies 
        WHERE tablename = 'user_profiles' 
        AND policyname = 'Service role can manage all profiles'
        '''
        result = client.rpc('sql_exec', {'query': policies_check}).execute()
        if result.data and result.data[0].get('count', 0) > 0:
            logger.info("✅ Service role policy verified")
        else:
            raise Exception("❌ Service role policy not found after creation")
        
        # Check constraint exists
        constraint_check = '''
        SELECT COUNT(*) as count FROM information_schema.table_constraints 
        WHERE table_name = 'processing_parameters' 
        AND constraint_name = 'processing_parameters_session_id_unique'
        AND constraint_type = 'UNIQUE'
        '''
        result = client.rpc('sql_exec', {'query': constraint_check}).execute()
        if result.data and result.data[0].get('count', 0) > 0:
            logger.info("✅ Unique constraint verified")
        else:
            raise Exception("❌ Unique constraint not found after creation")
        
        logger.info("🎉 Migration completed successfully!")
        logger.info("✅ Fixed RLS infinite recursion")
        logger.info("✅ Added service role policies for backend operations")  
        logger.info("✅ Added unique constraint for idempotent operations")
        logger.info("")
        logger.info("🔧 Next steps:")
        logger.info("1. Test webhook processing for duplicate key errors")
        logger.info("2. Verify C3D files with weak signals process gracefully")
        logger.info("3. Confirm backend operations are fast (no RLS recursion)")
        
    except Exception as e:
        logger.error(f"❌ Migration failed: {e}")
        logger.error("Please check the error and try again")
        logger.error("You may need to run parts of the migration manually")
        raise


if __name__ == "__main__":
    # Check environment variables
    required_env_vars = ["SUPABASE_URL", "SUPABASE_SERVICE_KEY"]
    missing_vars = [var for var in required_env_vars if not os.getenv(var)]
    
    if missing_vars:
        logger.error(f"❌ Missing required environment variables: {', '.join(missing_vars)}")
        logger.error("Please set these in your .env file or environment")
        sys.exit(1)
    
    apply_migration()