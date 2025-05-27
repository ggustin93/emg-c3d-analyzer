    #!/bin/bash
    # This script will set up both backend and frontend

    PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
    cd "$PROJECT_ROOT"
    VENV_PATH="$PROJECT_ROOT/venv"

    echo "Setting up project in $PROJECT_ROOT..."

    # Create Python virtual environment
    echo "Creating Python virtual environment at $VENV_PATH..."
    python3 -m venv "$VENV_PATH"

    # Activate virtual environment
    echo "Activating virtual environment..."
    source "$VENV_PATH/bin/activate"

    # Upgrade pip
    echo "Upgrading pip..."
    pip install --upgrade pip

    # Install backend dependencies
    if [ -f "requirements.txt" ]; then
        echo "Installing backend dependencies from requirements.txt..."
        pip install -r requirements.txt
    else
        echo "WARNING: requirements.txt not found. Skipping backend dependency installation."
        echo "Consider running 'poetry export -f requirements.txt --output requirements.txt --without-hashes' first."
    fi

    # Deactivate for now, start_dev.sh will reactivate
    echo "Deactivating virtual environment for now..."
    deactivate

    # Install frontend dependencies
    if [ -d "frontend" ]; then
        echo "Navigating to frontend/ directory..."
        cd frontend
        echo "Installing frontend dependencies with npm install..."
        npm install
        echo "Running npm audit fix..."
        npm audit fix # Attempt to fix any remaining frontend vulnerabilities
        cd "$PROJECT_ROOT" # Navigate back to project root
    else
        echo "WARNING: frontend/ directory not found. Skipping frontend dependency installation."
    fi

    echo ""
    echo "✅ Project setup complete!"
    echo "To start the development servers, make sure start_dev.sh is executable (chmod +x start_dev.sh) and then run: ./start_dev.sh"
    echo "Ensure your start_dev.sh script activates the virtual environment ($VENV_PATH/bin/activate)."