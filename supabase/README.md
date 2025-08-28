# EMG C3D Analyzer - Supabase Configuration

## 📁 Directory Structure

```
supabase/
├── README.md                              # This file - Supabase overview
├── config.toml                           # Supabase project configuration
├── migrations/                           # Database schema migrations
│   ├── 20250827000000_clean_schema_v2.sql # Core schema v2.0
│   ├── 20250827001000_scoring_normalization.sql # Schema v2.1 normalization
│   └── archive/                          # Archived migration files
└── population/                           # Database population scripts ✨
    ├── README.md                         # Complete population guide  
    ├── run_all_population.sh            # Automated execution script
    ├── 01_core_data_population.sql      # Users, patients, sessions
    ├── 02_emg_performance_population.sql # EMG stats + performance scores
    ├── 03_technical_metadata_population.sql # C3D technical data
    └── 04_validation_and_summary.sql    # Quality validation
```

## 🎯 Current Status

**Schema Version**: v2.1 (Clean + Normalized) ✅  
**Database Population**: Complete realistic clinical data ✅  
**Production Ready**: Yes 🚀

## 🚀 Quick Operations

### Deploy Schema
```bash
cd supabase/
supabase db push
```

### Populate Database
```bash
cd supabase/population/
./run_all_population.sh
```

### Reset Database (Development)
```bash
cd supabase/
supabase db reset
```

## 📊 Schema Features

### Core Architecture
- **Security-First**: RLS policies for granular access control
- **Schema Separation**: public (pseudonymized) vs private (PII) 
- **UUID Relationships**: Proper foreign key integrity
- **Redis-Ready**: High-performance analytics caching

### Key Tables
| Table | Purpose | Records (Populated) |
|-------|---------|---------------------|
| `user_profiles` | Unified user management | 5 |
| `patients` | Patient cohorts (pseudonymized) | 65+ |
| `therapy_sessions` | C3D session tracking | 400+ |
| `emg_statistics` | EMG analysis results | 300+ |
| `performance_scores` | GHOSTLY+ scoring | 200+ |
| `scoring_configuration` | Centralized scoring configs | 2 global |

## 🏥 Database Population

The `population/` directory contains professional-grade scripts to populate the database with:

- **65+ patients** across 15 pathology categories (stroke, MS, Parkinson's, etc.)
- **400+ therapy sessions** with realistic temporal progression  
- **Complete EMG analysis** with bilateral patterns (CH1/CH2)
- **GHOSTLY+ performance scoring** with clinical compliance
- **Technical metadata** (C3D specs, processing parameters, BFR monitoring)

**Execution**: Single command `./run_all_population.sh` creates production-ready clinical data.

## 🔗 Related Files

- **Migration Reports**: `MIGRATION_SUCCESS_REPORT.md`, `MIGRATION_DEPLOYMENT_GUIDE.md`
- **Schema Planning**: `TODO-27-08-25-simplify-schema.md`
- **Backend Integration**: `backend/services/clinical/therapy_session_processor.py`

## 🎊 Production Ready

The Supabase configuration delivers:
- ✅ **Schema v2.1**: Clean, normalized, Redis-optimized
- ✅ **Clinical Data**: 1,500+ records with realistic patterns
- ✅ **Security**: Comprehensive RLS policies
- ✅ **Performance**: Strategic indexing and caching
- ✅ **Documentation**: Complete guides and validation

Perfect for development, testing, demonstration, and clinical research! 🚀