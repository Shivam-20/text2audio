#!/bin/bash
# start.sh - Starts the Whisper AI backend server in the background

cd "$(dirname "$0")"

if [ ! -d "venv" ]; then
    echo "Error: Virtual environment not found. Please run ./setup.sh first."
    exit 1
fi

if [ -f "server.pid" ]; then
    PID=$(cat server.pid)
    # Check if process is actually running
    if ps -p $PID > /dev/null 2>&1; then
        echo "Server is already running with PID $PID."
        echo "Access the app at http://localhost:5000"
        exit 0
    else
        # Stale pid file
        rm server.pid
    fi
fi

echo "Starting Whisper AI Server..."
# Run in background and pipe output to a log file
nohup ./venv/bin/python backend/app.py > server.log 2>&1 &
PID=$!

echo $PID > server.pid

echo "Server started with PID $PID."
echo "Access the web app at http://localhost:5000"
echo "To view logs, run: tail -f server.log"
echo "To stop the server, run: ./stop.sh"
