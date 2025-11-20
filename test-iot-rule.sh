#!/bin/bash
# Test if AWS IoT Rule is forwarding data to Railway API

echo "🧪 Testing AWS IoT Rule → Railway API Connection"
echo ""

RAILWAY_URL="https://backend-production-9c17.up.railway.app/api/iot/webhook"

echo "1️⃣ Testing Railway API directly (manual call)..."
echo ""

RESPONSE=$(curl -s -X POST "$RAILWAY_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "device_status": 0,
    "device_data": "*,R,191125,1348,AUTOMODE,G,16.0,1.0,H,12.4,12.4,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,12345678C,#",
    "topic": "esp32/data24"
  }')

echo "Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

if echo "$RESPONSE" | grep -q '"success":true'; then
  echo "✅ Railway API is working!"
else
  echo "❌ Railway API test failed!"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "2️⃣ Check Railway Logs:"
echo ""
echo "   Go to: https://railway.app"
echo "   → Open your backend service"
echo "   → Click 'Deployments' → Latest → 'View Logs'"
echo ""
echo "   You should see:"
echo "   [req_xxx] 📥 Received IoT data request"
echo "   [req_xxx] ✅ Data saved successfully to MongoDB"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "3️⃣ Test AWS IoT Rule:"
echo ""
echo "   A. Go to: https://console.aws.amazon.com/iot/"
echo "   B. Navigate to: Act → Rules"
echo "   C. Find your rule (should match 'esp32/+' topic)"
echo "   D. Check:"
echo "      ✅ Rule is ENABLED"
echo "      ✅ HTTPS URL is: $RAILWAY_URL"
echo "      ✅ SQL includes: FROM 'esp32/+' or FROM 'esp32/data24'"
echo ""
echo "   E. Test by publishing message:"
echo "      → Go to: Test → Publish to topic"
echo "      → Topic: esp32/data24"
echo "      → Payload:"
echo "        {"
echo "          \"device_status\": 0,"
echo "          \"device_data\": \"*,R,191125,1348,AUTOMODE,G,16.0,1.0,H,12.4,12.4,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,12345678C,#\""
echo "        }"
echo ""
echo "   F. Check Railway logs immediately"
echo "      → Should see webhook request appear"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 If Railway API works but IoT Rule doesn't forward:"
echo ""
echo "   ❌ Most common issue: HTTPS URL is wrong"
echo "      → Should be: $RAILWAY_URL"
echo "      → NOT: https://backend-production-9c17.up.railway.app"
echo ""
echo "   ❌ Rule might be disabled"
echo "      → Enable it in AWS IoT Core → Rules"
echo ""
echo "   ❌ Rule SQL might not match topic"
echo "      → Should include: FROM 'esp32/+' or FROM 'esp32/data24'"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

