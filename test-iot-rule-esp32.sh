#!/bin/bash

echo "🧪 Testing IoT Rule Configuration for esp32/data24"
echo ""
echo "This script tests if your AWS IoT Rule is properly forwarding data to the API."
echo ""

API_URL="https://backend-production-9c17.up.railway.app/api/iot/webhook"

echo "1️⃣ Testing webhook endpoint directly..."
echo ""

RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "device_status": 0,
    "device_data": "*,R,141125,1703,MANUALMODE,G,13.6,1.0,H,12.4,12.4,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,12345678C,#",
    "device_type": "CPAP",
    "device_id": "24",
    "topic": "esp32/data24"
  }')

if echo "$RESPONSE" | grep -q '"success":true'; then
  echo "✅ Webhook endpoint is working!"
  echo "   Response: $RESPONSE"
else
  echo "❌ Webhook endpoint returned an error:"
  echo "   $RESPONSE"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "2️⃣ Next Steps:"
echo ""
echo "If webhook works above, but data from hardware is not saving:"
echo ""
echo "   → AWS IoT Rule is NOT configured correctly"
echo "   → Go to: https://us-east-1.console.aws.amazon.com/iot/home?region=us-east-1#/rulehub"
echo "   → Check/create rule with SQL: FROM 'esp32/data+'"
echo "   → Set Action URL: $API_URL"
echo "   → Enable the rule (toggle ON)"
echo ""
echo "See QUICK_FIX_IOT_RULE.md for detailed steps."
echo ""

