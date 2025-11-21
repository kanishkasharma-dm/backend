# 🔧 Manual HTTP Destination Confirmation

## ⚠️ If AWS IoT Doesn't Auto-Confirm

Sometimes AWS IoT doesn't automatically retry confirmation even after the GET endpoint is fixed. Here's how to manually confirm:

---

## 🚀 Option 1: Delete and Recreate Destination (Recommended)

**This forces AWS IoT to send a fresh confirmation request:**

```bash
# 1. Get destination ARN
DEST_ARN=$(aws iot list-topic-rule-destinations \
  --query 'destinationSummaries[?httpUrlSummary.confirmationUrl==`https://backend-production-9c17.up.railway.app/api/iot/webhook`].arn' \
  --output text)

echo "Destination ARN: $DEST_ARN"

# 2. Delete the old destination
aws iot delete-topic-rule-destination --arn "$DEST_ARN"

# 3. Wait a moment
sleep 2

# 4. Update the rule (this creates a new destination)
./update-iot-rule-post.sh

# 5. AWS IoT will immediately send a new confirmation request
# Check Railway logs for the GET request
```

---

## 🚀 Option 2: Use AWS Console

1. **Go to:** AWS IoT Console → Message routing → Destinations
2. **Find destination** with URL: `https://backend-production-9c17.up.railway.app/api/iot/webhook`
3. **If there's a "Confirm" button**, click it
4. **Or delete the destination** and update the rule again

---

## 🚀 Option 3: Wait and Check

Sometimes AWS IoT takes a few minutes to retry:

```bash
# Check status every 30 seconds
watch -n 30 'aws iot list-topic-rule-destinations --query "destinationSummaries[?httpUrlSummary.confirmationUrl==\`https://backend-production-9c17.up.railway.app/api/iot/webhook\`].status" --output text'
```

**Or check manually:**
```bash
aws iot list-topic-rule-destinations
```

**Look for:**
- `"status": "ENABLED"` ✅
- `"status": "CONFIRMED"` ✅
- `"status": "IN_PROGRESS"` ❌ (still waiting)

---

## 🔍 Verify GET Endpoint is Working

**Before trying manual confirmation, verify GET endpoint:**

```bash
curl -X GET "https://backend-production-9c17.up.railway.app/api/iot/webhook?x-amzn-trace-id=test"
```

**Should return:**
```json
{
  "success": true,
  "message": "AWS IoT destination confirmed"
}
```

**If it returns 404:**
- GET handler not deployed yet
- Wait for Railway deployment
- Check Railway Dashboard → Deployments

---

## 📋 Complete Manual Confirmation Script

**Save as `confirm-destination.sh`:**

```bash
#!/bin/bash

echo "🔧 Manual HTTP Destination Confirmation"
echo ""

# Get destination ARN
DEST_ARN=$(aws iot list-topic-rule-destinations \
  --query 'destinationSummaries[?httpUrlSummary.confirmationUrl==`https://backend-production-9c17.up.railway.app/api/iot/webhook`].arn' \
  --output text)

if [ -z "$DEST_ARN" ]; then
    echo "❌ No destination found!"
    exit 1
fi

echo "📋 Found destination: $DEST_ARN"
echo ""

# Check current status
STATUS=$(aws iot list-topic-rule-destinations \
  --query "destinationSummaries[?arn=='$DEST_ARN'].status" \
  --output text)

echo "Current status: $STATUS"
echo ""

if [ "$STATUS" == "ENABLED" ] || [ "$STATUS" == "CONFIRMED" ]; then
    echo "✅ Destination is already enabled!"
    exit 0
fi

echo "🗑️  Deleting old destination..."
aws iot delete-topic-rule-destination --arn "$DEST_ARN"

if [ $? -eq 0 ]; then
    echo "✅ Destination deleted"
    echo ""
    echo "🔄 Updating rule to create new destination..."
    ./update-iot-rule-post.sh
    
    echo ""
    echo "⏳ Waiting 5 seconds for AWS IoT to send confirmation..."
    sleep 5
    
    echo ""
    echo "🔍 Checking new destination status..."
    aws iot list-topic-rule-destinations \
      --query 'destinationSummaries[?httpUrlSummary.confirmationUrl==`https://backend-production-9c17.up.railway.app/api/iot/webhook`]' \
      --output json | python3 -m json.tool
    
    echo ""
    echo "✅ Check Railway logs for confirmation request"
    echo "   Look for: '📧 AWS IoT destination confirmation request received'"
else
    echo "❌ Failed to delete destination"
    exit 1
fi
```

**Make executable and run:**
```bash
chmod +x confirm-destination.sh
./confirm-destination.sh
```

---

## ✅ After Confirmation

Once destination is **ENABLED**:

1. **Test with AWS IoT Console:**
   - Publish to: `esp32/data24`
   - Check Railway logs

2. **Verify data flow:**
   - Railway logs show incoming requests
   - MongoDB has new documents with `data_source: "cloud"`

---

**Most reliable method: Delete and recreate destination (Option 1)** 🎯

