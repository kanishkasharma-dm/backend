#!/bin/bash

echo "🔧 Fixing Port 3000 Issue"
echo "========================"
echo ""

# Find process using port 3000
PID=$(lsof -ti :3000 2>/dev/null)

if [ -z "$PID" ]; then
    echo "✅ Port 3000 is free"
else
    echo "⚠️  Process $PID is using port 3000"
    echo "Stopping process..."
    kill -9 $PID 2>/dev/null
    sleep 1
    echo "✅ Process stopped"
fi

# Stop all nodemon processes
echo "Cleaning up nodemon processes..."
pkill -f "nodemon server.js" 2>/dev/null
sleep 1

# Verify port is free
if lsof -ti :3000 > /dev/null 2>&1; then
    echo "⚠️  Port 3000 still in use"
    echo "Try manually: kill -9 \$(lsof -ti :3000)"
else
    echo "✅ Port 3000 is now free"
    echo ""
    echo "You can now start your server:"
    echo "  npm run dev"
fi


