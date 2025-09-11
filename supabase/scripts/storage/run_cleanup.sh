#!/bin/bash

# Cleanup script for c3d-examples bucket
# Removes test files and duplicates

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}    C3D-Examples Bucket Cleanup Tool${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "backend/config.py" ]; then
    echo -e "${RED}❌ Error: Must run from project root directory${NC}"
    echo -e "${YELLOW}💡 Usage: ./scripts/storage/run_cleanup.sh${NC}"
    exit 1
fi

# Check for Python environment
if [ ! -d "backend/venv" ]; then
    echo -e "${YELLOW}⚠️  Python virtual environment not found${NC}"
    echo -e "${YELLOW}Creating virtual environment...${NC}"
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    cd ..
else
    source backend/venv/bin/activate
fi

# Parse command line arguments
DRY_RUN=true
SKIP_DUPLICATES=""
SKIP_TEST=""
SKIP_NON_GHOSTLY=""

for arg in "$@"
do
    case $arg in
        --execute)
            DRY_RUN=false
            shift
            ;;
        --skip-duplicates)
            SKIP_DUPLICATES="--skip-duplicates"
            shift
            ;;
        --skip-test)
            SKIP_TEST="--skip-test"
            shift
            ;;
        --skip-non-ghostly)
            SKIP_NON_GHOSTLY="--skip-non-ghostly"
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --execute          Actually delete files (default is dry-run)"
            echo "  --skip-duplicates  Skip duplicate detection and removal"
            echo "  --skip-test        Skip test file removal"
            echo "  --skip-non-ghostly Skip non-Ghostly file removal"
            echo "  --help, -h         Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                         # Dry run - preview all deletions"
            echo "  $0 --execute               # Delete all: test, non-Ghostly, duplicates"
            echo "  $0 --skip-duplicates       # Only remove test & non-Ghostly files"
            echo "  $0 --skip-test             # Only remove non-Ghostly & duplicates"
            echo "  $0 --skip-non-ghostly      # Only remove test files & duplicates"
            exit 0
            ;;
    esac
done

# Build command
CMD="python scripts/storage/cleanup_bucket.py"

if [ "$DRY_RUN" = false ]; then
    CMD="$CMD --execute"
    echo -e "${RED}⚠️  WARNING: Running in EXECUTE mode - files will be deleted!${NC}"
    echo -e "${YELLOW}Press Ctrl+C to cancel, or Enter to continue...${NC}"
    read
else
    echo -e "${GREEN}✅ Running in DRY RUN mode - no files will be deleted${NC}"
fi

if [ ! -z "$SKIP_DUPLICATES" ]; then
    CMD="$CMD $SKIP_DUPLICATES"
    echo -e "${YELLOW}📝 Skipping duplicate detection${NC}"
fi

if [ ! -z "$SKIP_TEST" ]; then
    CMD="$CMD $SKIP_TEST"
    echo -e "${YELLOW}📝 Skipping test file removal${NC}"
fi

if [ ! -z "$SKIP_NON_GHOSTLY" ]; then
    CMD="$CMD $SKIP_NON_GHOSTLY"
    echo -e "${YELLOW}📝 Skipping non-Ghostly file removal${NC}"
fi

echo ""
echo -e "${BLUE}Running cleanup...${NC}"
echo ""

# Run the cleanup script
$CMD

# Check exit status
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Cleanup completed successfully!${NC}"
else
    echo ""
    echo -e "${RED}❌ Cleanup failed!${NC}"
    exit 1
fi