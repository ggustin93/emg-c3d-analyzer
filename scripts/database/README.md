# Database Scripts Organization

## 📁 Directory Structure

```
scripts/database/
├── README.md                          # This file - explains organization
├── schema/                            # Database schema files
│   ├── remote_schema_01-09-2025.sql  # Current production schema snapshot
│   └── validate_schema.sql           # Schema validation queries
├── population/                        # Data population scripts
│   ├── 01_core_data_population.sql   # Step 1: Users, patients, sessions
│   ├── 02_emg_performance_population.sql # Step 2: EMG stats, performance
│   ├── 03_technical_metadata_population.sql # Step 3: Processing params
│   ├── 04_validation_and_summary.sql # Step 4: Validation & reports
│   ├── simple_populate.sql           # Quick test data (minimal)
│   └── smart_populate.sql            # Dynamic Storage-aware population
├── utilities/                         # Utility scripts
│   ├── reset_populate.sh             # Main reset & populate script
│   ├── reset_populate.py             # Python version with Storage upload
│   ├── run_all_population.sh         # Run all population scripts
│   └── cleanup_demo_data.sql         # Clean test data only
└── archives/                          # Old/deprecated scripts
    └── populate_sessions.py          # Old Python population (deprecated)
```

## 📊 File Purposes & Differences

### Population Scripts Comparison

| Script | Purpose | Data Source | Use Case |
|--------|---------|-------------|----------|
| **smart_populate.sql** | **RECOMMENDED** - Dynamically retrieves actual files from Storage | Supabase Storage API | Production-like testing |
| **01-04_*.sql** | 4-step comprehensive population with hardcoded paths | Static test data | CI/CD pipelines |
| **simple_populate.sql** | Minimal test data for quick testing | Hardcoded minimal | Quick dev testing |

### Key Differences

#### 🌟 **smart_populate.sql** (NEW - RECOMMENDED)
- **Dynamic**: Queries actual Storage bucket for real C3D files
- **Intelligent**: Maps files to patients using patient codes
- **Realistic**: Uses therapy_session_processor.py patterns
- **Complete**: Populates ALL tables with proper relationships
- **Per-channel**: Creates 2 EMG + 2 BFR records per session

#### 📦 **01-04_*.sql** (Comprehensive Static)
- **Static**: Uses hardcoded file paths
- **4-step process**: Modular execution
- **Detailed**: Very comprehensive with variations
- **CI/CD friendly**: Predictable for automated testing
- **May have issues**: Hardcoded paths might not exist

#### 🚀 **simple_populate.sql** (Quick Testing)
- **Minimal**: Just enough data to test
- **Fast**: Quick execution
- **Limited**: Only basic test scenarios
- **Dev-friendly**: Good for local development

## 🔧 Usage Guide

### For Development Testing (Recommended)
```bash
# Use smart population with actual Storage files
psql $DATABASE_URL -f scripts/database/population/smart_populate.sql
```

### For CI/CD Pipeline
```bash
# Use 4-step static population
./scripts/database/run_all_population.sh
```

### For Quick Testing
```bash
# Use simple population
psql $DATABASE_URL -f scripts/database/population/simple_populate.sql
```

### Complete Reset & Populate
```bash
# Full reset with Storage file extraction
./scripts/database/reset_populate.sh

# Or with Python (includes Storage upload option)
python scripts/database/reset_populate.py
```

## 🎯 Recommendations

1. **Use `smart_populate.sql`** for realistic testing with actual Storage files
2. **Keep `01-04_*.sql`** for CI/CD pipelines (predictable)
3. **Use `simple_populate.sql`** for quick local testing
4. **Archive `populate_sessions.py`** (replaced by smart_populate.sql)

## ⚠️ Important Notes

- **smart_populate.sql** requires active Supabase connection with Storage access
- **01-04_*.sql** may fail if hardcoded paths don't match your Storage
- Always run schema validation after population: `psql $DATABASE_URL -f scripts/database/validate_schema.sql`