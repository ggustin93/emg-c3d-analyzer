#!/usr/bin/env python3
"""
Enhanced startup script for debugging Coolify deployment issues.
This script provides detailed logging before starting the FastAPI app.
"""

import sys
import os
import traceback

print("=== BACKEND STARTUP SCRIPT ===", flush=True)
print(f"Python: {sys.version}", flush=True)
print(f"Working directory: {os.getcwd()}", flush=True)
print(f"Python path: {sys.path}", flush=True)

# Log environment variables (hiding sensitive values)
print("\nEnvironment variables:", flush=True)
for key in sorted(os.environ.keys()):
    if any(x in key.upper() for x in ['SUPABASE', 'REDIS', 'ENVIRONMENT', 'LOG', 'HOST', 'PORT', 'SECRET', 'WEBHOOK']):
        value = os.environ[key]
        # Hide sensitive values
        if any(x in key.upper() for x in ['KEY', 'SECRET', 'PASSWORD']):
            value = value[:10] + '...' if value else 'EMPTY'
        print(f"  {key}={value}", flush=True)

# Check if required environment variables are present
print("\nChecking required environment variables:", flush=True)
required_vars = {
    'SUPABASE_URL': os.getenv('SUPABASE_URL'),
    'SUPABASE_ANON_KEY': os.getenv('SUPABASE_ANON_KEY'),
    'SUPABASE_SERVICE_KEY': os.getenv('SUPABASE_SERVICE_KEY'),
    'REDIS_URL': os.getenv('REDIS_URL')
}

for var_name, var_value in required_vars.items():
    status = "✅ SET" if var_value else "❌ MISSING"
    print(f"  {var_name}: {status}", flush=True)

# Try to import the main app
print("\nImporting main application...", flush=True)
try:
    from main import app
    print("✅ Main app imported successfully", flush=True)
except ImportError as e:
    print(f"❌ Failed to import main app: {e}", flush=True)
    print("Traceback:", flush=True)
    print(traceback.format_exc(), flush=True)
    sys.exit(1)
except Exception as e:
    print(f"❌ Unexpected error importing main app: {e}", flush=True)
    print("Traceback:", flush=True)
    print(traceback.format_exc(), flush=True)
    sys.exit(1)

# If we get here, start uvicorn
print("\nStarting Uvicorn server...", flush=True)
import uvicorn
try:
    uvicorn.run(app, host="0.0.0.0", port=8080, log_level="info")
except Exception as e:
    print(f"❌ Failed to start Uvicorn: {e}", flush=True)
    print(traceback.format_exc(), flush=True)
    sys.exit(1)