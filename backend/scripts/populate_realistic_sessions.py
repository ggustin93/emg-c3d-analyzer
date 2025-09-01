#!/usr/bin/env python3
"""Smart Population Script - Realistic Therapy Sessions
=====================================================

Automatically discovers existing patient subfolders in Supabase Storage 
and populates therapy sessions for C3D files not yet in the database.

Features:
- Smart duplicate detection (avoids re-processing existing files)
- Automatic patient subfolder discovery (P001/, P002/, etc.)
- Progress tracking with detailed logging
- Realistic session distribution across patients
- Proper error handling and recovery

Usage:
    python scripts/populate_realistic_sessions.py [--dry-run] [--max-sessions 63]
"""

import asyncio
import logging
import hashlib
import argparse
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional
import sys
import os

# Add backend to Python path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from database.supabase_client import get_supabase_client
from services.data.metadata_service import MetadataService
from services.clinical.repositories.patient_repository import PatientRepository
from services.clinical.therapy_session_processor import TherapySessionProcessor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('populate_sessions.log')
    ]
)
logger = logging.getLogger(__name__)

class SmartSessionPopulator:
    """Smart population engine for realistic therapy sessions."""
    
    def __init__(self, dry_run: bool = False):
        """Initialize the populator with required services."""
        self.dry_run = dry_run
        self.supabase = get_supabase_client(use_service_key=True)
        self.metadata_service = MetadataService()
        self.patient_repo = PatientRepository(self.supabase)
        self.session_processor = TherapySessionProcessor()
        
        # Statistics tracking
        self.stats = {
            "patients_discovered": 0,
            "files_discovered": 0,
            "files_already_processed": 0,
            "sessions_created": 0,
            "sessions_processed": 0,
            "errors": 0
        }
    
    async def discover_storage_structure(self) -> Dict[str, List[Dict[str, Any]]]:
        """Discover existing patient subfolders and their C3D files.
        
        Returns:
            Dict mapping patient codes to list of file metadata
        """
        logger.info("🔍 Discovering patient subfolders in Supabase Storage...")
        
        try:
            # List all objects in c3d-examples bucket
            storage_response = self.supabase.storage.from_("c3d-examples").list()
            
            if hasattr(storage_response, 'error') and storage_response.error:
                raise Exception(f"Storage access error: {storage_response.error}")
            
            # Group files by patient subfolder
            patient_files = {}
            
            for item in storage_response:
                # Handle both file objects and folder objects
                file_path = item.get('name', '')
                
                if not file_path:
                    continue
                
                # Check if it's in a patient subfolder (P###/)
                path_parts = file_path.split('/')
                if len(path_parts) >= 2 and path_parts[0].startswith('P') and len(path_parts[0]) == 4:
                    patient_code = path_parts[0]
                    filename = path_parts[-1]
                    
                    # Only include C3D files
                    if filename.lower().endswith('.c3d'):
                        if patient_code not in patient_files:
                            patient_files[patient_code] = []
                        
                        patient_files[patient_code].append({
                            'file_path': file_path,
                            'filename': filename,
                            'size': item.get('metadata', {}).get('size', 0),
                            'created_at': item.get('created_at'),
                            'updated_at': item.get('updated_at')
                        })
            
            self.stats["patients_discovered"] = len(patient_files)
            self.stats["files_discovered"] = sum(len(files) for files in patient_files.values())
            
            logger.info(f"📁 Discovered {len(patient_files)} patient subfolders")
            logger.info(f"📄 Found {self.stats['files_discovered']} C3D files total")
            
            # Sort patients for consistent processing
            for patient_code in patient_files:
                patient_files[patient_code].sort(key=lambda x: x['filename'])
            
            return dict(sorted(patient_files.items()))
            
        except Exception as e:
            logger.error(f"❌ Failed to discover storage structure: {e}")
            raise
    
    async def check_existing_sessions(self, file_paths: List[str]) -> List[str]:
        """Check which files are already processed in the database.
        
        Args:
            file_paths: List of file paths to check
            
        Returns:
            List of file paths that are NOT yet processed
        """
        logger.info(f"🔍 Checking for existing sessions ({len(file_paths)} files)...")
        
        try:
            # Query therapy_sessions for existing file paths
            bucket_paths = [f"c3d-examples/{path}" for path in file_paths]
            
            # Batch query to avoid too many individual requests
            existing_response = self.supabase.table("therapy_sessions").select(
                "file_path"
            ).in_("file_path", bucket_paths).execute()
            
            existing_paths = {item["file_path"] for item in existing_response.data}
            
            # Filter out already processed files
            unprocessed_files = []
            for path in file_paths:
                bucket_path = f"c3d-examples/{path}"
                if bucket_path not in existing_paths:
                    unprocessed_files.append(path)
                else:
                    self.stats["files_already_processed"] += 1
            
            logger.info(f"✅ Found {len(existing_paths)} already processed files")
            logger.info(f"🆕 Need to process {len(unprocessed_files)} new files")
            
            return unprocessed_files
            
        except Exception as e:
            logger.error(f"❌ Failed to check existing sessions: {e}")
            # If check fails, assume all files need processing (safer)
            return file_paths
    
    def _calculate_file_hash(self, file_data: bytes) -> str:
        """Calculate SHA-256 hash of file content."""
        return hashlib.sha256(file_data).hexdigest()
    
    async def populate_sessions(self, max_sessions: int = 63) -> None:
        """Main population workflow.
        
        Args:
            max_sessions: Maximum number of sessions to create
        """
        logger.info(f"🚀 Starting smart session population (max: {max_sessions})")
        
        if self.dry_run:
            logger.info("🧪 DRY RUN MODE - No actual changes will be made")
        
        try:
            # Step 1: Discover storage structure
            patient_files = await self.discover_storage_structure()
            
            if not patient_files:
                logger.warning("⚠️ No patient subfolders found in storage")
                return
            
            # Step 2: Collect all file paths for batch checking
            all_file_paths = []
            for files in patient_files.values():
                all_file_paths.extend([f["file_path"] for f in files])
            
            # Step 3: Check which files need processing
            unprocessed_files = await self.check_existing_sessions(all_file_paths)
            
            if not unprocessed_files:
                logger.info("✅ All discovered files are already processed!")
                return
            
            # Step 4: Create realistic distribution
            sessions_to_create = min(len(unprocessed_files), max_sessions)
            selected_files = self._select_realistic_distribution(
                patient_files, unprocessed_files, sessions_to_create
            )
            
            # Step 5: Create sessions
            logger.info(f"📝 Creating {len(selected_files)} therapy sessions...")
            
            for i, file_info in enumerate(selected_files, 1):
                try:
                    await self._create_single_session(file_info, i, len(selected_files))
                    
                except Exception as e:
                    logger.error(f"❌ Failed to create session for {file_info['file_path']}: {e}")
                    self.stats["errors"] += 1
                    continue
            
            # Step 6: Summary
            self._print_summary()
            
        except Exception as e:
            logger.error(f"❌ Population failed: {e}")
            raise
    
    def _select_realistic_distribution(
        self, 
        patient_files: Dict[str, List[Dict]], 
        unprocessed_files: List[str],
        target_count: int
    ) -> List[Dict[str, Any]]:
        """Select files for realistic patient distribution.
        
        Args:
            patient_files: All discovered patient files
            unprocessed_files: Files that need processing
            target_count: Target number of sessions
            
        Returns:
            List of selected file info dicts
        """
        logger.info(f"🎯 Selecting {target_count} files for realistic distribution...")
        
        # Build unprocessed set for fast lookup
        unprocessed_set = set(unprocessed_files)
        
        # Collect unprocessed files by patient
        patient_unprocessed = {}
        for patient_code, files in patient_files.items():
            unprocessed_for_patient = [
                f for f in files 
                if f["file_path"] in unprocessed_set
            ]
            if unprocessed_for_patient:
                patient_unprocessed[patient_code] = unprocessed_for_patient
        
        # Create realistic distribution (2-8 sessions per patient)
        selected = []
        patients_with_files = list(patient_unprocessed.keys())
        
        # Round-robin distribution to ensure all patients get some sessions
        while len(selected) < target_count and patients_with_files:
            for patient_code in list(patients_with_files):
                if len(selected) >= target_count:
                    break
                
                patient_files_remaining = patient_unprocessed[patient_code]
                if patient_files_remaining:
                    # Take the first available file for this patient
                    file_info = patient_files_remaining.pop(0)
                    file_info["patient_code"] = patient_code
                    selected.append(file_info)
                    
                    if not patient_files_remaining:
                        patients_with_files.remove(patient_code)
        
        # Sort by patient code for consistent processing order
        selected.sort(key=lambda x: (x["patient_code"], x["filename"]))
        
        # Log distribution
        distribution = {}
        for file_info in selected:
            patient = file_info["patient_code"]
            distribution[patient] = distribution.get(patient, 0) + 1
        
        logger.info(f"📊 Distribution: {distribution}")
        return selected
    
    async def _create_single_session(
        self, 
        file_info: Dict[str, Any], 
        current: int, 
        total: int
    ) -> None:
        """Create a single therapy session.
        
        Args:
            file_info: File information dict
            current: Current file number (1-based)
            total: Total number of files to process
        """
        file_path = file_info["file_path"]
        patient_code = file_info["patient_code"]
        
        logger.info(f"📝 [{current}/{total}] Processing {patient_code}: {file_info['filename']}")
        
        if self.dry_run:
            logger.info(f"🧪 DRY RUN: Would create session for {file_path}")
            self.stats["sessions_created"] += 1
            return
        
        try:
            # Look up patient info
            patient = self.patient_repo.get_patient_by_code(patient_code)
            patient_uuid = patient.get("id") if patient else None
            therapist_uuid = patient.get("therapist_id") if patient else None
            
            if not patient:
                logger.warning(f"⚠️ Patient {patient_code} not found in database")
            
            # Download file to get content hash
            try:
                file_response = self.supabase.storage.from_("c3d-examples").download(file_path)
                if hasattr(file_response, 'error') and file_response.error:
                    raise Exception(f"Download failed: {file_response.error}")
                
                file_data = file_response
                file_hash = self._calculate_file_hash(file_data)
                file_size = len(file_data)
                
            except Exception as e:
                logger.warning(f"⚠️ Could not download {file_path}: {e}")
                # Use placeholder values
                file_hash = f"placeholder_{patient_code}_{file_info['filename']}"
                file_size = file_info.get("size", 0)
            
            # Create therapy session
            session_id = await self.metadata_service.create_metadata_entry(
                file_path=f"c3d-examples/{file_path}",
                file_hash=file_hash,
                file_size_bytes=file_size,
                patient_id=str(patient_uuid) if patient_uuid else None,
                session_id=None,
                metadata={
                    "populated_by": "smart_population_script",
                    "populated_at": datetime.utcnow().isoformat(),
                    "patient_code": patient_code,
                    "original_filename": file_info["filename"]
                }
            )
            
            self.stats["sessions_created"] += 1
            logger.info(f"✅ [{current}/{total}] Created session: {session_id}")
            
            # Optional: Process C3D file immediately (slower but more complete)
            # Uncomment the following lines for complete processing:
            #
            # try:
            #     await self.session_processor.process_c3d_file(
            #         session_id=str(session_id),
            #         bucket="c3d-examples",
            #         object_path=file_path
            #     )
            #     self.stats["sessions_processed"] += 1
            #     logger.info(f"🔄 [{current}/{total}] Processed: {session_id}")
            # except Exception as e:
            #     logger.warning(f"⚠️ Processing failed for {session_id}: {e}")
            
        except Exception as e:
            logger.error(f"❌ Failed to create session for {file_path}: {e}")
            raise
    
    def _print_summary(self) -> None:
        """Print final summary of population results."""
        logger.info("\n" + "="*60)
        logger.info("📊 POPULATION SUMMARY")
        logger.info("="*60)
        logger.info(f"📁 Patients discovered: {self.stats['patients_discovered']}")
        logger.info(f"📄 Files discovered: {self.stats['files_discovered']}")
        logger.info(f"✅ Files already processed: {self.stats['files_already_processed']}")
        logger.info(f"📝 Sessions created: {self.stats['sessions_created']}")
        logger.info(f"🔄 Sessions processed: {self.stats['sessions_processed']}")
        logger.info(f"❌ Errors: {self.stats['errors']}")
        logger.info("="*60)
        
        if self.stats["sessions_created"] > 0:
            logger.info("✅ Population completed successfully!")
            if not self.dry_run:
                logger.info("💡 Next steps:")
                logger.info("   1. Check therapy_sessions table for new records")
                logger.info("   2. Run webhook processing for complete EMG analysis")
                logger.info("   3. Verify patient/therapist relationships")
        else:
            logger.info("ℹ️ No new sessions were created")

async def main():
    """Main entry point for the population script."""
    parser = argparse.ArgumentParser(
        description="Smart population of realistic therapy sessions"
    )
    parser.add_argument(
        "--dry-run", 
        action="store_true", 
        help="Preview what would be done without making changes"
    )
    parser.add_argument(
        "--max-sessions", 
        type=int, 
        default=63,
        help="Maximum number of sessions to create (default: 63)"
    )
    
    args = parser.parse_args()
    
    # Initialize populator
    populator = SmartSessionPopulator(dry_run=args.dry_run)
    
    # Run population
    try:
        await populator.populate_sessions(max_sessions=args.max_sessions)
    except KeyboardInterrupt:
        logger.info("⏹️ Population interrupted by user")
    except Exception as e:
        logger.error(f"❌ Population failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    # Check if running in backend directory
    if not Path("config.py").exists():
        print("❌ Error: Must run from backend directory")
        print("💡 Usage: cd backend && python scripts/populate_realistic_sessions.py")
        sys.exit(1)
    
    # Run the async main function
    asyncio.run(main())