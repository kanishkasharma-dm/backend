#!/bin/bash

echo "🔍 Testing IoT Rule Data Flow"
echo ""
echo "This script helps diagnose why data isn't saving to MongoDB"
echo ""

# Test 1: Check webhook directly
echo "1️⃣ Testing webhook endpoint directly..."
echo ""

RESPONSE=$(curl -s -X POST https://backend-production-9c17.up.railway.app/api/iot/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "device_status": 0,
    "device_data": "*,R,141125,17444403,MANUALMODE,G,13.6,1.0,H,12.4,12.4,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,12345678C,#",
    "device_type": "CPAP",
    "device_id": "24",
    "topic": "esp32/data24"
  }')

if echo "$RESPONSE" | grep -q '"success":true'; then
  echo "✅ Webhook endpoint is working!"
  echo "   Response: $RESPONSE" | head -1
  echo ""
else
  echo "❌ Webhook endpoint returned error:"
  echo "   $RESPONSE"
  echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "2️⃣ Check AWS IoT Rule Configuration:"
echo ""
echo "Run this command to verify rule exists and is configured:"
echo "   aws iot get-topic-rule --rule-name ForwardESP32DataToBackend"
echo ""

if command -v aws &> /dev/null; then
  echo "Checking rule now..."
  echo ""
  aws iot get-topic-rule --rule-name ForwardESP32DataToBackend --output json 2>&1 | grep -E '(ruleName|sql|url|ruleDisabled)' | head -10
  echo ""
else
  echo "⚠️  AWS CLI not found. Install with: brew install awscli"
  echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "3️⃣ Next Steps:"
echo ""
echo "If webhook works but data from hardware doesn't save:"
echo ""
echo "   → AWS IoT Rule is NOT forwarding correctly"
echo "   → Check Railway logs for incoming requests"
echo "   → Verify rule SQL includes all fields"
echo "   → Verify rule action URL is correct"
echo "   → Check rule metrics in AWS IoT Console"
echo ""
echo "To check Railway logs:"
echo "   1. Go to: https://railway.app/dashboard"
echo "   2. Your Service → Deployments → View Logs"
echo "   3. Look for: [req_...] 📥 Received IoT data request"
echo ""
echo "If you see logs: Rule is working ✅"
echo "If no logs: Rule is not forwarding ❌"
echo ""

