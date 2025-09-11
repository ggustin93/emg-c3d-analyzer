# Supabase Database Management

Complete database management and deployment guide for EMG C3D Analyzer Supabase instances.

📖 **Official Supabase Documentation**: [Getting Started](https://supabase.com/docs/guides/getting-started) | [Database](https://supabase.com/docs/guides/database) | [CLI](https://supabase.com/docs/reference/cli/introduction)

## 🎯 Quick Start (3 Steps)

### 1. Create New Supabase Project
- Go to https://app.supabase.com
- Create new project ([Official Guide](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs))
- Save your project URL and keys ([API Settings](https://supabase.com/docs/guides/api/api-keys))

### 2. Deploy Complete Schema
```bash

# Option A: Using Supabase CLI (Recommended)
# Installation: https://supabase.com/docs/guides/cli/getting-started
supabase link --project-ref YOUR_PROJECT_REF
psql $DATABASE_URL < migrations/production_snapshot_2025_09_11.sql

# Option B: Using Dashboard
# 1. Open SQL Editor in Supabase Dashboard (https://supabase.com/docs/guides/database/sql-editor)
# 2. Copy entire content of production_snapshot_2025_09_11.sql
# 3. Paste and Run
```

### 3. Create Storage Bucket
```bash
# Using CLI (replace with your production bucket name)
# CLI docs: https://supabase.com/docs/reference/cli/supabase-storage
supabase storage create c3d-examples --public false

# Or in Dashboard: Storage → New Bucket → Name: "c3d-examples"
# Storage Guide: https://supabase.com/docs/guides/storage/quickstart
# Note: Replace "c3d-examples" with your production bucket name
```

## ✅ Verification

After deployment, your instance should include:
- 13 tables (11 public + 2 private)
- 33 functions and stored procedures
- All triggers and indexes
- All RLS policies
- Storage bucket with policies

Run this query to verify:
```sql
SELECT 
    'Tables' as item, COUNT(*) as count, '13' as expected
FROM information_schema.tables 
WHERE table_schema IN ('public', 'private')
UNION ALL
SELECT 
    'Functions', COUNT(*), '33'
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public';
```

## 📁 Directory Structure

**After running `./reorganize_migrations.sh`:**

```
supabase/
├── README.md                                   # This file
├── config.toml                                # Supabase configuration
├── migrations/
│   ├── production_snapshot_2025_09_11.sql     # Single source of truth
│   ├── 02_next_feature.sql                    # Future migrations
│   └── archive/
│       └── pre-snapshot/                      # All old migrations archived
│           ├── 01-core-schema/                # (Archived) Core database structure
│           ├── 02-auth-rbac/                  # (Archived) Authentication & authorization
│           ├── 03-clinical-domain/            # (Archived) Clinical data models
│           ├── 04-emg-processing/             # (Archived) EMG analysis tables
│           ├── 05-functions-procedures/       # (Archived) Stored procedures
│           ├── 06-optimization/               # (Archived) Performance optimizations
│           ├── 99-rollbacks/                  # (Archived) Rollback migrations
│           ├── rollback_20250904_emg_statistics_clinical_groups.sql
│           ├── seed.sql
│           └── export-remote-schema-02-09-2025.sql
├── stored_procedures/                         # Individual function files
│   ├── functions/                            # 16 regular functions
│   ├── triggers/                            # 16 trigger functions  
│   ├── ALL_FUNCTIONS_LIST.md                # Complete catalog
│   ├── generate_all_procedures.py           # Extraction script
│   └── README.md                            # Function documentation
├── scripts/                                  # Database & storage utilities
│   ├── database/                            # Database operations
│   │   ├── population/                      # Database population scripts
│   │   │   ├── 01_core_data_population.sql
│   │   │   ├── 02_emg_performance_population.sql
│   │   │   ├── 03_technical_metadata_population.sql
│   │   │   ├── 04_validation_and_summary.sql
│   │   │   ├── simple_populate.sql
│   │   │   ├── populate_sessions.py
│   │   │   └── README.md
│   │   ├── cleanup_demo_data.sql            # Demo data cleanup
│   │   ├── cleanup_test_data.sql            # Test data cleanup utility
│   │   ├── remote_schema_01-09-2025.sql     # Schema exports
│   │   ├── reset_populate.py                # Reset & populate automation
│   │   ├── reset_populate.sh                # Reset script wrapper
│   │   ├── run_all_population.sh            # Population automation
│   │   ├── smart_populate.sql               # Smart population logic
│   │   └── validate_schema.sql              # Schema validation
│   └── storage/                             # Storage bucket utilities
│       ├── cleanup_bucket.py                # Bucket cleanup automation
│       ├── run_cleanup.sh                   # Storage cleanup wrapper
│       └── README.md                        # Storage utilities guide
├── docs/                                     # Database documentation
│   ├── demo_database_replication.md         # Replication demonstrations
│   └── schema_alignment_report.md           # Schema analysis reports
└── reorganize_migrations.sh                  # Migration reorganization script
```

**Before reorganization:** Complex structure with 25+ migration files across multiple directories  
**After reorganization:** Clean structure with single source of truth + archived reference files

## 📋 What's Included

The production snapshot captures your complete database:

- ✅ All 33 stored procedures (including UI-created ones)
- ✅ All tables with exact production structure  
- ✅ All RLS policies as they actually work
- ✅ All triggers and indexes
- ✅ Storage bucket configurations
- ✅ Default data (scoring configurations)
- ✅ All permissions and grants

## 🏗️ Production Snapshot Approach

### Why This Approach?

This method captures your production database state as a single migration file rather than managing multiple separate migrations:

- Single file approach simplifies deployment
- Includes all functions, even those created via UI
- Reflects the current production state
- Reduces migration conflicts and dependencies

### Key Tables
| Table | Purpose | Type |
|-------|---------|------|
| `user_profiles` | Unified user management | Public |
| `patients` | Patient cohorts (pseudonymized) | Public |
| `therapy_sessions` | C3D session tracking | Public |
| `emg_statistics` | EMG analysis results | Public |
| `performance_scores` | GHOSTLY+ scoring | Public |
| `scoring_configuration` | Centralized configs | Public |
| `private.*` | PII and sensitive data | Private |

## 🔄 Creating New Production Snapshots

📖 **Migration References**: [Database Migrations](https://supabase.com/docs/guides/database/schema-migrations) | [CLI Database Commands](https://supabase.com/docs/reference/cli/supabase-db)

### Method 1: Using Supabase MCP (Recommended)
```python
# Use the script at stored_procedures/generate_all_procedures.py
# This extracts all functions from your production database
```

### Method 2: Using pg_dump
```bash
# Export complete schema with all objects
# pg_dump docs: https://www.postgresql.org/docs/current/app-pgdump.html
pg_dump --schema-only --no-owner --no-privileges \
  -h db.YOUR_PROJECT.supabase.co \
  -U postgres \
  -d postgres > production_snapshot_$(date +%Y_%m_%d).sql

# Or use Supabase CLI (recommended)
# CLI docs: https://supabase.com/docs/reference/cli/supabase-db-dump
supabase db dump --schema-only > production_snapshot_$(date +%Y_%m_%d).sql
```

### Method 3: Manual SQL Export
```sql
-- Run this in your production Supabase SQL Editor
SELECT 
    'CREATE OR REPLACE FUNCTION ' || proname || '(' || 
    pg_get_function_identity_arguments(oid) || ') RETURNS ' ||
    pg_get_function_result(oid) || ' AS $$ ' || 
    prosrc || ' $$ LANGUAGE ' || lanname || ';'
FROM pg_proc p
JOIN pg_language l ON p.prolang = l.oid
WHERE pronamespace = 'public'::regnamespace;
```

## 🔧 Environment Configuration

📖 **Environment Setup**: [Environment Variables](https://supabase.com/docs/guides/getting-started/architecture#api-keys) | [Local Development](https://supabase.com/docs/guides/cli/local-development)

Update `.env` files with new instance credentials:

```bash
# Backend .env
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# Frontend .env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 🛠️ Database Utilities

### Database Population & Management
```bash
# Automated population with real clinical data (65+ patients, 400+ sessions)
./scripts/database/run_all_population.sh

# Reset and repopulate with Storage integration
python scripts/database/reset_populate.py

# Manual cleanup of test/demo data
psql $DATABASE_URL < scripts/database/cleanup_test_data.sql
```

### Storage Management
```bash
# Clean up storage bucket artifacts
python scripts/storage/cleanup_bucket.py

# Automated storage cleanup workflow
./scripts/storage/run_cleanup.sh
```

### Schema Validation
```bash
# Validate database schema compliance
psql $DATABASE_URL < scripts/database/validate_schema.sql
```

## 🚀 Advanced Deployment

📖 **Deployment Guides**: [CLI Deployment](https://supabase.com/docs/reference/cli/supabase-db-push) | [Local to Remote](https://supabase.com/docs/guides/cli/local-development#deploy-to-production)

### Using Reorganization Script

**⚠️ Important:** Run this script first to organize your migrations properly:

```bash
# Archive old migrations and prepare clean structure
chmod +x reorganize_migrations.sh
./reorganize_migrations.sh
```

This script will:
- Move all old migration directories to `archive/pre-snapshot/`
- Keep only `production_snapshot_2025_09_11.sql` as active migration
- Create clean structure for future migrations (02_feature.sql, 03_feature.sql, etc.)

### Multiple Deployment Options
1. **Direct SQL**: `psql $DATABASE_URL < production_snapshot.sql`
2. **Supabase CLI**: `supabase db push` ([CLI Docs](https://supabase.com/docs/reference/cli/supabase-db-push))
3. **Dashboard**: Copy/paste in SQL Editor ([SQL Editor Guide](https://supabase.com/docs/guides/database/sql-editor))

## 📚 Best Practices Going Forward

📖 **Best Practices**: [Schema Migrations](https://supabase.com/docs/guides/database/schema-migrations) | [Local Development](https://supabase.com/docs/guides/cli/local-development)

### 1. Version Control Everything
```bash
# New migrations follow sequential naming
02_add_new_feature.sql
03_update_scoring_logic.sql
04_add_performance_indexes.sql
```

### 2. Never Modify Production via UI
- All changes through migration files only ([Migration Guide](https://supabase.com/docs/guides/database/schema-migrations))
- Ensures version control and reproducibility

### 3. Test Locally First
```bash
# Reset local database
# CLI docs: https://supabase.com/docs/reference/cli/supabase-db-reset
supabase db reset

# Apply migrations
# CLI docs: https://supabase.com/docs/reference/cli/supabase-migration-up
supabase migration up

# Test thoroughly before production
```

### 4. Regular Snapshots
```bash
# Periodically create new snapshots for backup
pg_dump --schema-only > snapshots/production_$(date +%Y%m%d).sql
```

## 🛠️ Troubleshooting

📖 **Troubleshooting**: [Database Issues](https://supabase.com/docs/guides/database/database-webhooks) | [Storage Issues](https://supabase.com/docs/guides/storage/troubleshooting) | [RLS Policies](https://supabase.com/docs/guides/database/postgres/row-level-security)

### Functions Missing After Migration
**Solution**: Check `stored_procedures/` for complete function definitions

### RLS Policies Not Working
**Solution**: Ensure helper functions (`get_user_role`, `user_owns_patient`) are created first
- [RLS Policy Guide](https://supabase.com/docs/guides/database/postgres/row-level-security)

### Storage Policies Failing
**Solution**: Create bucket first, then apply storage policies separately
- [Storage Policies Guide](https://supabase.com/docs/guides/storage/security/access-control)

### Sequence Errors
**Solution**: Reset sequences after data import:
```sql
SELECT setval('therapist_code_seq', 
  (SELECT MAX(substring(user_code from 2)::int) 
   FROM user_profiles WHERE role = 'therapist'));
```

## 📖 Reference Files

📖 **Official Documentation**: [Supabase Docs](https://supabase.com/docs) | [PostgreSQL Docs](https://www.postgresql.org/docs/) | [Migration Best Practices](https://supabase.com/docs/guides/database/schema-migrations)

- **Complete Schema**: `migrations/production_snapshot_2025_09_11.sql`
- **Function Catalog**: `stored_procedures/ALL_FUNCTIONS_LIST.md`
- **Individual Functions**: `stored_procedures/functions/` and `stored_procedures/triggers/`
- **Database Scripts**: `scripts/database/` - Population, cleanup, validation utilities
- **Storage Scripts**: `scripts/storage/` - Bucket management and cleanup tools
- **Documentation**: `docs/` - Schema reports and replication guides
- **Reorganization Tool**: `reorganize_migrations.sh`
- **Archived Migrations**: `migrations/archive/pre-snapshot/` - All historical migrations
- **Data Seeding**: `seed.sql`

## ✅ Success Checklist

After deployment, verify:
- [ ] All 13 tables exist (11 public + 2 private)
- [ ] All 33 functions are present
- [ ] All RLS policies are active
- [ ] Storage bucket exists with correct name
- [ ] Default scoring configurations inserted
- [ ] API endpoints return data correctly
- [ ] Authentication works as expected

---

**Note**: The production snapshot approach aims to replicate your database state, including changes made through the Supabase UI that may not be captured in migration files.