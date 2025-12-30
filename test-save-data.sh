#!/bin/bash

API_URL="http://localhost:3000"

echo "🧪 Testing Data Save to MongoDB"
echo "================================"
echo ""

# Check if API is running
if ! curl -s $API_URL/health > /dev/null 2>&1; then
    echo "❌ API is not running at $API_URL"
    echo "Start it with: npm run dev"
    exit 1
fi

echo "✅ API is running"
echo ""

echo "1️⃣  Sending device data to save in MongoDB..."
RESPONSE=$(curl -s -X POST $API_URL/api/devices/data \
  -H "Content-Type: application/json" \
  -d '{
    "device_status": 0,
    "device_data": "*,R,141125,1703,MANUALMODE,G,13.6,1.0,H,12.4,12.4,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,12345678,#",
    "device_type": "CPAP",
    "device_id": "test_device_001"
  }')

echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

# Check if save was successful
if echo "$RESPONSE" | grep -q "success.*true"; then
    echo "✅ Data saved successfully!"
    echo ""
    echo "2️⃣  Verifying data was saved..."
    sleep 1
    curl -s "$API_URL/api/devices/test_device_001/data?limit=1" | python3 -m json.tool 2>/dev/null || echo "Could not retrieve data"
    echo ""
    echo "3️⃣  Check MongoDB Atlas:"
    echo "   - Go to: Browse Collections"
    echo "   - Select: mehulapi > devicedatas"
    echo "   - Refresh the page"
    echo "   - You should see your data!"
else
    echo "❌ Failed to save data"
    echo "Check your server logs for errors"
fi


