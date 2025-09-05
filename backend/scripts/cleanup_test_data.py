#!/usr/bin/env python3
"""
Manual Test Data Cleanup Script
================================

Use this script to clean up test data from the database
when you need to reset to a clean state for testing.

IMPORTANT: This will DELETE all therapy sessions and related data!
Only the default scoring configuration will be preserved.

Usage:
    python scripts/cleanup_test_data.py [--confirm]
"""

import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from database.supabase_client import get_supabase_client


def cleanup_test_data(confirm=False):
    """Clean up all test data from the database."""
    
    print("=" * 60)
    print("📧 TEST DATA CLEANUP SCRIPT")
    print("=" * 60)
    
    if not confirm:
        print("\n⚠️  WARNING: This will DELETE all therapy sessions and related data!")
        print("   Only the default scoring configuration will be preserved.")
        print("\n   To confirm, run with --confirm flag:")
        print("   python scripts/cleanup_test_data.py --confirm")
        return
    
    print("\n🧹 Starting cleanup...")
    
    try:
        # Get Supabase client with service key for admin access
        client = get_supabase_client(use_service_key=True)
        
        # Track what we delete
        deleted_counts = {}
        
        # Step 1: Delete child tables first (foreign key constraints)
        tables_to_clean = [
            "performance_scores",
            "emg_statistics", 
            "bfr_monitoring",
            "session_settings",
            "therapy_sessions"  # Parent table last
        ]
        
        for table in tables_to_clean:
            try:
                # Delete all records from the table
                result = client.table(table).delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
                count = len(result.data) if result.data else 0
                deleted_counts[table] = count
                print(f"   ✅ Deleted {count} records from {table}")
            except Exception as e:
                print(f"   ⚠️  Error cleaning {table}: {e}")
                deleted_counts[table] = 0
        
        # Step 2: Clean up test scoring configurations
        # Keep only the default GHOSTLY-TRIAL-DEFAULT configuration
        try:
            result = client.table("scoring_configuration").delete().neq(
                "id", "a0000000-0000-0000-0000-000000000001"
            ).execute()
            count = len(result.data) if result.data else 0
            deleted_counts["scoring_configuration"] = count
            print(f"   ✅ Deleted {count} test scoring configurations")
        except Exception as e:
            print(f"   ⚠️  Error cleaning scoring_configuration: {e}")
        
        # Step 3: Ensure the default trial configuration is active
        try:
            client.table("scoring_configuration").update({
                "active": True
            }).eq("id", "a0000000-0000-0000-0000-000000000001").execute()
            print("   ✅ Activated default GHOSTLY-TRIAL-DEFAULT configuration")
        except Exception as e:
            print(f"   ⚠️  Error activating default configuration: {e}")
        
        # Step 4: Show summary
        print("\n" + "=" * 60)
        print("📊 CLEANUP SUMMARY")
        print("=" * 60)
        
        total_deleted = sum(deleted_counts.values())
        print(f"\n   Total records deleted: {total_deleted}")
        print("\n   Details by table:")
        for table, count in deleted_counts.items():
            print(f"   - {table}: {count} records")
        
        # Verify final state
        print("\n" + "=" * 60)
        print("✅ FINAL DATABASE STATE")
        print("=" * 60)
        
        remaining_tables = [
            "therapy_sessions",
            "emg_statistics",
            "performance_scores",
            "bfr_monitoring",
            "session_settings",
            "scoring_configuration"
        ]
        
        for table in remaining_tables:
            try:
                result = client.table(table).select("id", count="exact").execute()
                # Get the count from the response
                if hasattr(result, 'count'):
                    count = result.count
                else:
                    count = len(result.data) if result.data else 0
                print(f"   {table}: {count} records remaining")
            except Exception as e:
                print(f"   {table}: Error checking - {e}")
        
        print("\n🎉 Cleanup completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Error during cleanup: {e}")
        sys.exit(1)


if __name__ == "__main__":
    # Check for --confirm flag
    confirm = "--confirm" in sys.argv
    cleanup_test_data(confirm)