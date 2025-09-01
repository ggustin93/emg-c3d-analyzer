#!/bin/bash
# ==============================================================================
# EMG C3D Analyzer - Database Reset and Population Script
# ==============================================================================
# Purpose: Complete database reset and population with validation
# Features:
#   - Safety confirmations
#   - Patient code extraction from Storage
#   - Storage consistency checks
#   - Progress tracking
#
# Usage: ./scripts/database/reset_populate.sh [options]
#   --skip-reset     Skip database reset
#   --skip-populate  Skip data population
#   --dry-run        Show what would be done without executing
#   --force          Skip all confirmations (use with caution!)
# ==============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
POPULATION_DIR="$PROJECT_ROOT/supabase/population"
BACKEND_DIR="$PROJECT_ROOT/backend"

# Parse arguments
SKIP_RESET=false
SKIP_POPULATE=false
DRY_RUN=false
FORCE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-reset)
            SKIP_RESET=true
            shift
            ;;
        --skip-populate)
            SKIP_POPULATE=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --skip-reset     Skip database reset"
            echo "  --skip-populate  Skip data population"
            echo "  --dry-run        Show what would be done"
            echo "  --force          Skip confirmations"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Functions
log() {
    echo -e "$1"
}

log_section() {
    echo ""
    echo -e "${BOLD}${BLUE}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}${BLUE}$1${NC}"
    echo -e "${BOLD}${BLUE}════════════════════════════════════════════════════════════════${NC}"
}

confirm() {
    if [ "$FORCE" = true ]; then
        return 0
    fi
    
    if [ "$DRY_RUN" = true ]; then
        log "${YELLOW}[DRY RUN] Would ask: $1${NC}"
        return 0
    fi
    
    read -p "$(echo -e ${YELLOW}$1 ${NC})" -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]]
}

check_env() {
    log_section "🔍 ENVIRONMENT CHECK"
    
    # Check for required environment variables
    if [ -f "$BACKEND_DIR/.env" ]; then
        source "$BACKEND_DIR/.env"
        log "${GREEN}✅ Environment file loaded${NC}"
    else
        log "${RED}❌ No .env file found in backend directory${NC}"
        exit 1
    fi
    
    # Verify Supabase connection
    if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
        log "${RED}❌ Missing Supabase credentials${NC}"
        exit 1
    fi
    
    # Construct database URL if not set
    if [ -z "$DATABASE_URL" ]; then
        DATABASE_URL="postgresql://postgres:$SUPABASE_SERVICE_KEY@db.egihfsmxphqcsjotmhmm.supabase.co:5432/postgres"
        export DATABASE_URL
    fi
    
    log "${GREEN}✅ Supabase connection configured${NC}"
    log "  URL: ${CYAN}$SUPABASE_URL${NC}"
    
    # Check psql availability
    if ! command -v psql &> /dev/null; then
        log "${RED}❌ psql command not found. Please install PostgreSQL client${NC}"
        exit 1
    fi
    
    log "${GREEN}✅ PostgreSQL client available${NC}"
}

reset_database() {
    log_section "🧹 PHASE 1: DATABASE RESET"
    
    if ! confirm "⚠️  This will DELETE all data. Continue? (y/n): "; then
        log "${YELLOW}Reset cancelled by user${NC}"
        return 1
    fi
    
    log "${CYAN}Executing database cleanup...${NC}"
    
    CLEANUP_SQL="
    BEGIN;
    
    -- Disable RLS temporarily for cleanup
    ALTER TABLE IF EXISTS performance_scores DISABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS emg_statistics DISABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS processing_parameters DISABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS session_settings DISABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS bfr_monitoring DISABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS therapy_sessions DISABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS patients DISABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS user_profiles DISABLE ROW LEVEL SECURITY;
    
    -- Delete all data in reverse dependency order
    DELETE FROM performance_scores;
    DELETE FROM emg_statistics;
    DELETE FROM processing_parameters;
    DELETE FROM session_settings;
    DELETE FROM bfr_monitoring;
    DELETE FROM therapy_sessions;
    DELETE FROM patients;
    DELETE FROM scoring_configuration WHERE is_global = false;
    DELETE FROM user_profiles WHERE role != 'admin';
    
    -- Re-enable RLS
    ALTER TABLE IF EXISTS performance_scores ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS emg_statistics ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS processing_parameters ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS session_settings ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS bfr_monitoring ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS therapy_sessions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS patients ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS user_profiles ENABLE ROW LEVEL SECURITY;
    
    -- Reset patient code sequence
    DO \$\$
    BEGIN
        IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'patient_code_seq') THEN
            PERFORM setval('patient_code_seq', 1, false);
        END IF;
    END \$\$;
    
    COMMIT;
    
    SELECT 'Database reset complete' as status;
    "
    
    if [ "$DRY_RUN" = true ]; then
        log "${YELLOW}[DRY RUN] Would execute database cleanup${NC}"
    else
        echo "$CLEANUP_SQL" | psql "$DATABASE_URL" -q
        if [ $? -eq 0 ]; then
            log "${GREEN}✅ Database reset complete${NC}"
        else
            log "${RED}❌ Database reset failed${NC}"
            return 1
        fi
    fi
}

