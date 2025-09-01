# Project Scripts

Utility scripts for database operations and project maintenance.

## Directory Structure

```
scripts/
├── database/                    # Database management
│   ├── schema/                 # Schema definitions
│   ├── population/             # Data population scripts
│   ├── utilities/              # Helper scripts
│   └── archives/               # Deprecated scripts
│
├── migration/                   # Database migrations
│
└── docs/                        # Documentation
```

## Database Scripts

### Population Scripts (`database/population/`)

Three approaches for populating test data:

1. **smart_populate.sql** - Dynamically retrieves files from Supabase Storage
   - Queries actual Storage bucket for real C3D files
   - Maps files to patients using patient codes
   - Creates realistic clinical data

2. **01-04_*.sql** - Four-step static population
   - Comprehensive test data with hardcoded paths
   - Used for CI/CD pipelines

3. **simple_populate.sql** - Minimal test data
   - Quick testing with basic scenarios

### Utilities (`database/utilities/`)

- **reset_populate.sh** - Main reset and populate script
- **reset_populate.py** - Python version with Storage integration
- **cleanup_demo_data.sql** - Remove test data only
- **run_all_population.sh** - Execute all population scripts

### Usage

```bash
# Recommended: Use smart population with actual Storage files
psql $DATABASE_URL -f scripts/database/population/smart_populate.sql

# For CI/CD: Use static 4-step population
./scripts/database/utilities/run_all_population.sh

# For quick testing: Use simple population
psql $DATABASE_URL -f scripts/database/population/simple_populate.sql

# Complete reset and populate
./scripts/database/utilities/reset_populate.sh
```

### Schema (`database/schema/`)

- **remote_schema_01-09-2025.sql** - Current production schema
- **validate_schema.sql** - Schema validation queries

## Related Documentation

- `/scripts/database/README.md` - Detailed database scripts documentation
- `/backend/CLAUDE.md` - Backend development guidelines
- `/frontend/CLAUDE.md` - Frontend development guidelines