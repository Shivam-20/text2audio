#!/bin/bash
# setup.sh - Sets up the Python virtual environment and installs dependencies

echo "=== Whisper AI Setup ==="

cd "$(dirname "$0")"

# Check if python3 is available
if ! command -v python3 &> /dev/null; then
    echo "Error: python3 is not installed or not in PATH."
    exit 1
fi

echo "1. Checking/Creating Python virtual environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "  -> Created new virtual environment 'venv'."
else
    echo "  -> Virtual environment 'venv' already exists."
fi

echo "2. Upgrading pip..."
./venv/bin/pip install --upgrade pip

echo "3. Installing dependencies from backend/requirements.txt..."
# Install requirements
./venv/bin/pip install -r backend/requirements.txt

echo "=== Setup Complete! ==="
echo "You can now run ./start.sh to launch the application."
