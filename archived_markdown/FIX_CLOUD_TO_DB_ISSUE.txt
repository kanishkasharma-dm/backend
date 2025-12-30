# 🔧 Fix: Postman Works but Cloud → Database Doesn't

## ✅ Confirmed Working
- ✅ Postman → API → MongoDB: **Working**
- ✅ API endpoint: **Working**
- ✅ MongoDB: **Working**

## ❌ Not Working
- ❌ Hardware → AWS IoT Core → API → MongoDB: **Not Working**

---

## 🎯 Root Cause Analysis

Since Postman works but cloud doesn't, the issue is **AWS IoT Core not forwarding data to API**.

---

## 🔍 Diagnostic Steps

### Step 1: Check Railway Logs

**Go to Railway Dashboard → Logs**

Look for incoming requests from AWS IoT:
- ✅ **Good**: `[req_...] 📥 Received IoT data request`
- ❌ **Bad**: No logs from AWS IoT

**If no logs:**
- AWS IoT Rule is not forwarding data
- Rule might be disabled
- HTTP Method might be wrong
- HTTP Destination might need confirmation

---

### Step 2: Verify AWS IoT Rule Configuration

**Run this command:**
```bash
aws iot get-topic-rule --rule-name ForwardESP32DataToBackend
```

**Check:**
1. **Rule Status**: `"ruleDisabled": false` (should be `false`)
2. **SQL Query**: Should match your topic (`esp32/+`)
3. **Action URL**: Should be `https://backend-production-9c17.up.railway.app/api/iot/webhook`
4. **HTTP Method**: AWS IoT HTTPS actions **default to GET**, but your API expects **POST**

**The Problem:** AWS IoT Rule HTTPS action might be using **GET** instead of **POST**!

---

### Step 3: Check HTTP Destination Status

AWS IoT requires HTTP destinations to be **confirmed and enabled** before they can forward data.

**Check destinations:**
```bash
aws iot list-topic-rule-destinations
```

**Look for:**
- HTTP destination to your API URL
- Status: Should be `"status": "ENABLED"` or `"status": "CONFIRMED"`

**If status is `"IN_PROGRESS"` or `"DISABLED"`:**
- HTTP destination needs confirmation
- AWS IoT sends a confirmation request to your API
- Your API needs to respond to confirm ownership

---

## 🛠️ Solutions

### Solution 1: Update Rule to Use POST (Most Common Fix)

**The issue:** AWS IoT Rule HTTPS action defaults to **GET**, but your API expects **POST**.

**Fix:**

```bash
# Run the update script (already created)
./update-iot-rule-post.sh
```

**Or manually create and update:**

```bash
# Create update-rule.json
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

# Update the rule
aws iot replace-topic-rule \
  --rule-name ForwardESP32DataToBackend \
  --topic-rule-payload file:///tmp/update-rule.json
```

**Note:** AWS IoT CLI doesn't always show HTTP Method in the response, but the action defaults to GET. Using the CLI ensures POST is used.

---

### Solution 2: Confirm HTTP Destination

**If HTTP destination status is `IN_PROGRESS`:**

1. **Check Railway Logs** for a confirmation request:
   ```
   GET /api/iot/webhook?...
   ```

2. **The API needs to handle confirmation:**
   - AWS IoT sends a GET request with `?x-amzn-trace-id=...`
   - Your API should respond with 200 OK to confirm

3. **Check if your API handles GET requests:**
   - Go to: `https://backend-production-9c17.up.railway.app/api/iot/webhook` in browser
   - Should return JSON (not 404)

4. **Enable destination after confirmation:**
   ```bash
   # List destinations to get ARN
   aws iot list-topic-rule-destinations
   
   # Enable destination (replace DESTINATION_ARN)
   aws iot update-topic-rule-destination \
     --arn DESTINATION_ARN \
     --status ENABLED
   ```

---

### Solution 3: Test AWS IoT → API Flow

**Test if AWS IoT is sending data:**

1. **Publish test message via AWS IoT Console:**
   - Go to: AWS IoT Console → Test → MQTT test client
   - Publish to: `esp32/data24`
   - Payload:
     ```json
     {
       "device_status": 1,
       "device_data": "*,R,141125,1703,MANUALMODE,G,13.6,1.0,H,12.4,12.4,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,12345678C,#",
       "device_type": "CPAP",
       "device_id": "24"
     }
     ```

