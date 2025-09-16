#!/usr/bin/env python3
"""
Clean up test files, non-Ghostly files, and duplicates from c3d-examples bucket.

This script:
1. Deletes all .c3d files with "*test*" in their name
2. Deletes all .c3d files that don't start with "Ghostly_Emg_"
3. Identifies and removes duplicate Ghostly files (same file size) for each patient
4. Provides dry-run mode for safety
5. Logs all operations for audit trail
"""

import os
import sys
from pathlib import Path
import logging
from typing import Dict, List, Set, Tuple
from datetime import datetime
import argparse
from collections import defaultdict

# Add backend to Python path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "backend"))

from supabase import Client, create_client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(f'bucket_cleanup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log')
    ]
)
logger = logging.getLogger(__name__)


class BucketCleaner:
    """Handles cleanup of test files and duplicates in Supabase storage bucket."""
    
    def __init__(self, dry_run: bool = True):
        """Initialize the bucket cleaner.
        
        Args:
            dry_run: If True, only preview actions without deleting
        """
        self.dry_run = dry_run
        self.supabase = self._init_supabase()
        self.bucket_name = "c3d-examples"
        
        # Statistics
        self.stats = {
            "files_scanned": 0,
            "test_files_found": 0,
            "test_files_deleted": 0,
            "non_ghostly_found": 0,
            "non_ghostly_deleted": 0,
            "duplicates_found": 0,
            "duplicates_deleted": 0,
            "errors": 0,
            "total_size_freed": 0
        }
        
    def _init_supabase(self) -> Client:
        """Initialize Supabase client."""
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
        
        if not supabase_url or not supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
        
        return create_client(supabase_url, supabase_key)
    
    def scan_bucket(self) -> Dict[str, List[Dict]]:
        """Scan the entire bucket and organize files by patient.
        
        Returns:
            Dictionary mapping patient codes to their file information
        """
        logger.info(f"📊 Scanning bucket: {self.bucket_name}")
        
        try:
            # List all files in the bucket
            response = self.supabase.storage.from_(self.bucket_name).list()
            
            patient_files = defaultdict(list)
            
            # Process root level items (patient directories)
            for item in response:
                name = item.get('name', '')
                
                # Check if it's a patient directory (P001-P065 format)
                if name.startswith('P') and len(name) == 4 and name[1:].isdigit():
                    patient_code = name
                    
                    # List files in patient directory
                    try:
                        patient_response = self.supabase.storage.from_(self.bucket_name).list(path=name)
                        
                        for file_item in patient_response:
                            file_name = file_item.get('name', '')
                            
                            # Only process .c3d files
                            if file_name.lower().endswith('.c3d'):
                                file_info = {
                                    'name': file_name,
                                    'path': f"{patient_code}/{file_name}",
                                    'size': file_item.get('metadata', {}).get('size', 0),
                                    'created_at': file_item.get('created_at'),
                                    'updated_at': file_item.get('updated_at'),
                                    'is_test': 'test' in file_name.lower(),
                                    'is_non_ghostly': not file_name.startswith('Ghostly_Emg_')
                                }
                                patient_files[patient_code].append(file_info)
                                self.stats["files_scanned"] += 1
                                
                    except Exception as e:
                        logger.warning(f"⚠️  Could not list files for {patient_code}: {e}")
                        self.stats["errors"] += 1
            
            # Sort files for consistent processing
            for patient_code in patient_files:
                patient_files[patient_code].sort(key=lambda x: x['name'])
            
            logger.info(f"✅ Scanned {self.stats['files_scanned']} files across {len(patient_files)} patients")
            return dict(patient_files)
            
        except Exception as e:
            logger.error(f"❌ Failed to scan bucket: {e}")
            raise
    
    def identify_test_files(self, patient_files: Dict[str, List[Dict]]) -> List[str]:
        """Identify all test files to be deleted.
        
        Args:
            patient_files: Dictionary of patient files
            
        Returns:
            List of file paths to delete
        """
        test_files = []
        
        for patient_code, files in patient_files.items():
            for file_info in files:
                if file_info['is_test']:
                    test_files.append(file_info['path'])
                    self.stats["test_files_found"] += 1
                    self.stats["total_size_freed"] += file_info['size']
                    logger.info(f"🧪 Test file found: {file_info['path']} ({self._format_size(file_info['size'])})")
        
        return test_files
    
    def identify_non_ghostly_files(self, patient_files: Dict[str, List[Dict]]) -> List[str]:
        """Identify all non-Ghostly files to be deleted.
        
        Args:
            patient_files: Dictionary of patient files
            
        Returns:
            List of file paths to delete
        """
        non_ghostly_files = []
        
        for patient_code, files in patient_files.items():
            for file_info in files:
                # Skip test files (they're already handled separately)
                if file_info['is_test']:
                    continue
                    
                if file_info['is_non_ghostly']:
                    non_ghostly_files.append(file_info['path'])
                    self.stats["non_ghostly_found"] += 1
                    self.stats["total_size_freed"] += file_info['size']
                    logger.info(f"🚫 Non-Ghostly file found: {file_info['path']} ({self._format_size(file_info['size'])})")
        
        return non_ghostly_files
    
    def identify_specific_pattern_files(self, patient_files: Dict[str, List[Dict]], pattern: str = "Ghostly_Emg_20231004_13-18-43-0464.c3d") -> List[str]:
        """Identify files matching a specific pattern to be deleted.
        
        Args:
            patient_files: Dictionary of patient files
            pattern: File name pattern to match
            
        Returns:
            List of file paths to delete
        """
        pattern_files = []
        
        for patient_code, files in patient_files.items():
            for file_info in files:
                if pattern in file_info['name']:
                    pattern_files.append(file_info['path'])
                    self.stats["pattern_files_found"] = self.stats.get("pattern_files_found", 0) + 1
                    self.stats["total_size_freed"] += file_info['size']
                    logger.info(f"🎯 Pattern match found: {file_info['path']} ({self._format_size(file_info['size'])})")
        
        return pattern_files
    
    def identify_duplicates(self, patient_files: Dict[str, List[Dict]]) -> List[str]:
        """Identify duplicate files based on file size within each patient.
        
        Args:
            patient_files: Dictionary of patient files
            
        Returns:
            List of duplicate file paths to delete
        """
        duplicates = []
        
        for patient_code, files in patient_files.items():
            # Only consider Ghostly_Emg files that are not test files for duplicate detection
            ghostly_non_test_files = [f for f in files if not f['is_test'] and not f['is_non_ghostly']]
            if len(ghostly_non_test_files) <= 1:
                continue
            
            # Group files by size
            size_groups = defaultdict(list)
            for file_info in ghostly_non_test_files:
                size_groups[file_info['size']].append(file_info)
            
            # Identify duplicates (keep the oldest file)
            for size, same_size_files in size_groups.items():
                if len(same_size_files) > 1:
                    # Sort by created_at to keep the oldest
                    same_size_files.sort(key=lambda x: x['created_at'] or '9999')
                    
                    # Mark all but the first as duplicates
                    for duplicate in same_size_files[1:]:
                        duplicates.append(duplicate['path'])
                        self.stats["duplicates_found"] += 1
                        self.stats["total_size_freed"] += duplicate['size']
                        logger.info(
                            f"🔁 Duplicate found: {duplicate['path']} "
                            f"({self._format_size(duplicate['size'])}) - "
                            f"keeping {same_size_files[0]['name']}"
                        )
        
        return duplicates
    
    def delete_files(self, file_paths: List[str]) -> None:
        """Delete specified files from the bucket.
        
        Args:
            file_paths: List of file paths to delete
        """
        if not file_paths:
            logger.info("📭 No files to delete")
            return
        
        logger.info(f"🗑️  {'DRY RUN: Would delete' if self.dry_run else 'Deleting'} {len(file_paths)} files...")
        
        for file_path in file_paths:
            try:
                if self.dry_run:
                    logger.info(f"🔍 DRY RUN: Would delete {file_path}")
                else:
                    # Actually delete the file
                    response = self.supabase.storage.from_(self.bucket_name).remove([file_path])
                    
                    # Check if deletion was successful
                    if hasattr(response, 'error') and response.error:
                        logger.error(f"❌ Failed to delete {file_path}: {response.error}")
                        self.stats["errors"] += 1
                    else:
                        logger.info(f"✅ Deleted: {file_path}")
                        
                        # Update statistics based on file type
                        if 'test' in file_path.lower():
                            self.stats["test_files_deleted"] += 1
                        elif not file_path.split('/')[-1].startswith('Ghostly_Emg_'):
                            self.stats["non_ghostly_deleted"] += 1
                        else:
                            self.stats["duplicates_deleted"] += 1
                            
            except Exception as e:
                logger.error(f"❌ Error deleting {file_path}: {e}")
                self.stats["errors"] += 1
    
    def check_database_references(self, file_paths: List[str]) -> List[str]:
        """Check if any files are referenced in the database.
        
        Args:
            file_paths: List of file paths to check
            
        Returns:
            List of files that are referenced in database
        """
        if not file_paths:
            return []
        
        logger.info("🔍 Checking database references...")
        referenced_files = []
        
        try:
            # Check therapy_sessions table
            bucket_paths = [f"{self.bucket_name}/{path}" for path in file_paths]
            
            # Query in batches to avoid too large queries
            batch_size = 50
            for i in range(0, len(bucket_paths), batch_size):
                batch = bucket_paths[i:i+batch_size]
                
                response = self.supabase.table("therapy_sessions").select(
                    "file_path"
                ).in_("file_path", batch).execute()
                
                for item in response.data:
                    file_path = item['file_path']
                    # Remove bucket prefix to match our file paths
                    clean_path = file_path.replace(f"{self.bucket_name}/", "")
                    if clean_path in file_paths:
                        referenced_files.append(clean_path)
                        logger.warning(f"⚠️  File referenced in database: {clean_path}")
            
            if referenced_files:
                logger.warning(
                    f"⚠️  Found {len(referenced_files)} files referenced in database. "
                    "Consider updating database after deletion."
                )
            
        except Exception as e:
            logger.error(f"❌ Failed to check database references: {e}")
            self.stats["errors"] += 1
        
        return referenced_files
    
    def _format_size(self, size_bytes: int) -> str:
        """Format file size in human-readable format.
        
        Args:
            size_bytes: Size in bytes
            
        Returns:
            Formatted size string
        """
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size_bytes < 1024.0:
                return f"{size_bytes:.2f} {unit}"
            size_bytes /= 1024.0
        return f"{size_bytes:.2f} TB"
    
    def print_summary(self) -> None:
        """Print cleanup summary."""
        logger.info("\n" + "="*60)
        logger.info("📊 CLEANUP SUMMARY")
        logger.info("="*60)
        logger.info(f"📁 Files scanned: {self.stats['files_scanned']}")
        logger.info(f"🧪 Test files found: {self.stats['test_files_found']}")
        logger.info(f"🚫 Non-Ghostly files found: {self.stats['non_ghostly_found']}")
        logger.info(f"🔁 Duplicates found: {self.stats['duplicates_found']}")
        
        if not self.dry_run:
            logger.info(f"✅ Test files deleted: {self.stats['test_files_deleted']}")
            logger.info(f"✅ Non-Ghostly files deleted: {self.stats['non_ghostly_deleted']}")
            logger.info(f"✅ Duplicates deleted: {self.stats['duplicates_deleted']}")
        
        logger.info(f"💾 Total space {'would be' if self.dry_run else ''} freed: {self._format_size(self.stats['total_size_freed'])}")
        logger.info(f"❌ Errors: {self.stats['errors']}")
        logger.info("="*60)
        
        if self.dry_run:
            logger.info("\n🔍 DRY RUN MODE - No files were actually deleted")
            logger.info("💡 Run with --execute to perform actual deletion")
    
    def run(self, skip_duplicates: bool = False, skip_test: bool = False, skip_non_ghostly: bool = False, skip_pattern: bool = False, patterns: list = None) -> None:
        """Run the cleanup process.
        
        Args:
            skip_duplicates: If True, skip duplicate detection and removal
            skip_test: If True, skip test file removal
            skip_non_ghostly: If True, skip non-Ghostly file removal
            skip_pattern: If True, skip pattern-specific file removal
            patterns: List of patterns to match for deletion
        """
        logger.info("🚀 Starting bucket cleanup")
        logger.info(f"🔧 Mode: {'DRY RUN' if self.dry_run else 'EXECUTE'}")
        
        # Default patterns if none provided
        if patterns is None:
            patterns = [
                "Ghostly_Emg_20231004_13-18-43-0464.c3d", 
                "Ghostly_Emg_20200415_12-31-20-0009.c3d",
                "Ghostly_Emg_20240304_10-05-56-0883.c3d"  # Problematic file with wrong sample numbers
            ]
        
        if skip_test and skip_duplicates and skip_non_ghostly and skip_pattern:
            logger.error("❌ All cleanup types skipped. Nothing to do!")
            return
        
        try:
            # Step 1: Scan bucket
            patient_files = self.scan_bucket()
            
            if not patient_files:
                logger.info("📭 No files found in bucket")
                return
            
            files_to_delete = []
            
            # Step 2: Identify test files
            if not skip_test:
                test_files = self.identify_test_files(patient_files)
                files_to_delete.extend(test_files)
                logger.info(f"📝 Found {len(test_files)} test files to delete")
            
            # Step 3: Identify non-Ghostly files
            if not skip_non_ghostly:
                non_ghostly_files = self.identify_non_ghostly_files(patient_files)
                files_to_delete.extend(non_ghostly_files)
                logger.info(f"📝 Found {len(non_ghostly_files)} non-Ghostly files to delete")
            
            # Step 4: Identify specific pattern files - handle multiple patterns
            if not skip_pattern:
                for pattern in patterns:
                    pattern_files = self.identify_specific_pattern_files(patient_files, pattern)
                    files_to_delete.extend(pattern_files)
                    logger.info(f"📝 Found {len(pattern_files)} files matching pattern '{pattern}' to delete")
            
            # Step 5: Identify duplicates
            if not skip_duplicates:
                duplicates = self.identify_duplicates(patient_files)
                files_to_delete.extend(duplicates)
                logger.info(f"📝 Found {len(duplicates)} duplicate files to delete")
            
            # Remove any duplicates from our deletion list
            files_to_delete = list(set(files_to_delete))
            
            # Step 6: Check database references
            db_referenced = self.check_database_references(files_to_delete)
            
            if db_referenced and not self.dry_run:
                logger.warning(f"⚠️  {len(db_referenced)} files are referenced in database")
                response = input("Continue with deletion? (y/n): ")
                if response.lower() != 'y':
                    logger.info("❌ Cleanup cancelled by user")
                    return
            
            # Step 7: Delete files
            self.delete_files(files_to_delete)
            
            # Step 8: Print summary
            self.print_summary()
            
        except Exception as e:
            logger.error(f"❌ Cleanup failed: {e}")
            raise


def main():
    """Main entry point for the cleanup script."""
    parser = argparse.ArgumentParser(
        description="Clean up test files, non-Ghostly files, and duplicates from c3d-examples bucket"
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Actually delete files (default is dry-run mode)"
    )
    parser.add_argument(
        "--skip-duplicates",
        action="store_true",
        help="Skip duplicate detection and removal"
    )
    parser.add_argument(
        "--skip-test",
        action="store_true",
        help="Skip test file removal"
    )
    parser.add_argument(
        "--skip-non-ghostly",
        action="store_true",
        help="Skip non-Ghostly file removal (keep only Ghostly_Emg_* files)"
    )
    
    args = parser.parse_args()
    
    # Initialize cleaner
    cleaner = BucketCleaner(dry_run=not args.execute)
    
    # Run cleanup
    try:
        cleaner.run(
            skip_duplicates=args.skip_duplicates,
            skip_test=args.skip_test,
            skip_non_ghostly=args.skip_non_ghostly
        )
    except KeyboardInterrupt:
        logger.info("\n⏹️  Cleanup interrupted by user")
    except Exception as e:
        logger.error(f"❌ Cleanup failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()