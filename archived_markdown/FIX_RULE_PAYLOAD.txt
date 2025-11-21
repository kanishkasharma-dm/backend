# 🔧 Fix: Rule Payload Template Missing

## Problem
Data received in AWS IoT Cloud but not reaching API (not in MongoDB).

## Root Cause
The IoT Rule's **Message Payload Template** might be missing or incorrect, so the rule forwards data in wrong format.

---

## ✅ Solution: Update Rule Message Payload Template

### Step 1: Get Current Rule Configuration

```bash
aws iot get-topic-rule --rule-name ForwardESP32DataToBackend --output json > rule-config.json
```

### Step 2: Check Current Payload Template

The rule might not have a message payload template, or it might be in wrong format.

### Step 3: Update Rule with Correct Payload Template

**Create file:** `update-rule-with-payload.json`

```json
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
  ]
}
```

**Update rule:**
```bash
aws iot replace-topic-rule \
  --rule-name ForwardESP32DataToBackend \
  --topic-rule-payload file://update-rule-with-payload.json
```

**Note:** AWS IoT Core HTTP actions automatically forward the SQL SELECT result as JSON payload, so we might not need explicit template.

---

## 🔍 Alternative: Check What Rule is Actually Sending

### Option 1: Check Railway Logs

1. **Go to Railway Dashboard:**
   - https://railway.app/dashboard
   - Your Service → Deployments → View Logs

2. **Publish test message:**
   - Topic: `esp32/data24`
   - Payload: Your JSON

3. **Check logs immediately:**
   - Look for: `[req_...] 📥 Received IoT data request`
   - Look for: `[req_...] 📦 Raw payload received: ...`

4. **If you see logs:**
   - ✅ Rule is forwarding
   - Check what payload format is received
   - API might be rejecting due to format mismatch

5. **If you don't see logs:**
   - ❌ Rule is NOT forwarding
   - Check rule metrics in AWS IoT

### Option 2: Check Rule Metrics

1. **AWS IoT Console:**
   - Go to Rules → `ForwardESP32DataToBackend`
   - Click "Metrics" tab

2. **Check:**
   - **Rule executions** - Should show recent executions
   - **Action successes** - Should show successful HTTPS calls
   - **Action failures** - Should be 0 (or check errors)

3. **If executions > 0 but no Railway logs:**
   - Action might be failing silently
   - Check action error logs in CloudWatch

---

## 🔍 Issue: Payload Format Mismatch

### What API Expects:
```json
{
  "device_status": 0,
  "device_data": "...",
  "device_type": "CPAP",
  "device_id": "24",
  "topic": "esp32/data24"
}
```

### What Rule Might Be Sending:

**Without payload template, AWS IoT might send:**
```json
{
  "device_status": 0,
  "device_data": "...",
  "device_type": "...",
  "device_id": "...",
  "topic": "esp32/data24",
  "timestamp": 1234567890
}
```

**This should work!** The API accepts these fields.

**But if rule sends wrapped format:**
```json
{
  "payload": {
    "device_status": 0,
    ...
  }
}
```

The API will extract from `payload` (code handles this).

---

## ✅ Quick Fix: Re-run Update Script

The update script should have configured everything correctly. Re-run it:

```bash
./update-iot-rule-post.sh
```

This ensures:
- ✅ Endpoint URL is correct
- ✅ Headers are set
- ✅ Rule is enabled

---

## 🧪 Test After Fix

1. **Publish message from hardware** (or MQTT Test Client)
   - Topic: `esp32/data24`
   - Payload: Your JSON

2. **Check Railway logs immediately** (within 2-5 seconds)

3. **If logs appear:**
   - ✅ Rule is working!
   - Check MongoDB (within 5-10 seconds)
   - Should see new document

4. **If no logs:**
   - Check rule metrics
   - Verify rule is enabled
   - Check endpoint URL is correct

---

## 📋 Checklist

- [ ] Rule SQL includes all required fields ✅
- [ ] Rule action URL is correct ✅
- [ ] Rule is enabled (not disabled) ✅
- [ ] HTTP Method is POST (set via CLI) ✅
- [ ] Headers include Content-Type ✅
- [ ] Railway logs checked (requests incoming?)
- [ ] Rule metrics checked (executions showing?)
- [ ] Payload format matches API expectations

---

**Most Important:** Check Railway logs first - if you see incoming requests, the rule is working and issue is in API/MongoDB. If no logs, the rule is not forwarding.

