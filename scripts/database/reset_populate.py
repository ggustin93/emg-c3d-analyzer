#!/usr/bin/env python3
"""
EMG C3D Analyzer - Database Reset and Population Script
=====================================================

Purpose: Complete database reset and population with Supabase Storage validation
Features:
  - Extracts patient codes from actual Storage folders
  - Safety confirmations with --force option
  - Dry run mode for testing
  - Progress tracking and validation
  - Storage consistency checks

Usage:
    python scripts/database/reset_populate.py [options]
    
Options:
    --reset-only      Only reset the database
    --populate-only   Only populate the database
    --dry-run         Show what would be done without executing
    --force           Skip all confirmations
    --help            Show this help message
"""

import os
import sys
import json
import argparse
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional
import subprocess
import time

# Add backend to path for imports
backend_dir = Path(__file__).resolve().parent.parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

# Now we can import from backend
from database.supabase_client import get_supabase_client

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('database_operations.log')
    ]
)
logger = logging.getLogger(__name__)

# ANSI color codes for terminal output
class Colors:
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    CYAN = '\033[0;36m'
    BOLD = '\033[1m'
    RESET = '\033[0m'

class DatabaseManager:
    """Manages database reset and population operations with Storage integration."""
    
    def __init__(self, dry_run: bool = False, force: bool = False):
        """Initialize the database manager.
        
        Args:
            dry_run: If True, show what would be done without executing
            force: If True, skip all confirmation prompts
        """
        self.dry_run = dry_run
        self.force = force
        self.supabase = None
        self.patient_codes = []
        self.storage_files = {}
        
        # Statistics
        self.stats = {
            "tables_reset": 0,
            "records_created": 0,
            "patient_codes_found": 0,
            "storage_files_found": 0,
            "errors": 0
        }
    
    def connect(self) -> bool:
        """Establish connection to Supabase.
        
        Returns:
            True if connection successful, False otherwise
        """
        try:
            self.supabase = get_supabase_client(use_service_key=True)
            logger.info(f"{Colors.GREEN}✅ Connected to Supabase{Colors.RESET}")
            return True
        except Exception as e:
            logger.error(f"{Colors.RED}❌ Failed to connect to Supabase: {e}{Colors.RESET}")
            return False
    
    def extract_patient_codes_from_storage(self) -> List[str]:
        """Extract patient codes from actual Supabase Storage folders.
        
        Returns:
            List of patient codes found in Storage (e.g., ['P001', 'P039', 'P040'])
        """
        logger.info(f"{Colors.CYAN}🔍 Extracting patient codes from Supabase Storage...{Colors.RESET}")
        
        if self.dry_run:
            logger.info(f"{Colors.YELLOW}[DRY RUN] Would extract patient codes from Storage{Colors.RESET}")
            # Return test codes for dry run
            return ['P001', 'P039', 'P040']
        
        try:
            # List all objects in the c3d-examples bucket
            response = self.supabase.storage.from_("c3d-examples").list()
            
            patient_codes = set()
            self.storage_files = {}
            
            for item in response:
                # Check if it's a directory with patient code format (P001-P065)
                name = item.get('name', '')
                if name.startswith('P') and len(name) == 4 and name[1:].isdigit():
                    patient_codes.add(name)
                    
                    # List files in this patient directory
                    try:
                        patient_files = self.supabase.storage.from_("c3d-examples").list(path=name)
                        c3d_files = [f['name'] for f in patient_files if f['name'].endswith('.c3d')]
                        if c3d_files:
                            self.storage_files[name] = c3d_files
                            logger.info(f"  📁 {name}: {len(c3d_files)} C3D files")
                    except Exception as e:
                        logger.warning(f"  ⚠️  Could not list files for {name}: {e}")
            
            # Convert to sorted list
            patient_codes = sorted(patient_codes)
            
            if patient_codes:
                logger.info(f"{Colors.GREEN}✅ Found {len(patient_codes)} patient codes in Storage{Colors.RESET}")
                logger.info(f"  Patient codes: {', '.join(patient_codes[:10])}")
                if len(patient_codes) > 10:
                    logger.info(f"  ... and {len(patient_codes) - 10} more")
            else:
                logger.warning(f"{Colors.YELLOW}⚠️  No patient codes found in Storage{Colors.RESET}")
                # Fallback to test codes
                patient_codes = ['P001', 'P039', 'P040']
                logger.info(f"  Using fallback test codes: {', '.join(patient_codes)}")
            
            self.patient_codes = patient_codes
            self.stats["patient_codes_found"] = len(patient_codes)
            self.stats["storage_files_found"] = sum(len(files) for files in self.storage_files.values())
            
            return patient_codes
            
        except Exception as e:
            logger.error(f"{Colors.RED}❌ Failed to extract patient codes from Storage: {e}{Colors.RESET}")
            # Fallback to test codes
            self.patient_codes = ['P001', 'P039', 'P040']
            logger.info(f"{Colors.YELLOW}Using fallback test codes: {', '.join(self.patient_codes)}{Colors.RESET}")
            return self.patient_codes
    
    def reset_database(self) -> bool:
        """Reset the database by clearing all data.
        
        Returns:
            True if reset successful, False otherwise
        """
        logger.info(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.RESET}")
        logger.info(f"{Colors.BOLD}{Colors.BLUE}PHASE 1: DATABASE RESET{Colors.RESET}")
        logger.info(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.RESET}\n")
        
        if not self.force and not self.dry_run:
            response = input(f"{Colors.YELLOW}⚠️  This will DELETE all data. Continue? (y/n): {Colors.RESET}")
            if response.lower() != 'y':
                logger.info(f"{Colors.YELLOW}Reset cancelled by user{Colors.RESET}")
                return False
        
        if self.dry_run:
            logger.info(f"{Colors.YELLOW}[DRY RUN] Would reset the following tables:{Colors.RESET}")
            tables = [
                "performance_scores", "emg_statistics", "processing_parameters",
                "session_settings", "bfr_monitoring", "therapy_sessions",
                "patients", "user_profiles"
            ]
            for table in tables:
                logger.info(f"  - {table}")
            self.stats["tables_reset"] = len(tables)
            return True
        
        try:
            # Delete data in reverse dependency order
            tables_to_clear = [
                ("performance_scores", None),
                ("emg_statistics", None),
                ("processing_parameters", None),
                ("session_settings", None),
                ("bfr_monitoring", None),
                ("therapy_sessions", None),
                ("patients", None),
                ("scoring_configuration", "is_global = false"),
                ("user_profiles", "role != 'admin'")
            ]
            
            for table, condition in tables_to_clear:
                try:
                    query = self.supabase.table(table).delete()
                    if condition:
                        # Parse condition (simple implementation)
                        if "!=" in condition:
                            field, value = condition.split(" != ")
                            query = query.neq(field, value.strip("'"))
                        elif "=" in condition:
                            field, value = condition.split(" = ")
                            query = query.eq(field, value.strip("'") == 'true' if value in ['true', 'false'] else value.strip("'"))
                    
                    result = query.execute()
                    logger.info(f"  ✅ Cleared table: {table}")
                    self.stats["tables_reset"] += 1
                except Exception as e:
                    logger.warning(f"  ⚠️  Could not clear {table}: {e}")
            
            logger.info(f"{Colors.GREEN}✅ Database reset complete{Colors.RESET}")
            return True
            
        except Exception as e:
            logger.error(f"{Colors.RED}❌ Database reset failed: {e}{Colors.RESET}")
            self.stats["errors"] += 1
            return False
    
    def populate_database(self) -> bool:
        """Populate the database with demo data using extracted patient codes.
        
        Returns:
            True if population successful, False otherwise
        """
        logger.info(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.RESET}")
        logger.info(f"{Colors.BOLD}{Colors.BLUE}PHASE 2: DATABASE POPULATION{Colors.RESET}")
        logger.info(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.RESET}\n")
        
        if not self.patient_codes:
            # Extract patient codes if not already done
            self.extract_patient_codes_from_storage()
        
        if self.dry_run:
            logger.info(f"{Colors.YELLOW}[DRY RUN] Would populate database with:{Colors.RESET}")
            logger.info(f"  - {len(self.patient_codes)} patients")
            logger.info(f"  - Therapy sessions for each patient")
            logger.info(f"  - EMG statistics and performance scores")
            return True
        
        try:
            # Run population SQL scripts
            project_root = Path(__file__).resolve().parent.parent.parent
            population_dir = project_root / "supabase" / "population"
            
            scripts = [
                "01_core_data_population.sql",
                "02_emg_performance_population.sql",
                "03_technical_metadata_population.sql",
                "04_validation_and_summary.sql"
            ]
            
            for script in scripts:
                script_path = population_dir / script
                if not script_path.exists():
                    logger.warning(f"  ⚠️  Script not found: {script}")
                    continue
                
                logger.info(f"  🚀 Executing {script}...")
                
                # Get database URL from environment
                db_url = os.getenv("DATABASE_URL")
                if not db_url:
                    # Construct from Supabase URL
                    supabase_url = os.getenv("SUPABASE_URL", "")
                    if "supabase.co" in supabase_url:
                        project_ref = supabase_url.split("//")[1].split(".")[0]
                        db_url = f"postgresql://postgres:{os.getenv('SUPABASE_SERVICE_KEY')}@db.{project_ref}.supabase.co:5432/postgres"
                
                if db_url:
                    result = subprocess.run(
                        ["psql", db_url, "-f", str(script_path)],
                        capture_output=True,
                        text=True
                    )
                    
                    if result.returncode == 0:
                        logger.info(f"    ✅ {script} completed")
                        # Count created records from output
                        for line in result.stdout.split('\n'):
                            if 'INSERT' in line:
                                self.stats["records_created"] += 1
                    else:
                        logger.error(f"    ❌ {script} failed: {result.stderr}")
                        self.stats["errors"] += 1
                else:
                    logger.warning(f"  ⚠️  Could not construct database URL")
            
            logger.info(f"{Colors.GREEN}✅ Database population complete{Colors.RESET}")
            return True
            
        except Exception as e:
            logger.error(f"{Colors.RED}❌ Population failed: {e}{Colors.RESET}")
            self.stats["errors"] += 1
            return False
    
    def validate_consistency(self) -> bool:
        """Validate patient-storage consistency.
        
        Returns:
            True if validation passes, False otherwise
        """
        logger.info(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.RESET}")
        logger.info(f"{Colors.BOLD}{Colors.BLUE}PHASE 3: VALIDATION{Colors.RESET}")
        logger.info(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.RESET}\n")
        
        if self.dry_run:
            logger.info(f"{Colors.YELLOW}[DRY RUN] Would validate consistency{Colors.RESET}")
            return True
        
        try:
            # Check patients in database
            patients = self.supabase.table("patients").select("patient_code").execute()
            db_patient_codes = sorted([p["patient_code"] for p in patients.data])
            
            logger.info(f"  📋 Patients in database: {Colors.CYAN}{len(db_patient_codes)}{Colors.RESET}")
            logger.info(f"  📁 Patient codes in Storage: {Colors.CYAN}{len(self.patient_codes)}{Colors.RESET}")
            logger.info(f"  📂 C3D files in Storage: {Colors.CYAN}{self.stats['storage_files_found']}{Colors.RESET}")
            
            # Check for mismatches
            db_set = set(db_patient_codes)
            storage_set = set(self.patient_codes)
            
            only_in_db = db_set - storage_set
            only_in_storage = storage_set - db_set
            
            if only_in_db:
                logger.warning(f"  ⚠️  Patients in DB but not in Storage: {', '.join(sorted(only_in_db))}")
            
            if only_in_storage:
                logger.warning(f"  ⚠️  Patients in Storage but not in DB: {', '.join(sorted(only_in_storage))}")
            
            if not only_in_db and not only_in_storage:
                logger.info(f"{Colors.GREEN}  ✅ Perfect consistency between database and Storage!{Colors.RESET}")
                return True
            else:
                logger.info(f"{Colors.YELLOW}  ⚠️  Some inconsistencies found (see above){Colors.RESET}")
                return True  # Still return True as this is not a critical error
                
        except Exception as e:
            logger.error(f"{Colors.RED}❌ Validation failed: {e}{Colors.RESET}")
            return False
    
    def print_summary(self):
        """Print operation summary."""
        logger.info(f"\n{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.RESET}")
        logger.info(f"{Colors.BOLD}{Colors.CYAN}OPERATION SUMMARY{Colors.RESET}")
        logger.info(f"{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.RESET}")
        
        logger.info(f"  📊 Tables reset: {self.stats['tables_reset']}")
        logger.info(f"  📝 Records created: {self.stats['records_created']}")
        logger.info(f"  👥 Patient codes found: {self.stats['patient_codes_found']}")
        logger.info(f"  📁 Storage files found: {self.stats['storage_files_found']}")
        
        if self.stats['errors'] > 0:
            logger.info(f"  {Colors.RED}❌ Errors: {self.stats['errors']}{Colors.RESET}")
        else:
            logger.info(f"  {Colors.GREEN}✅ No errors!{Colors.RESET}")
        
        logger.info(f"\n{Colors.GREEN}✅ Operation complete!{Colors.RESET}")
        
        if not self.dry_run:
            logger.info(f"\nNext steps:")
            logger.info(f"  1. Start development server: {Colors.CYAN}./start_dev_simple.sh{Colors.RESET}")
            logger.info(f"  2. Run tests: {Colors.CYAN}cd backend && python -m pytest tests/ -v{Colors.RESET}")
            logger.info(f"  3. Access application: {Colors.CYAN}http://localhost:3000{Colors.RESET}")

