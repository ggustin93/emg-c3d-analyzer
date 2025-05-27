#!/bin/bash

# Navigate to the script's directory (project root)
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)" # Get absolute path for robustness
cd "$PROJECT_ROOT"

VENV_PATH="$PROJECT_ROOT/.venv"
BACKEND_LOG="$PROJECT_ROOT/backend.log"
BACKEND_ERROR_LOG="$PROJECT_ROOT/backend.error.log"

echo "Starting development servers..."
echo "Project root: $PROJECT_ROOT"
echo "Backend output will be logged to: $BACKEND_LOG"
echo "Backend errors will be logged to: $BACKEND_ERROR_LOG"
# Clear previous logs
> "$BACKEND_LOG"
> "$BACKEND_ERROR_LOG"

# Check if virtual environment exists
if [ ! -f "$VENV_PATH/bin/activate" ]; then
    echo "ERROR: Python virtual environment not found at $VENV_PATH."
    echo "Please run a setup script (e.g., setup_project.sh) to create the venv and install dependencies."
    exit 1
fi

# Activate virtual environment
echo "Activating Python virtual environment..."
source "$VENV_PATH/bin/activate"

# Check for python and fastapi in venv
if ! command -v python3 &> /dev/null || ! python3 -c "import fastapi; import uvicorn" &> /dev/null; then
    echo "ERROR: Python 3, FastAPI, or Uvicorn not found in the virtual environment."
    echo "Please ensure backend dependencies are installed correctly in $VENV_PATH."
    echo "You might need to run your project setup script again."
    deactivate
    exit 1
fi

echo "Starting backend server (FastAPI using python3 main.py)..."
# Start backend in the background, redirecting output
# The main.py is expected to run uvicorn.run("c3d_api:app", ...)
python3 main.py > "$BACKEND_LOG" 2> "$BACKEND_ERROR_LOG" &
BACKEND_PID=$! # Store PID of the backend process

# Give backend a moment to start
echo "Waiting for backend to initialize (PID: $BACKEND_PID)..."
sleep 3 # Adjust if your backend takes longer to start

# Check if backend process is still running
if ! ps -p $BACKEND_PID > /dev/null; then
    echo "ERROR: Backend server failed to start or exited prematurely."
    echo "Check $BACKEND_LOG and $BACKEND_ERROR_LOG for details."
    deactivate
    exit 1
else
    echo "Backend server appears to be running (PID: $BACKEND_PID)."
    echo "View logs: tail -f $BACKEND_LOG (or $BACKEND_ERROR_LOG)"
fi

# Function to kill the backend process on script exit
cleanup() {
    echo "" # Newline for cleaner exit messages
    echo "Initiating cleanup..."
    if ps -p $BACKEND_PID > /dev/null; then
        echo "Stopping backend server (PID: $BACKEND_PID)..."
        kill $BACKEND_PID
        wait $BACKEND_PID 2>/dev/null # Wait for it to actually terminate
        echo "Backend server stopped."
    else
        echo "Backend server (PID: $BACKEND_PID) was not running or already stopped."
    fi
    echo "Deactivating virtual environment..."
    deactivate
    echo "Script finished."
}

# Trap SIGINT (Ctrl+C) and EXIT signals to run cleanup function
trap cleanup SIGINT EXIT

# Navigate to frontend directory
if [ -d "frontend" ]; then
    cd frontend
    echo "Starting frontend development server (npm run start) in $(pwd)..."
    npm run start # This will take over the foreground
else
    echo "Error: frontend/ directory not found in $PROJECT_ROOT."
    # Kill the backend if frontend isn't found
    cleanup # Call cleanup directly
    exit 1
fi