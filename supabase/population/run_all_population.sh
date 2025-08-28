#!/bin/bash
# ==============================================================================
# EMG C3D Analyzer - Complete Database Population Script
# ==============================================================================
# 🎯 PURPOSE: Execute all population scripts in correct order
# 📅 Created: 2025-08-27
# ==============================================================================

set -e  # Exit on any error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'  
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Database connection check
echo -e "${BLUE}🔍 Checking database connection...${NC}"
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ psql command not found. Please install PostgreSQL client.${NC}"
    exit 1
fi

# Get database URL
if [ -z "$DATABASE_URL" ]; then
    echo -e "${YELLOW}⚠️  DATABASE_URL not set. Please provide database connection string:${NC}"
    echo "Example: postgresql://postgres:password@localhost:5432/postgres"
    read -p "Database URL: " DATABASE_URL
fi

echo -e "${GREEN}✅ Database connection configured${NC}"
echo ""

# Function to execute SQL script
execute_script() {
    local script_name=$1
    local description=$2
    
    echo -e "${BLUE}🚀 Executing: ${script_name}${NC}"
    echo -e "${YELLOW}   ${description}${NC}"
    
    if psql "$DATABASE_URL" -f "$script_name" > /tmp/sql_output.log 2>&1; then
        echo -e "${GREEN}✅ Success: ${script_name}${NC}"
        
        # Show summary from script output
        if grep -q "PHASE.*COMPLETE\|status" /tmp/sql_output.log; then
            echo -e "${BLUE}   Summary:${NC}"
            grep -E "PHASE.*COMPLETE|status.*🎉|Records|patients|sessions" /tmp/sql_output.log | head -5 | sed 's/^/   /'
        fi
    else
        echo -e "${RED}❌ Failed: ${script_name}${NC}"
        echo -e "${RED}Error details:${NC}"
        cat /tmp/sql_output.log | tail -10 | sed 's/^/   /'
        exit 1
    fi
    echo ""
}

# Main execution sequence
echo -e "${GREEN}🎊 EMG C3D Analyzer - Complete Database Population 🎊${NC}"
echo -e "${BLUE}📊 Target: 5 clinicians, 65+ patients, 400+ sessions, complete EMG analysis${NC}"
echo ""

# Check if scripts exist
SCRIPTS=(
    "01_core_data_population.sql"
    "02_emg_performance_population.sql" 
    "03_technical_metadata_population.sql"
    "04_validation_and_summary.sql"
)

for script in "${SCRIPTS[@]}"; do
    if [ ! -f "$script" ]; then
        echo -e "${RED}❌ Script not found: $script${NC}"
        echo -e "${YELLOW}Please ensure you're running this from the database/population/ directory${NC}"
        exit 1
    fi
done

echo -e "${GREEN}✅ All population scripts found${NC}"
echo ""

# Execute population sequence
echo -e "${BLUE}🔄 Starting database population sequence...${NC}"
echo ""

execute_script "01_core_data_population.sql" "Users, Patients, Therapy Sessions (Foundation)"
execute_script "02_emg_performance_population.sql" "EMG Statistics + GHOSTLY+ Performance Scores"
execute_script "03_technical_metadata_population.sql" "C3D Technical Data + Processing Parameters"  
execute_script "04_validation_and_summary.sql" "Data Validation + Quality Assessment"

# Final summary
echo -e "${GREEN}🎉 DATABASE POPULATION COMPLETED SUCCESSFULLY! 🎉${NC}"
echo ""
echo -e "${BLUE}📊 Population Summary:${NC}"
echo -e "${GREEN}   ✅ 5 Clinical user profiles (therapists, researchers, admin)${NC}"
echo -e "${GREEN}   ✅ 65 Diverse patients across 15 pathology categories${NC}"
echo -e "${GREEN}   ✅ 400+ Therapy sessions with realistic progression${NC}"
echo -e "${GREEN}   ✅ 300+ EMG statistics (85% bilateral CH1+CH2)${NC}"
echo -e "${GREEN}   ✅ 200+ GHOSTLY+ performance scores (constraint-compliant)${NC}"
echo -e "${GREEN}   ✅ 200+ C3D technical records (realistic acquisition)${NC}"
echo -e "${GREEN}   ✅ 200+ Processing parameters (EMG clinical standards)${NC}"
echo -e "${GREEN}   ✅ 150+ BFR monitoring records (95% safety compliant)${NC}"
echo ""
echo -e "${BLUE}🏥 Clinical Scenarios Populated:${NC}"
echo -e "${GREEN}   • Stroke Rehabilitation (hemiparesis patterns)${NC}"
echo -e "${GREEN}   • Multiple Sclerosis (fatigue variability)${NC}"
echo -e "${GREEN}   • Parkinson Disease (bradykinesia effects)${NC}"
echo -e "${GREEN}   • Orthopedic Rehabilitation (post-surgical progression)${NC}"
echo -e "${GREEN}   • Spinal Cord Injury (functional limitations)${NC}"
echo -e "${GREEN}   • Mixed rehabilitation conditions${NC}"
echo ""
echo -e "${BLUE}🚀 Next Steps:${NC}"
echo -e "${YELLOW}   1. Test application with populated data${NC}"
echo -e "${YELLOW}   2. Verify frontend integration${NC}"
echo -e "${YELLOW}   3. Run performance tests${NC}"
echo -e "${YELLOW}   4. Create database backup${NC}"
echo ""
echo -e "${GREEN}✅ Database ready for development, testing, and demonstration!${NC}"

# Cleanup
rm -f /tmp/sql_output.log