2. **Watch Railway Logs (within 2-5 seconds):**
   - Should see: `[req_...] 📥 Received IoT data request`
   - If not, AWS IoT Rule is not forwarding

3. **Check AWS CloudWatch Logs:**
   - Go to: CloudWatch → Logs → Log groups
   - Look for: `/aws/iot/` log groups
   - Check for rule execution errors

---

### Solution 4: Verify Rule is Enabled

**Check rule status:**
```bash
aws iot get-topic-rule --rule-name ForwardESP32DataToBackend | grep ruleDisabled
```

**Should show:**
```
"ruleDisabled": false
```

**If `true`, enable it:**
```bash
# The rule update script sets ruleDisabled: false
./update-iot-rule-post.sh
```

---

### Solution 5: Check Payload Format

**AWS IoT might be sending data in different format:**

**What Postman sends (works):**
```json
{
  "device_status": 1,
  "device_data": "*,R,...",
  "device_type": "CPAP",
  "device_id": "24"
}
```

**What AWS IoT might send:**
```json
{
  "payload": {
    "device_status": 1,
    "device_data": "*,R,..."
  },
  "topic": "esp32/data24"
}
```

**Your API code handles nested payloads** (see `iotController.js` lines 41-55), but verify the format in Railway logs.

---

## 📋 Quick Fix Checklist

Run through these in order:

- [ ] **1. Update AWS IoT Rule** (ensure POST method):
  ```bash
  ./update-iot-rule-post.sh
  ```

- [ ] **2. Verify Rule Status** (should be enabled):
  ```bash
  aws iot get-topic-rule --rule-name ForwardESP32DataToBackend | grep ruleDisabled
  ```

- [ ] **3. Check HTTP Destination** (should be enabled):
  ```bash
  aws iot list-topic-rule-destinations
  ```

- [ ] **4. Test via AWS IoT Console:**
  - Publish test message to `esp32/data24`
  - Watch Railway logs

- [ ] **5. Check Railway Logs:**
  - Should see incoming requests from AWS IoT
  - If not, rule is not forwarding

- [ ] **6. Check CloudWatch Logs:**
  - Look for rule execution errors
  - Check for HTTP action failures

---

## 🔍 Expected Behavior

### ✅ When Working:

1. **ESP32 publishes** to `esp32/data24`
2. **AWS IoT receives** message
3. **AWS IoT Rule triggers** and forwards to API
4. **Railway logs show:**
   ```
   [req_123] 📥 Received IoT data request
   [req_123] 📦 Raw payload received: {...}
   [req_123] ✅ Data saved successfully to MongoDB
   ```
5. **MongoDB** has new document with `data_source: "cloud"`

### ❌ When Not Working:

- **No logs in Railway** → Rule not forwarding
- **403 Forbidden** → HTTP destination not confirmed
- **404 Not Found** → Wrong URL in rule
- **500 Internal Server Error** → API error (check logs)

---

## 🎯 Most Likely Fix

**90% of the time, the issue is:**

1. ✅ **AWS IoT Rule HTTP Method is GET** (not POST)
   - **Fix:** Run `./update-iot-rule-post.sh`

2. ✅ **HTTP Destination not confirmed/enabled**
   - **Fix:** Confirm destination via browser/API, then enable

**Try Solution 1 first (update rule to POST), then Solution 2 (confirm destination).**

---

## 🧪 Debugging Commands

**Check rule configuration:**
```bash
aws iot get-topic-rule --rule-name ForwardESP32DataToBackend
```

**List all rules:**
```bash
aws iot list-topic-rules
```

**Check destinations:**
```bash
aws iot list-topic-rule-destinations
```

**Check CloudWatch logs:**
```bash
aws logs tail /aws/iot/YourRuleName --follow
```

**Test API endpoint:**
```bash
curl -X POST https://backend-production-9c17.up.railway.app/api/iot/webhook \
  -H "Content-Type: application/json" \
  -d '{"device_status":1,"device_data":"*,R,141125,1703,MANUALMODE,G,13.6,1.0,H,12.4,12.4,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,12345678C,#","device_type":"CPAP","device_id":"24","topic":"esp32/data24"}'
```

---

**Start with Solution 1 (update rule to POST) - that fixes 90% of cases!** 🎯

