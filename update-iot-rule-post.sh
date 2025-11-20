#!/bin/bash

echo "🔧 Update IoT Rule to Use POST Method"
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found!"
    echo "Install with: brew install awscli"
    exit 1
fi

echo "✅ AWS CLI found"
echo ""

# Create update payload (without ruleName - that's passed as parameter, and without empty confirmationUrl)
cat > update-rule.json << 'JSON'
{
  "sql": "SELECT device_status, device_data, device_type, device_id, topic() as topic, timestamp() as timestamp FROM 'esp32/+'",
  "description": "Forward ESP32 data to backend API",
  "actions": [
    {
      "http": {
        "url": "https://backend-production-9c17.up.railway.app/api/iot/webhook",
        "confirmationUrl": "",
        "headers": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "auth": {
          "sigv4": {
            "serviceName": "iotdevicegateway",
            "roleArn": ""
          }
        }
      }
    }
  ],
  "ruleDisabled": false,
  "awsIotSqlVersion": "2016-03-23"
}
JSON

echo "📋 Updating rule..."
echo ""

# Update the rule
aws iot replace-topic-rule \
  --rule-name ForwardESP32DataToBackend \
  --topic-rule-payload file://update-rule.json

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Rule updated successfully!"
    echo ""
    echo "🧪 Next: Test with MQTT Test Client"
    echo "   1. Publish to: esp32/data24"
    echo "   2. Check Railway logs (within 2-5 seconds)"
    echo "   3. Check MongoDB (within 5-10 seconds)"
    echo ""
    echo "To verify the rule:"
    echo "   aws iot get-topic-rule --rule-name ForwardESP32DataToBackend"
else
    echo ""
    echo "❌ Failed to update rule"
    echo ""
    echo "Troubleshooting:"
    echo "   1. Check AWS credentials: aws configure"
    echo "   2. Verify rule exists: aws iot list-topic-rules"
    echo "   3. Check JSON file: cat update-rule.json"
fi

# Cleanup
rm -f update-rule.json