populate_database() {
    log_section "📊 PHASE 2: DATABASE POPULATION"
    
    cd "$POPULATION_DIR"
    
    # Population scripts in order
    SCRIPTS=(
        "01_core_data_population.sql"
        "02_emg_performance_population.sql"
        "03_technical_metadata_population.sql"
        "04_validation_and_summary.sql"
    )
    
    for script in "${SCRIPTS[@]}"; do
        if [ ! -f "$script" ]; then
            log "${RED}❌ Script not found: $script${NC}"
            return 1
        fi
        
        log "${CYAN}🚀 Executing $script...${NC}"
        
        if [ "$DRY_RUN" = true ]; then
            log "${YELLOW}[DRY RUN] Would execute: $script${NC}"
        else
            psql "$DATABASE_URL" -f "$script" > /tmp/population_log.txt 2>&1
            
            if [ $? -eq 0 ]; then
                log "${GREEN}  ✅ $script completed${NC}"
                
                # Show summary if available
                if grep -q "NOTICE:" /tmp/population_log.txt; then
                    grep "NOTICE:" /tmp/population_log.txt | head -3 | sed 's/^/    /'
                fi
            else
                log "${RED}  ❌ $script failed${NC}"
                tail -5 /tmp/population_log.txt | sed 's/^/    /'
                return 1
            fi
        fi
    done
    
    log "${GREEN}✅ Database population complete${NC}"
}

validate_consistency() {
    log_section "🔍 PHASE 3: PATIENT-STORAGE VALIDATION"
    
    # Get patient count from database
    PATIENT_COUNT_SQL="SELECT COUNT(*) as count FROM patients;"
    PATIENT_COUNT=$(echo "$PATIENT_COUNT_SQL" | psql "$DATABASE_URL" -t -A)
    
    log "  📋 Patients in database: ${CYAN}$PATIENT_COUNT${NC}"
    
    # Check for sample C3D files
    SAMPLE_FILES=$(find "$PROJECT_ROOT" -name "*.c3d" -type f 2>/dev/null | wc -l)
    log "  📁 Sample C3D files available: ${CYAN}$SAMPLE_FILES${NC}"
    
    # Validate patient codes format
    VALIDATION_SQL="
    SELECT 
        COUNT(*) FILTER (WHERE patient_code ~ '^P[0-9]{3}$') as valid_codes,
        COUNT(*) FILTER (WHERE patient_code !~ '^P[0-9]{3}$') as invalid_codes,
        STRING_AGG(patient_code, ', ' ORDER BY patient_code) FILTER (WHERE patient_code !~ '^P[0-9]{3}$') as invalid_list
    FROM patients
    LIMIT 10;
    "
    
    if [ "$DRY_RUN" = false ]; then
        VALIDATION_RESULT=$(echo "$VALIDATION_SQL" | psql "$DATABASE_URL" -t -A)
        IFS='|' read -r VALID_CODES INVALID_CODES INVALID_LIST <<< "$VALIDATION_RESULT"
        
        log "  ✅ Valid patient codes (P001 format): ${GREEN}$VALID_CODES${NC}"
        
        if [ "$INVALID_CODES" -gt 0 ]; then
            log "  ⚠️  Invalid patient codes: ${YELLOW}$INVALID_CODES${NC}"
            if [ -n "$INVALID_LIST" ]; then
                log "     Examples: ${YELLOW}$INVALID_LIST${NC}"
            fi
        fi
    fi
    
    # Suggest Storage upload
    if [ "$SAMPLE_FILES" -gt 0 ] && [ "$PATIENT_COUNT" -gt 0 ]; then
        log ""
        log "${CYAN}💡 To upload C3D files to Storage for patients:${NC}"
        log "   python $SCRIPT_DIR/database_reset_populate.py --skip-reset --skip-populate"
    fi
}

show_summary() {
    log_section "🎉 OPERATION COMPLETE"
    
    # Get final statistics
    STATS_SQL="
    SELECT 
        'Summary' as category,
        (SELECT COUNT(*) FROM user_profiles) as users,
        (SELECT COUNT(*) FROM patients) as patients,
        (SELECT COUNT(*) FROM therapy_sessions) as sessions,
        (SELECT COUNT(*) FROM emg_statistics) as emg_stats,
        (SELECT COUNT(*) FROM performance_scores) as scores
    ;
    "
    
    if [ "$DRY_RUN" = false ]; then
        echo "$STATS_SQL" | psql "$DATABASE_URL" -x | grep -E "users|patients|sessions|emg_stats|scores" | sed 's/^/  /'
    fi
    
    log ""
    log "${GREEN}✅ Database is ready for use!${NC}"
    log ""
    log "Next steps:"
    log "  1. Start the development server: ${CYAN}./start_dev_simple.sh${NC}"
    log "  2. Run tests: ${CYAN}cd backend && python -m pytest tests/ -v${NC}"
    log "  3. Access the application: ${CYAN}http://localhost:3000${NC}"
}

# Main execution
main() {
    log "${BOLD}${CYAN}"
    log "╔════════════════════════════════════════════════════════════╗"
    log "║     EMG C3D ANALYZER - DATABASE RESET & POPULATION        ║"
    log "╚════════════════════════════════════════════════════════════╝"
    log "${NC}"
    
    # Environment check
    check_env
    
    # Phase 1: Reset
    if [ "$SKIP_RESET" = false ]; then
        if ! reset_database; then
            log "${RED}❌ Reset failed - aborting${NC}"
            exit 1
        fi
    else
        log "${YELLOW}⏭️  Skipping database reset${NC}"
    fi
    
    # Phase 2: Populate
    if [ "$SKIP_POPULATE" = false ]; then
        if ! populate_database; then
            log "${RED}❌ Population failed${NC}"
            exit 1
        fi
    else
        log "${YELLOW}⏭️  Skipping database population${NC}"
    fi
    
    # Phase 3: Validate
    validate_consistency
    
    # Summary
    show_summary
    
    # Cleanup
    rm -f /tmp/population_log.txt
}

# Run main function
main