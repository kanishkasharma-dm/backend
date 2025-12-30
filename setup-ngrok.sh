#!/bin/bash

echo "🔗 Setting Up ngrok Tunnel"
echo "=========================="
echo ""

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok not found"
    echo ""
    echo "Install ngrok:"
    echo "  macOS: brew install ngrok"
    echo "  Or download: https://ngrok.com/download"
    exit 1
fi

echo "✅ ngrok found"
echo ""

# Check if port 3000 is in use
if ! lsof -i :3000 > /dev/null 2>&1; then
    echo "⚠️  Port 3000 is not in use"
    echo "Make sure your API server is running: npm run dev"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "Starting ngrok tunnel..."
echo ""
echo "Your ngrok URL will be displayed below"
echo "Update AWS IoT Core Rule with this URL:"
echo "  https://YOUR-NGROK-URL.ngrok.io/api/iot/webhook"
echo ""
echo "Press Ctrl+C to stop ngrok"
echo ""

ngrok http 3000

