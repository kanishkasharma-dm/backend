#!/bin/bash

echo "🗑️  Delete Old Destination and Refresh"
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found!"
    echo "Install with: brew install awscli"
    exit 1
fi

echo "✅ AWS CLI found"
echo ""

# Get the destination ARN for the webhook URL
DEST_ARN=$(aws iot list-topic-rule-destinations --query "destinationSummaries[?contains(httpUrlSummary.confirmationUrl, \`backend-production-9c17.up.railway.app/api/iot/webhook\`)].arn" --output text | head -1)

if [ -z "$DEST_ARN" ]; then
    echo "⚠️  No destination found with webhook URL"
    echo ""
    echo "Listing all destinations:"
    aws iot list-topic-rule-destinations --output table
    exit 1
fi

echo "📍 Found destination:"
echo "   ARN: $DEST_ARN"
echo ""

# Check if any rule is using this destination
echo "🔍 Checking if any rule uses this destination..."
RULE_NAME=$(aws iot list-topic-rules --query "rules[?ruleName==\`ForwardESP32DataToBackend\`].ruleName" --output text)

if [ -n "$RULE_NAME" ]; then
    echo "   Rule found: $RULE_NAME"
    echo "   ⚠️  Note: Deleting destination will cause rule to create a new one"
    echo ""
fi

echo "🗑️  Deleting destination..."
echo "   This will trigger AWS IoT to create a new destination when the rule runs"
echo ""

read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

# Delete the destination
aws iot delete-topic-rule-destination --arn "$DEST_ARN"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Destination deleted successfully!"
    echo ""
    echo "🔄 Now updating the rule to trigger a new destination..."
    echo ""
    
    # Update the rule to trigger a new destination
    cat > /tmp/rule-update.json << 'JSON'
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

    aws iot replace-topic-rule \
      --rule-name ForwardESP32DataToBackend \
      --topic-rule-payload file:///tmp/rule-update.json

    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Rule updated! AWS IoT will create a new destination."
        echo ""
        echo "⏳ Waiting 10 seconds for AWS IoT to send confirmation request..."
        sleep 10
        echo ""
        echo "📋 Check Railway logs for confirmation request:"
        echo "   Railway Dashboard → Logs"
        echo "   Look for: '📧 AWS IoT destination confirmation request received'"
        echo ""
        echo "📋 Then check destination status:"
        echo "   aws iot list-topic-rule-destinations"
    else
        echo ""
        echo "❌ Failed to update rule"
    fi
    
    rm -f /tmp/rule-update.json
else
    echo ""
    echo "❌ Failed to delete destination"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check AWS credentials: aws configure"
    echo "  2. Verify IAM permissions for iot:DeleteTopicRuleDestination"
fi

