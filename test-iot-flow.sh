#!/bin/bash

API_URL="http://localhost:3000"

echo "🧪 Testing Complete IoT Flow"
echo "============================"
echo ""

# Check if API is running
if ! curl -s $API_URL/health > /dev/null; then
    echo "❌ API is not running at $API_URL"
    echo "Start it with: npm run dev"
    exit 1
fi

echo "✅ API is running"
echo ""

echo "1️⃣  Setting Device Configuration..."
CONFIG_RESPONSE=$(curl -s -X POST $API_URL/api/devices/24/config \
  -H "Content-Type: application/json" \
  -d '{
    "device_type": "CPAP",
    "config_values": {
      "pressure": 18.0,
      "humidity": 8.0,
      "temperature": 3.0,
      "mode": "MANUALMODE"
    }
  }')

echo "$CONFIG_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$CONFIG_RESPONSE"
echo ""

echo "2️⃣  Simulating Device Sending Data (via IoT Core webhook)..."
IOT_RESPONSE=$(curl -s -X POST $API_URL/api/iot/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "device_status": 0,
    "device_data": "*,R,141125,1703,MANUALMODE,G,13.6,1.0,H,12.4,12.4,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,12345678,#",
    "topic": "esp32/data24",
    "timestamp": "2025-11-15T12:00:00Z",
    "messageId": "test-msg-001"
  }')

echo "$IOT_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$IOT_RESPONSE"
echo ""

echo "3️⃣  Verifying Data Saved in MongoDB..."
curl -s "$API_URL/api/devices/24/data?limit=1" | python3 -m json.tool 2>/dev/null || echo "Could not parse response"
echo ""

echo "4️⃣  Checking Configuration..."
curl -s $API_URL/api/devices/24/config | python3 -m json.tool 2>/dev/null || echo "Could not parse response"
echo ""

echo "✅ Test Complete!"
echo ""
echo "📊 Next Steps:"
echo "1. Check your API logs for: 'Config published to IoT Core topic'"
echo "2. Go to AWS IoT Test Client → Subscribe to: esp32/config24"
echo "3. You should see config message published!"
echo ""
echo "💡 Tip: Run this script again to test the flow multiple times"

