# Project Scripts

This directory contains project-level utility scripts organized by purpose.

## 📁 Directory Structure

```
/scripts/
├── database/                    # Database operations
│   ├── reset_populate.py       # Database reset with Storage integration ✨
│   ├── reset_populate.sh       # Bash wrapper for reset operations
│   ├── cleanup_demo_data.sql   # SQL cleanup scripts
│   └── validate_schema.sql     # Schema validation queries
│
├── migration/                   # Database migration scripts
│   ├── migrate_to_stats_schema.py
│   └── migrate_to_redis_cache.py
│
└── docs/                        # Documentation
    ├── demo_database_replication.md
    └── schema_alignment_report.md
```

## 🚀 Key Features

### Database Reset & Population (`database/reset_populate.py`)

**New Feature**: Extracts patient codes directly from Supabase Storage folders!

```bash
# Reset and populate database with Storage-based patient codes
python scripts/database/reset_populate.py

# Dry run to preview operations
python scripts/database/reset_populate.py --dry-run

# Skip confirmations (use with caution!)
python scripts/database/reset_populate.py --force

# Only reset or only populate
python scripts/database/reset_populate.py --reset-only
python scripts/database/reset_populate.py --populate-only
```

**What it does:**
1. 🔍 Scans Supabase Storage `c3d-examples` bucket for patient folders (P001, P039, etc.)
2. 👥 Extracts actual patient codes from Storage structure
3. 🗑️ Safely resets database with confirmation prompts
4. 📊 Populates with demo data matching Storage structure
5. ✅ Validates consistency between database and Storage

**Storage Integration Benefits:**
- No hardcoded patient lists - always in sync with Storage
- Automatic discovery of new patient folders
- Test fallback (P001, P039, P040) if Storage is empty
- Detailed reporting of Storage contents

### Migration Scripts (`migration/`)

Scripts for database schema migrations and cache setup:
- **migrate_to_stats_schema.py**: Migrate to optimized statistics schema
- **migrate_to_redis_cache.py**: Set up Redis caching layer

## 🔄 Backward Compatibility

For historical reasons, some scripts may also exist in `/backend/scripts/`. The scripts in this `/scripts/` directory are the recommended versions with the latest features.

### Migration Path
- **Old**: `/backend/scripts/populate_realistic_sessions.py`
- **New**: `/scripts/database/reset_populate.py` (with Storage integration)

## 📝 Usage Examples

### Complete Database Reset and Population
```bash
# From project root
python scripts/database/reset_populate.py --force

# Output:
# 🔍 Extracting patient codes from Supabase Storage...
# 📁 P001: 5 C3D files
# 📁 P039: 3 C3D files
# 📁 P040: 2 C3D files
# ✅ Found 3 patient codes in Storage
# 🧹 Database reset complete
# 📊 Database population complete
# ✅ Perfect consistency between database and Storage!
```

### Validation Only
```bash
# Check consistency without changes
python scripts/database/reset_populate.py --dry-run
```

## 🧪 Testing

Patient codes P001, P039, and P040 are preserved as test defaults to ensure backward compatibility with existing tests.

## 📚 Related Documentation

- `/backend/scripts/README.md` - Backend-specific scripts
- `/supabase/population/` - SQL population scripts
- `/docs/` - Project documentation