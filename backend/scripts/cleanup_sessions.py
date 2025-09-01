#!/usr/bin/env python3
"""Cleanup Script - Therapy Sessions Management
=============================================

Provides safe cleanup operations for therapy sessions and related data.
Includes multiple cleanup strategies with safety checks.

Features:
- Safe cleanup with confirmation prompts
- Multiple cleanup strategies (by patient, by date, by status)
- Cascade deletion of related data (EMG statistics, performance scores)
- Backup creation before deletion
- Dry-run mode for testing

Usage:
    python scripts/cleanup_sessions.py [--strategy] [--dry-run] [--force]
"""

import asyncio
import logging
import argparse
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional
import sys

# Add backend to Python path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from database.supabase_client import get_supabase_client

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('cleanup_sessions.log')
    ]
)
logger = logging.getLogger(__name__)

class TherapySessionCleaner:
    """Safe cleanup utility for therapy sessions and related data."""
    
    def __init__(self, dry_run: bool = False, force: bool = False):
        """Initialize the cleaner with safety options."""
        self.dry_run = dry_run
        self.force = force
        self.supabase = get_supabase_client(use_service_key=True)
        
        # Statistics tracking
        self.stats = {
            "sessions_found": 0,
            "sessions_deleted": 0,
            "emg_stats_deleted": 0,
            "performance_scores_deleted": 0,
            "errors": 0
        }
    
    async def cleanup_by_status(self, status: str = "failed") -> None:
        """Clean up sessions by processing status.
        
        Args:
            status: Processing status to clean up (failed, pending, etc.)
        """
        logger.info(f"🧹 Cleaning up sessions with status: {status}")
        
        try:
            # Find sessions with specified status
            sessions_response = self.supabase.table("therapy_sessions").select(
                "id, file_path, processing_status, created_at, patient_id"
            ).eq("processing_status", status).execute()
            
            sessions = sessions_response.data
            self.stats["sessions_found"] = len(sessions)
            
            if not sessions:
                logger.info(f"✅ No sessions found with status '{status}'")
                return
            
            logger.info(f"📊 Found {len(sessions)} sessions with status '{status}'")
            
            # Show preview
            self._preview_sessions(sessions)
            
            # Confirm deletion
            if not self._confirm_deletion(f"sessions with status '{status}'"):
                return
            
            # Delete sessions
            await self._delete_sessions([s["id"] for s in sessions])
            
        except Exception as e:
            logger.error(f"❌ Cleanup by status failed: {e}")
            raise
    
    async def cleanup_by_patient(self, patient_code: str) -> None:
        """Clean up all sessions for a specific patient.
        
        Args:
            patient_code: Patient code (e.g., P001, P039)
        """
        logger.info(f"🧹 Cleaning up sessions for patient: {patient_code}")
        
        try:
            # Find sessions for patient (check both resolved_patient_id and file_path)
            sessions_response = self.supabase.table("therapy_sessions").select(
                "id, file_path, processing_status, created_at, resolved_patient_id"
            ).or_(
                f"resolved_patient_id.eq.{patient_code},file_path.like.%/{patient_code}/%"
            ).execute()
            
            sessions = sessions_response.data
            self.stats["sessions_found"] = len(sessions)
            
            if not sessions:
                logger.info(f"✅ No sessions found for patient '{patient_code}'")
                return
            
            logger.info(f"📊 Found {len(sessions)} sessions for patient '{patient_code}'")
            
            # Show preview
            self._preview_sessions(sessions)
            
            # Confirm deletion
            if not self._confirm_deletion(f"sessions for patient '{patient_code}'"):
                return
            
            # Delete sessions
            await self._delete_sessions([s["id"] for s in sessions])
            
        except Exception as e:
            logger.error(f"❌ Cleanup by patient failed: {e}")
            raise
    
    async def cleanup_by_date_range(self, days_old: int = 30) -> None:
        """Clean up sessions older than specified days.
        
        Args:
            days_old: Delete sessions older than this many days
        """
        cutoff_date = datetime.utcnow() - timedelta(days=days_old)
        cutoff_iso = cutoff_date.isoformat()
        
        logger.info(f"🧹 Cleaning up sessions older than {days_old} days ({cutoff_date.date()})")
        
        try:
            # Find old sessions
            sessions_response = self.supabase.table("therapy_sessions").select(
                "id, file_path, processing_status, created_at, resolved_patient_id"
            ).lt("created_at", cutoff_iso).execute()
            
            sessions = sessions_response.data
            self.stats["sessions_found"] = len(sessions)
            
            if not sessions:
                logger.info(f"✅ No sessions found older than {days_old} days")
                return
            
            logger.info(f"📊 Found {len(sessions)} sessions older than {days_old} days")
            
            # Show preview
            self._preview_sessions(sessions)
            
            # Confirm deletion
            if not self._confirm_deletion(f"sessions older than {days_old} days"):
                return
            
            # Delete sessions
            await self._delete_sessions([s["id"] for s in sessions])
            
        except Exception as e:
            logger.error(f"❌ Cleanup by date failed: {e}")
            raise
    
    async def cleanup_test_data(self) -> None:
        """Clean up test data and populated sessions."""
        logger.info("🧹 Cleaning up test data and populated sessions")
        
        try:
            # Find test sessions (by metadata or file paths)
            test_conditions = [
                "file_path.like.%test_%",
                "file_path.like.%Test_%",
                "original_filename.like.%test_%",
                "game_metadata->>populated_by.eq.smart_population_script"
            ]
            
            all_test_sessions = []
            
            for condition in test_conditions:
                try:
                    response = self.supabase.table("therapy_sessions").select(
                        "id, file_path, processing_status, created_at, resolved_patient_id, original_filename"
                    ).filter(condition.split('.')[0], condition.split('.')[1], condition.split('.')[2]).execute()
                    
                    all_test_sessions.extend(response.data)
                except Exception as e:
                    logger.debug(f"Query condition failed (expected): {condition} - {e}")
            
            # Remove duplicates by ID
            seen_ids = set()
            unique_sessions = []
            for session in all_test_sessions:
                if session["id"] not in seen_ids:
                    seen_ids.add(session["id"])
                    unique_sessions.append(session)
            
            sessions = unique_sessions
            self.stats["sessions_found"] = len(sessions)
            
            if not sessions:
                logger.info("✅ No test data found")
                return
            
            logger.info(f"📊 Found {len(sessions)} test/populated sessions")
            
            # Show preview
            self._preview_sessions(sessions)
            
            # Confirm deletion
            if not self._confirm_deletion("test data and populated sessions"):
                return
            
            # Delete sessions
            await self._delete_sessions([s["id"] for s in sessions])
            
        except Exception as e:
            logger.error(f"❌ Test data cleanup failed: {e}")
            raise
    
    async def _delete_sessions(self, session_ids: List[str]) -> None:
        """Delete sessions and related data safely.
        
        Args:
            session_ids: List of session IDs to delete
        """
        if not session_ids:
            return
        
        logger.info(f"🗑️ Deleting {len(session_ids)} sessions and related data...")
        
        if self.dry_run:
            logger.info("🧪 DRY RUN: Would delete the following:")
            for session_id in session_ids:
                logger.info(f"  - Session: {session_id}")
            self.stats["sessions_deleted"] = len(session_ids)
            return
        
        try:
            # Create backup before deletion
            await self._create_backup(session_ids)
            
            # Delete related data first (cascade)
            await self._delete_related_data(session_ids)
            
            # Delete main sessions
            delete_response = self.supabase.table("therapy_sessions").delete().in_(
                "id", session_ids
            ).execute()
            
            deleted_count = len(delete_response.data) if delete_response.data else 0
            self.stats["sessions_deleted"] = deleted_count
            
            logger.info(f"✅ Deleted {deleted_count} therapy sessions")
            
        except Exception as e:
            logger.error(f"❌ Session deletion failed: {e}")
            self.stats["errors"] += 1
            raise
    
    async def _delete_related_data(self, session_ids: List[str]) -> None:
        """Delete data related to sessions (EMG stats, performance scores, etc.).
        
        Args:
            session_ids: List of session IDs
        """
        try:
            # Delete EMG statistics
            emg_response = self.supabase.table("emg_statistics").delete().in_(
                "session_id", session_ids
            ).execute()
            
            emg_deleted = len(emg_response.data) if emg_response.data else 0
            self.stats["emg_stats_deleted"] = emg_deleted
            logger.info(f"🗑️ Deleted {emg_deleted} EMG statistics records")
            
            # Delete performance scores
            try:
                perf_response = self.supabase.table("performance_scores").delete().in_(
                    "session_id", session_ids
                ).execute()
                
                perf_deleted = len(perf_response.data) if perf_response.data else 0
                self.stats["performance_scores_deleted"] = perf_deleted
                logger.info(f"🗑️ Deleted {perf_deleted} performance score records")
            except Exception as e:
                logger.debug(f"Performance scores table may not exist: {e}")
            
            # Delete processing parameters (if table exists)
            try:
                self.supabase.table("processing_parameters").delete().in_(
                    "session_id", session_ids
                ).execute()
                logger.debug("🗑️ Deleted processing parameters")
            except Exception as e:
                logger.debug(f"Processing parameters table may not exist: {e}")
            
        except Exception as e:
            logger.warning(f"⚠️ Some related data deletion failed: {e}")
    
    async def _create_backup(self, session_ids: List[str]) -> None:
        """Create backup of sessions before deletion.
        
        Args:
            session_ids: List of session IDs to backup
        """
        try:
            # Get full session data
            backup_response = self.supabase.table("therapy_sessions").select("*").in_(
                "id", session_ids
            ).execute()
            
            backup_data = {
                "backup_created": datetime.utcnow().isoformat(),
                "session_count": len(session_ids),
                "sessions": backup_response.data
            }
            
            # Save backup file
            backup_filename = f"session_backup_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
            backup_path = Path(__file__).parent / backup_filename
            
            with open(backup_path, 'w') as f:
                json.dump(backup_data, f, indent=2, default=str)
            
            logger.info(f"💾 Backup created: {backup_filename}")
            
        except Exception as e:
            logger.warning(f"⚠️ Backup creation failed: {e}")
    
    def _preview_sessions(self, sessions: List[Dict]) -> None:
        """Show preview of sessions to be deleted.
        
        Args:
            sessions: List of session dictionaries
        """
        logger.info("\n" + "📋 SESSIONS TO DELETE:" + "\n" + "-" * 50)
        
        for session in sessions[:10]:  # Show first 10
            patient_id = session.get("resolved_patient_id", "Unknown")
            file_path = session.get("file_path", "")
            status = session.get("processing_status", "unknown")
            created = session.get("created_at", "")[:10]  # Date only
            
            logger.info(f"  {patient_id} | {status:10} | {created} | {file_path}")
        
        if len(sessions) > 10:
            logger.info(f"  ... and {len(sessions) - 10} more sessions")
        
        logger.info("-" * 50)
    
    def _confirm_deletion(self, description: str) -> bool:
        """Confirm deletion with user prompt.
        
        Args:
            description: Description of what will be deleted
            
        Returns:
            True if user confirms deletion
        """
        if self.force:
            logger.info(f"🔥 FORCE mode: Proceeding with deletion of {description}")
            return True
        
        if self.dry_run:
            return True
        
        print(f"\n⚠️  WARNING: About to DELETE {description}")
        print("This action cannot be undone!")
        
        while True:
            response = input("Continue? (yes/no): ").strip().lower()
            if response in ['yes', 'y']:
                return True
            elif response in ['no', 'n']:
                logger.info("❌ Deletion cancelled by user")
                return False
            else:
                print("Please enter 'yes' or 'no'")
    
    def _print_summary(self) -> None:
        """Print cleanup summary."""
        logger.info("\n" + "="*60)
        logger.info("🧹 CLEANUP SUMMARY")
        logger.info("="*60)
        logger.info(f"📊 Sessions found: {self.stats['sessions_found']}")
        logger.info(f"🗑️ Sessions deleted: {self.stats['sessions_deleted']}")
        logger.info(f"📈 EMG stats deleted: {self.stats['emg_stats_deleted']}")
        logger.info(f"⭐ Performance scores deleted: {self.stats['performance_scores_deleted']}")
        logger.info(f"❌ Errors: {self.stats['errors']}")
        logger.info("="*60)

