#!/usr/bin/env python3
"""
Populate Realistic Sessions Script
==================================

This script has been moved to a better location for organization.
This file exists for backward compatibility only.

The new location is: /scripts/database/populate_sessions.py

This wrapper will redirect to the new location.
"""

import sys
import os
from pathlib import Path

# Redirect to new location
new_script = Path(__file__).resolve().parent.parent.parent / "scripts" / "database" / "populate_sessions.py"

if new_script.exists():
    print(f"Note: This script has moved to {new_script}")
    print("Redirecting to new location...")
    
    # Execute the new script with the same arguments
    import subprocess
    result = subprocess.run([sys.executable, str(new_script)] + sys.argv[1:])
    sys.exit(result.returncode)
else:
    # If new script doesn't exist, import the original functionality
    # This ensures tests don't break during transition
    from populate_realistic_sessions import *
    
    if __name__ == "__main__":
        # Run the original script
        import asyncio
        asyncio.run(main())