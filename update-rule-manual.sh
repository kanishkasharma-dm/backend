#!/bin/bash

# Create update-rule.json file for macOS/Linux
cat > /tmp/update-rule.json << 'JSON'
{
  "sql": "SELECT device_status, device_data, device_type, device_id, topic() as topic, timestamp() as timestamp FROM 'esp32/+'",
  "description": "Forward ESP32 data to backend API",
  "actions": [
    {
      "http": {
        "url": "https://backend-production-9c17.up.railway.app/api/iot/webhook",
        "headers": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ]
      }
    }
  ],
  "ruleDisabled": false,
  "awsIotSqlVersion": "2016-03-23"
}
JSON

echo "✅ Created /tmp/update-rule.json"
echo ""
echo "📋 Updating AWS IoT Rule..."
echo ""

# Update the rule
aws iot replace-topic-rule \
  --rule-name ForwardESP32DataToBackend \
  --topic-rule-payload file:///tmp/update-rule.json

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Rule updated successfully!"
    echo ""
    echo "🔍 Verifying rule..."
    aws iot get-topic-rule --rule-name ForwardESP32DataToBackend
    echo ""
    echo "🧪 Next steps:"
    echo "   1. Publish test message to: esp32/data24"
    echo "   2. Check Railway logs (within 2-5 seconds)"
    echo "   3. Check MongoDB (within 5-10 seconds)"
else
    echo ""
    echo "❌ Failed to update rule"
    echo ""
    echo "Troubleshooting:"
    echo "   1. Check AWS credentials: aws configure"
    echo "   2. Verify rule exists: aws iot list-topic-rules | grep ForwardESP32DataToBackend"
    echo "   3. Check JSON file: cat /tmp/update-rule.json"
fi

# Cleanup
rm -f /tmp/update-rule.json
