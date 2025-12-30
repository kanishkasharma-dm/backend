#!/bin/bash

echo "✅ Confirm AWS IoT Destination"
echo ""

# Check if confirmation token is provided
if [ -z "$1" ]; then
    echo "❌ Confirmation token required!"
    echo ""
    echo "Usage:"
    echo "  ./confirm-destination.sh <CONFIRMATION_TOKEN>"
    echo ""
    echo "To get the token:"
    echo "  1. Go to Railway Dashboard → Logs"
    echo "  2. Find: POST /api/iot/webhook?confirmationToken=..."
    echo "  3. Copy the full token (very long, starts with 'AYADe...')"
    echo ""
    exit 1
fi

CONFIRMATION_TOKEN="$1"

echo "📋 Confirming destination with token..."
echo "   Token: ${CONFIRMATION_TOKEN:0:50}..."
echo ""

# Confirm the destination
aws iot confirm-topic-rule-destination --confirmation-token "$CONFIRMATION_TOKEN"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Destination confirmed successfully!"
    echo ""
    echo "📋 Checking destination status..."
    sleep 2
    aws iot list-topic-rule-destinations --query 'destinationSummaries[?contains(httpUrlSummary.confirmationUrl, `backend-production-9c17.up.railway.app/api/iot/webhook`)].{Status:status,Reason:statusReason,URL:httpUrlSummary.confirmationUrl}' --output table
    echo ""
    echo "🎉 If status is ENABLED, you're all set!"
    echo ""
    echo "Next: Test with ESP32 or MQTT Test Client"
    echo "  Topic: esp32/data24"
    echo "  Data will flow: ESP32 → AWS IoT → Railway → MongoDB ✅"
else
    echo ""
    echo "❌ Failed to confirm destination"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Make sure the token is complete (very long string)"
    echo "  2. Check AWS credentials: aws configure"
    echo "  3. Verify token from Railway logs is recent (< 24 hours)"
fi

