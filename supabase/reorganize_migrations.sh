#!/bin/bash

# Script to reorganize migrations for production snapshot approach
# Run this to archive old migrations and start fresh

echo "🔄 Reorganizing Supabase migrations..."

# Create archive directory if it doesn't exist
mkdir -p supabase/migrations/archive/pre-snapshot

# Move all existing migrations to archive (except our new snapshot)
echo "📦 Archiving old migrations..."
find supabase/migrations -maxdepth 2 -name "*.sql" \
    ! -name "production_snapshot_2025_09_11.sql" \
    ! -path "*/archive/*" \
    -exec mv {} supabase/migrations/archive/pre-snapshot/ \;

# Move old directories to archive
for dir in 01-core-schema 02-auth-rbac 03-clinical-domain 04-emg-processing 05-functions-procedures 06-optimization 99-rollbacks; do
    if [ -d "supabase/migrations/$dir" ]; then
        mv "supabase/migrations/$dir" "supabase/migrations/archive/pre-snapshot/"
        echo "  Archived: $dir"
    fi
done

# Already archived directory can stay where it is
if [ -d "supabase/migrations/archive" ] && [ ! -d "supabase/migrations/archive/pre-snapshot/archive" ]; then
    echo "  Archive folder already in place"
fi

echo ""
echo "✅ Migration reorganization complete!"
echo ""
echo "New structure:"
echo "  supabase/migrations/"
echo "    ├── production_snapshot_2025_09_11.sql  (Active - Single source of truth)"
echo "    └── archive/"
echo "        └── pre-snapshot/  (All old migrations for reference)"
echo ""
echo "To deploy to a new instance:"
echo "  1. Link to new project: supabase link --project-ref YOUR_REF"
echo "  2. Run snapshot: psql \$DATABASE_URL < supabase/migrations/production_snapshot_2025_09_11.sql"
echo "  3. Create bucket: supabase storage create c3d-examples --public false"
echo ""
echo "Future migrations should be named: 02_description.sql, 03_description.sql, etc."