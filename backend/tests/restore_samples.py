#!/usr/bin/env python3
"""
Sample File Restoration Script
==============================

This script restores the sample C3D file if it has been deleted or corrupted.
It searches for valid copies in frontend locations and restores them to the backend.

Usage:
    python backend/tests/restore_samples.py
    
    Or from the backend directory:
    python tests/restore_samples.py
"""

import sys
from pathlib import Path
import shutil
import hashlib

# Direct configuration without importing from conftest to avoid app initialization issues
SAMPLE_FILENAME = "Ghostly_Emg_20230321_17-50-17-0881.c3d"
EXPECTED_FILE_SIZE = 2867920  # 2.87 MB - known size of our sample file

def get_primary_sample_path() -> Path:
    """Get the primary backend test samples path."""
    return Path(__file__).parent / "samples" / SAMPLE_FILENAME

def get_fallback_locations() -> list:
    """Get list of fallback locations to search for sample files."""
    project_root = Path(__file__).resolve().parents[2]
    
    return [
        # Frontend samples (most likely to exist)
        project_root / "frontend" / "public" / "samples" / SAMPLE_FILENAME,
        project_root / "frontend" / "src" / "tests" / "samples" / SAMPLE_FILENAME,
        project_root / "frontend" / "build" / "samples" / SAMPLE_FILENAME,
    ]


def calculate_md5(file_path: Path) -> str:
    """Calculate MD5 hash of a file."""
    md5_hash = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            md5_hash.update(chunk)
    return md5_hash.hexdigest()


def main():
    """Main restoration process."""
    print("🔧 Sample File Restoration Tool")
    print("=" * 50)
    
    # Check current status
    primary_path = get_primary_sample_path()
    print(f"\n📁 Primary location: {primary_path}")
    
    if primary_path.exists():
        file_size = primary_path.stat().st_size
        print(f"✅ File exists")
        print(f"📊 Current size: {file_size:,} bytes")
        print(f"📊 Expected size: {EXPECTED_FILE_SIZE:,} bytes")
        
        if file_size == EXPECTED_FILE_SIZE:
            print("✅ File size is correct")
            md5_hash = calculate_md5(primary_path)
            print(f"🔐 MD5 hash: {md5_hash}")
            print("\n✨ Sample file is intact and valid!")
            return 0
        else:
            print("⚠️ File size mismatch - file may be corrupted")
    else:
        print("❌ File is missing")
    
    # Search for valid copies
    print("\n🔍 Searching for valid copies in fallback locations...")
    fallback_locations = get_fallback_locations()
    
    valid_copies = []
    for fallback_path in fallback_locations:
        if fallback_path.exists():
            size = fallback_path.stat().st_size
            if size == EXPECTED_FILE_SIZE:
                valid_copies.append(fallback_path)
                print(f"✅ Found valid copy: {fallback_path}")
            else:
                print(f"⚠️ Found copy with wrong size: {fallback_path} ({size:,} bytes)")
        else:
            print(f"❌ Not found: {fallback_path}")
    
    if not valid_copies:
        print("\n❌ No valid copies found in any fallback location!")
        print("\n💡 To restore the sample file:")
        print("1. Get the original file from the GHOSTLY game export")
        print(f"2. Copy it to: {primary_path}")
        print(f"3. Ensure it's exactly {EXPECTED_FILE_SIZE:,} bytes")
        return 1
    
    # Restore from the first valid copy
    source = valid_copies[0]
    print(f"\n🔄 Restoring from: {source}")
    
    # Backup any existing corrupted file
    if primary_path.exists():
        backup_path = primary_path.with_suffix('.corrupted.bak')
        shutil.copy2(primary_path, backup_path)
        print(f"📦 Existing file backed up to: {backup_path}")
    
    # Ensure directory exists
    primary_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Copy the file
    shutil.copy2(source, primary_path)
    print(f"✅ File restored to: {primary_path}")
    
    # Verify restoration
    if primary_path.exists():
        restored_size = primary_path.stat().st_size
        if restored_size == EXPECTED_FILE_SIZE:
            md5_hash = calculate_md5(primary_path)
            print(f"\n✅ Restoration successful!")
            print(f"📊 File size: {restored_size:,} bytes")
            print(f"🔐 MD5 hash: {md5_hash}")
            
            # Also copy to all other locations for redundancy
            print("\n📦 Creating backup copies in all locations...")
            for location in fallback_locations:
                if not location.exists() or location.stat().st_size != EXPECTED_FILE_SIZE:
                    location.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(primary_path, location)
                    print(f"  ✅ Copied to: {location}")
            
            return 0
        else:
            print(f"\n❌ Restoration failed - file size is wrong: {restored_size:,} bytes")
            return 1
    else:
        print("\n❌ Restoration failed - file could not be copied")
        return 1


if __name__ == "__main__":
    sys.exit(main())