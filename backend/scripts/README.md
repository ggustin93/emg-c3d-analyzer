# EMG C3D Analyzer - Backend Scripts

## ⚠️ Script Organization Update

As part of improving project organization, database scripts are being reorganized:

### New Recommended Location
- **Database Operations**: `/scripts/database/`
  - `reset_populate.py` - Database reset with Storage integration ✨
  - `reset_populate.sh` - Bash wrapper for reset operations
  
### Current Scripts (Maintained for Compatibility)
Backend-specific utilities and management scripts for therapy sessions.

## 📁 Available Scripts

### 1. `populate_realistic_sessions.py` - Smart Session Population

Automatically discovers existing patient subfolders in Supabase Storage and populates therapy sessions for C3D files not yet in the database.

**Features:**
- ✅ Smart duplicate detection (avoids re-processing existing files)
- 🔍 Automatic patient subfolder discovery (P001/, P002/, etc.)
- 📊 Progress tracking with detailed logging
- 🎯 Realistic session distribution across patients
- 🛡️ Proper error handling and recovery

**Usage:**
```bash
# Basic usage - populate up to 63 sessions
cd backend
python scripts/populate_realistic_sessions.py

# Preview what would be done (recommended first run)
python scripts/populate_realistic_sessions.py --dry-run

# Custom session limit
python scripts/populate_realistic_sessions.py --max-sessions 100
```

**Output:**
```
🔍 Discovering patient subfolders in Supabase Storage...
📁 Discovered 8 patient subfolders
📄 Found 45 C3D files total
✅ Found 12 already processed files
🆕 Need to process 33 new files
🎯 Selecting 33 files for realistic distribution...
📊 Distribution: {'P001': 5, 'P002': 4, 'P003': 6, 'P004': 3, ...}
📝 Creating 33 therapy sessions...
✅ Population completed successfully!
```

### 2. `cleanup_sessions.py` - Safe Data Cleanup

Provides safe cleanup operations for therapy sessions and related data with multiple strategies and safety checks.

**Features:**
- 🧪 Dry-run mode for testing
- 💾 Automatic backup creation before deletion
- 🗑️ Cascade deletion of related data (EMG statistics, performance scores)
- ⚠️ Confirmation prompts for safety
- 📊 Multiple cleanup strategies

**Usage:**
```bash
# Clean up test data and populated sessions (recommended)
cd backend
python scripts/cleanup_sessions.py --strategy test-data --dry-run

# Clean up failed sessions
python scripts/cleanup_sessions.py --strategy status --status failed

# Clean up sessions for specific patient
python scripts/cleanup_sessions.py --strategy patient --patient P001

# Clean up old sessions (older than 30 days)
python scripts/cleanup_sessions.py --strategy date --days-old 30

# Force cleanup without confirmation (dangerous!)
python scripts/cleanup_sessions.py --strategy test-data --force
```

## 🔧 Prerequisites

1. **Backend Environment:**
   ```bash
   cd backend
   source venv/bin/activate  # or your virtual environment
   ```

2. **Environment Variables:**
   ```bash
   # Required for Supabase access
   export SUPABASE_URL="your-project-url"
   export SUPABASE_SERVICE_KEY="your-service-key"
   ```

3. **Database Schema:**
   - Ensure migration `20250829000000_therapeutic_targets_optimization.sql` is applied
   - Tables: `therapy_sessions`, `emg_statistics`, `performance_scores`

## 📊 Realistic Population Strategy

The population script creates a realistic distribution of therapy sessions:

- **Patient Distribution:** 2-8 sessions per patient (round-robin)
- **File Selection:** Chronological order within each patient
- **Duplicate Prevention:** Checks existing `therapy_sessions.file_path`
- **Metadata Preservation:** All C3D metadata stored in `game_metadata` JSONB
- **Error Recovery:** Graceful handling of missing files or patients

## 🛡️ Safety Features

### Population Script
- ✅ Dry-run mode for testing
- ✅ Duplicate detection prevents re-processing
- ✅ Graceful error handling with detailed logging
- ✅ Progress tracking and statistics

### Cleanup Script
- ✅ Backup creation before deletion
- ✅ Confirmation prompts (unless `--force`)
- ✅ Cascade deletion of related data
- ✅ Preview mode shows what will be deleted
- ✅ Multiple safety strategies

## 📝 Logging

Both scripts create detailed log files:
- `populate_sessions.log` - Population activity and errors
- `cleanup_sessions.log` - Cleanup activity and errors

Logs include:
- Progress tracking with timestamps
- Error details for debugging
- Statistics summaries
- File operations and database changes

## 🧪 Testing Workflow

**Recommended testing sequence:**

1. **Preview Population:**
   ```bash
   python scripts/populate_realistic_sessions.py --dry-run
   ```

2. **Small Test Population:**
   ```bash
   python scripts/populate_realistic_sessions.py --max-sessions 5
   ```

3. **Verify Results:**
   ```bash
   # Check database
   # Query therapy_sessions table
   ```

4. **Test Cleanup:**
   ```bash
   python scripts/cleanup_sessions.py --strategy test-data --dry-run
   ```

5. **Full Population:**
   ```bash
   python scripts/populate_realistic_sessions.py --max-sessions 63
   ```

## 🔍 Database Queries for Verification

```sql
-- Check populated sessions
SELECT 
    resolved_patient_id,
    processing_status,
    COUNT(*) as session_count,
    MIN(created_at) as first_session,
    MAX(created_at) as last_session
FROM therapy_sessions 
GROUP BY resolved_patient_id, processing_status
ORDER BY resolved_patient_id;

-- Check file distribution
SELECT 
    resolved_patient_id,
    COUNT(*) as file_count
FROM therapy_sessions 
WHERE game_metadata->>'populated_by' = 'smart_population_script'
GROUP BY resolved_patient_id
ORDER BY file_count DESC;

-- Check for duplicates
SELECT file_path, COUNT(*) as count
FROM therapy_sessions
GROUP BY file_path
HAVING COUNT(*) > 1;
```

## 🎯 Next Steps

After running the population script:

1. **Verify Sessions:** Check `therapy_sessions` table for new records
2. **Process C3D Files:** Run webhook processing or background jobs for complete EMG analysis
3. **Validate Relationships:** Ensure patient/therapist UUID relationships are correct
4. **Test Analysis:** Verify EMG statistics and performance scores are generated

For complete processing workflow, see the main project documentation.