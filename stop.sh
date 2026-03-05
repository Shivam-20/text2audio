#!/bin/bash
# stop.sh - Stops the Whisper AI backend server

cd "$(dirname "$0")"

if [ ! -f "server.pid" ]; then
    echo "Server is not running (no server.pid file found)."
    
    # Fallback to finding and killing it manually as a precaution
    PIDS=$(pgrep -f "python backend/app.py")
    if [ ! -z "$PIDS" ]; then
        echo "Found orphaned server processes: $PIDS"
        kill $PIDS
        echo "Server stopped."
    fi
    exit 0
fi

PID=$(cat server.pid)

if ps -p $PID > /dev/null 2>&1; then
    echo "Stopping Whisper AI server (PID $PID)..."
    kill $PID
    rm server.pid
    echo "Server stopped successfully."
else
    echo "Server is not running (PID $PID not found). Cleaning up pid file."
    rm server.pid
fi
