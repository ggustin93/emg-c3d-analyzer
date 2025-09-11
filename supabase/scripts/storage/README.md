# Storage Management Scripts

This directory contains scripts for managing the `c3d-examples` Supabase storage bucket.

## 🧹 Bucket Cleanup Script

The `cleanup_bucket.py` script helps maintain a clean storage bucket by removing:
- **Test files**: Any `.c3d` files with "test" in their filename
- **Non-Ghostly files**: Any `.c3d` files that don't start with "Ghostly_Emg_"
- **Duplicates**: Ghostly files with identical sizes within the same patient folder

### Features

- 🔍 **Dry-run mode** (default): Preview what would be deleted without making changes
- 📊 **Detailed logging**: All operations are logged to both console and file
- 🔒 **Database reference checking**: Warns if files are referenced in `therapy_sessions` table
- 📈 **Statistics tracking**: Shows files found, deleted, and space freed
- 🎯 **Selective cleanup**: Can skip test files or duplicates as needed

### Usage

#### Quick Start

```bash
# From project root directory
./scripts/storage/run_cleanup.sh           # Dry run - preview deletions
./scripts/storage/run_cleanup.sh --execute # Actually delete files
```

#### Direct Python Usage

```bash
cd backend
source venv/bin/activate
python scripts/storage/cleanup_bucket.py           # Dry run
python scripts/storage/cleanup_bucket.py --execute # Delete files
```

#### Options

- `--execute`: Actually delete files (default is dry-run mode)
- `--skip-duplicates`: Skip duplicate detection and removal
- `--skip-test`: Skip test file removal
- `--skip-non-ghostly`: Skip non-Ghostly file removal
- `--help`: Show help message

### Examples

```bash
# Preview all deletions (test + non-Ghostly + duplicates)
./scripts/storage/run_cleanup.sh

# Delete everything (test files + non-Ghostly + duplicates)
./scripts/storage/run_cleanup.sh --execute

# Delete only test files
./scripts/storage/run_cleanup.sh --execute --skip-duplicates --skip-non-ghostly

# Delete only non-Ghostly files
./scripts/storage/run_cleanup.sh --execute --skip-test --skip-duplicates

# Delete only duplicates
./scripts/storage/run_cleanup.sh --execute --skip-test --skip-non-ghostly

# Keep all non-Ghostly files (only clean test + duplicates)
./scripts/storage/run_cleanup.sh --execute --skip-non-ghostly
```

### What Gets Deleted

#### Test Files
- Any file with "test" in the filename (case-insensitive)
- Examples: `test.c3d`, `patient_test_01.c3d`, `TestFile.c3d`

#### Non-Ghostly Files
- Any file that doesn't start with "Ghostly_Emg_"
- Examples: `private_file.c3d`, `sample.c3d`, `patient_data.c3d`
- This ensures only official GHOSTLY game files are kept

#### Duplicates
- Ghostly files with identical byte sizes within the same patient folder
- The oldest file (by creation date) is kept
- Newer duplicates are removed (typically files with "(1)", "(2)", etc. suffixes)

### Safety Features

1. **Dry-run by default**: Must explicitly use `--execute` to delete
2. **Database checks**: Warns if files are referenced in database
3. **Confirmation prompt**: Asks for confirmation when database references exist
4. **Detailed logging**: Creates timestamped log file for audit trail
5. **Error handling**: Continues processing even if individual deletions fail

### Log Files

Each run creates a timestamped log file:
- Format: `bucket_cleanup_YYYYMMDD_HHMMSS.log`
- Contains all operations, errors, and statistics
- Useful for audit trails and debugging

### Requirements

- Python 3.8+
- Supabase credentials in `.env`:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_KEY`
- Access to `c3d-examples` bucket

### Statistics Tracked

- 📁 Files scanned
- 🧪 Test files found/deleted
- 🚫 Non-Ghostly files found/deleted
- 🔁 Duplicates found/deleted
- 💾 Total space freed
- ❌ Errors encountered

### Notes

- The script preserves patient folder structure
- Only processes `.c3d` files
- Handles patient codes P001-P065
- Safe to run multiple times
- Can be scheduled as a cron job for regular maintenance