async def main():
    """Main entry point for the cleanup script."""
    parser = argparse.ArgumentParser(
        description="Cleanup therapy sessions and related data"
    )
    parser.add_argument(
        "--strategy", 
        choices=["status", "patient", "date", "test-data"],
        default="test-data",
        help="Cleanup strategy to use"
    )
    parser.add_argument(
        "--dry-run", 
        action="store_true", 
        help="Preview what would be deleted without making changes"
    )
    parser.add_argument(
        "--force", 
        action="store_true", 
        help="Skip confirmation prompts (dangerous!)"
    )
    parser.add_argument(
        "--status", 
        default="failed",
        help="Status to clean up (for status strategy)"
    )
    parser.add_argument(
        "--patient", 
        help="Patient code to clean up (for patient strategy)"
    )
    parser.add_argument(
        "--days-old", 
        type=int,
        default=30,
        help="Days old for date cleanup (default: 30)"
    )
    
    args = parser.parse_args()
    
    # Initialize cleaner
    cleaner = TherapySessionCleaner(dry_run=args.dry_run, force=args.force)
    
    try:
        # Execute cleanup strategy
        if args.strategy == "status":
            await cleaner.cleanup_by_status(args.status)
        elif args.strategy == "patient":
            if not args.patient:
                logger.error("❌ --patient required for patient strategy")
                sys.exit(1)
            await cleaner.cleanup_by_patient(args.patient)
        elif args.strategy == "date":
            await cleaner.cleanup_by_date_range(args.days_old)
        elif args.strategy == "test-data":
            await cleaner.cleanup_test_data()
        
        # Print summary
        cleaner._print_summary()
        
    except KeyboardInterrupt:
        logger.info("⏹️ Cleanup interrupted by user")
    except Exception as e:
        logger.error(f"❌ Cleanup failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    # Check if running in backend directory
    if not Path("config.py").exists():
        print("❌ Error: Must run from backend directory")
        print("💡 Usage: cd backend && python scripts/cleanup_sessions.py")
        sys.exit(1)
    
    # Run the async main function
    asyncio.run(main())