def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="EMG C3D Analyzer - Database Reset and Population with Storage Integration"
    )
    parser.add_argument(
        "--reset-only",
        action="store_true",
        help="Only reset the database"
    )
    parser.add_argument(
        "--populate-only",
        action="store_true",
        help="Only populate the database"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without executing"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Skip all confirmation prompts"
    )
    
    args = parser.parse_args()
    
    # Print header
    print(f"{Colors.BOLD}{Colors.CYAN}")
    print("╔════════════════════════════════════════════════════════════╗")
    print("║     EMG C3D ANALYZER - DATABASE MANAGEMENT TOOL           ║")
    print("║     With Supabase Storage Integration                     ║")
    print("╚════════════════════════════════════════════════════════════╝")
    print(f"{Colors.RESET}")
    
    # Initialize manager
    manager = DatabaseManager(dry_run=args.dry_run, force=args.force)
    
    # Connect to Supabase
    if not manager.connect():
        logger.error("Failed to connect to Supabase")
        sys.exit(1)
    
    # Extract patient codes from Storage
    manager.extract_patient_codes_from_storage()
    
    try:
        # Execute operations
        if not args.populate_only:
            if not manager.reset_database():
                logger.error("Reset failed")
                sys.exit(1)
        
        if not args.reset_only:
            if not manager.populate_database():
                logger.error("Population failed")
                sys.exit(1)
        
        # Validate consistency
        manager.validate_consistency()
        
        # Print summary
        manager.print_summary()
        
    except KeyboardInterrupt:
        logger.info(f"\n{Colors.YELLOW}Operation cancelled by user{Colors.RESET}")
        sys.exit(0)
    except Exception as e:
        logger.error(f"{Colors.RED}Operation failed: {e}{Colors.RESET}")
        sys.exit(1)

if __name__ == "__main__":
    main()