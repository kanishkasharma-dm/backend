#!/bin/bash

echo "🧪 Testing CPAP/BIPAP API"
echo "=========================="
echo ""

API_URL="http://localhost:3000"

echo "1️⃣  Testing Health Endpoint..."
curl -s $API_URL/health | python3 -m json.tool
echo ""

echo "2️⃣  Sending Device Data (CPAP with MANUALMODE)..."
curl -s -X POST $API_URL/api/devices/data \
  -H "Content-Type: application/json" \
  -d '{
    "device_status": 0,
    "device_data": "*,R,141125,1703,MANUALMODE,G,13.6,1.0,H,12.4,12.4,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,12345678,#",
    "device_type": "CPAP",
    "device_id": "test_device_24"
  }' | python3 -m json.tool
echo ""

echo "3️⃣  Setting Device Configuration..."
curl -s -X POST $API_URL/api/devices/test_device_24/config \
  -H "Content-Type: application/json" \
  -d '{
    "device_type": "CPAP",
    "config_values": {
      "pressure": 15.0,
      "humidity": 6.0,
      "temperature": 2.0,
      "mode": "MANUALMODE"
    }
  }' | python3 -m json.tool
echo ""

echo "4️⃣  Getting Device Data History..."
curl -s "$API_URL/api/devices/test_device_24/data?limit=3" | python3 -m json.tool
echo ""

echo "5️⃣  Getting Device Configuration..."
curl -s $API_URL/api/devices/test_device_24/config | python3 -m json.tool
echo ""

echo "✅ Tests Complete!"
echo ""
echo "📊 Data is saved in MongoDB:"
echo "   - Database: mehulapi"
echo "   - Collection: devicedatas (for device data)"
echo "   - Collection: deviceconfigs (for configurations)"
