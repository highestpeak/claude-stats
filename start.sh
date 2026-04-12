#!/bin/bash
# Claude Stats Dashboard launcher
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if port 3847 is already in use
if lsof -Pi :3847 -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "Claude Stats already running at http://localhost:3847"
  open "http://localhost:3847"
  exit 0
fi

echo "Starting Claude Stats Dashboard..."
cd "$SCRIPT_DIR"

# Start in background and open browser
npm run dev -- --port 3847 &
SERVER_PID=$!

# Wait for server to be ready
echo "Waiting for server..."
for i in {1..30}; do
  if curl -s "http://localhost:3847" >/dev/null 2>&1; then
    echo "Ready! Opening http://localhost:3847"
    open "http://localhost:3847"
    break
  fi
  sleep 0.5
done

echo "Claude Stats is running (PID: $SERVER_PID)"
echo "Press Ctrl+C to stop"
wait $SERVER_PID
