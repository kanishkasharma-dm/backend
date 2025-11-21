# 🔍 Troubleshooting: Data on Cloud but Not in MongoDB

## 🎯 Problem
Data is being received on AWS IoT Core (cloud), but it's **NOT being saved to MongoDB**.

---

## 🔍 Step-by-Step Troubleshooting

### Step 1: Check Railway Logs

1. Go to **Railway Dashboard** → Your Project → **Deployments** → **Latest Deployment** → **Logs**
2. Look for incoming requests with pattern: `[req_...] 📥 Received IoT data request`
3. Check for error messages

**What to look for:**
```
✅ GOOD: [req_123] 📥 Received IoT data request
✅ GOOD: [req_123] 📦 Raw payload received: {...}
✅ GOOD: [req_123] ✅ Data saved successfully to MongoDB

❌ BAD: [req_123] ❌ MongoDB not connected!
❌ BAD: [req_123] ❌ Save attempt 1 failed: ...
❌ BAD: [req_123] ❌ All 3 save attempts failed
```

---

### Step 2: Check AWS IoT Core Rule Configuration

#### A. Verify Rule is Enabled

1. Go to **AWS IoT Console** → **Message routing** → **Rules**
2. Find your rule: `ForwardESP32DataToBackend` (or similar)
3. Check that **Status** is **Enabled** (not Disabled)

#### B. Verify Rule SQL Query

**Expected SQL:**
```sql
SELECT 
    device_status, 
    device_data, 
    device_type, 
    device_id, 
    topic() as topic, 
    timestamp() as timestamp 
FROM 
    'esp32/+'
```

**Check:**
- Does the SQL match messages on topic `esp32/data24`?
- Are all fields selected correctly?

#### C. Verify HTTPS Action Configuration

**URL:** Must be your Railway API webhook endpoint
```
https://backend-production-9c17.up.railway.app/api/iot/webhook
```

**HTTP Method:** Must be **POST** (not GET)

**Headers:** Should include:
```
Content-Type: application/json
```

#### D. Check Rule Action Status

1. Click on your rule → **Actions** tab
2. Look for **Status** column
3. Check if there are any errors shown

**Common issues:**
- ❌ **403 Forbidden** → API endpoint not accepting requests
- ❌ **404 Not Found** → Wrong URL (missing `/api/iot/webhook`)
- ❌ **500 Internal Server Error** → API code error
- ❌ **Timeout** → API not responding

---

### Step 3: Test the Webhook Endpoint Directly

Test if the API webhook is receiving data correctly:

```bash
curl -X POST https://backend-production-9c17.up.railway.app/api/iot/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "device_status": 1,
    "device_data": "*,R,141125,1703,MANUALMODE,G,13.6,1.0,H,12.4,12.4,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,12345678C,#",
    "device_type": "CPAP",
    "device_id": "24",
    "topic": "esp32/data24"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Data received and saved",
  "requestId": "req_...",
  "data": {
    "device_id": "24",
    "device_type": "CPAP",
    "timestamp": "2024-..."
  }
}
```

**If this works:**
- ✅ API endpoint is working
- ✅ MongoDB connection is working
- ❌ Issue is with AWS IoT Rule forwarding

**If this fails:**
- ❌ API endpoint has issues
- ❌ MongoDB connection has issues
- Check Railway logs for errors

---

### Step 4: Check MongoDB Connection

#### A. Check Railway Environment Variables

1. Go to **Railway Dashboard** → **Variables** tab
2. Verify `MONGODB_URI` is set correctly:
   ```
   mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
   ```

#### B. Check MongoDB Atlas Network Access

1. Go to **MongoDB Atlas** → **Network Access**
2. Ensure **Railway IPs** are whitelisted:
   - Option 1: **Allow Access from Anywhere** (`0.0.0.0/0`)
   - Option 2: Add Railway's IP ranges

#### C. Check MongoDB Atlas Database User

1. Go to **MongoDB Atlas** → **Database Access**
2. Verify user has **Read/Write** permissions
3. Verify password is correct in `MONGODB_URI`

---

### Step 5: Check AWS IoT Rule Payload Format

AWS IoT Core might be sending data in a different format. Check what format AWS is sending:

**Option A: Check AWS IoT Core Logs**
1. Go to **CloudWatch** → **Logs** → **Log groups**
2. Look for `/aws/iot/` log groups
3. Check rule execution logs

**Option B: Check Railway Logs for Raw Payload**

Look for this line in Railway logs:
```
[req_123] 📦 Raw payload received: {...}
```

**Expected format:**
```json
{
  "device_status": 0,
  "device_data": "*,R,...",
  "device_type": "CPAP",
  "device_id": "24",
  "topic": "esp32/data24"
}
```

**If payload format is different:**
- AWS IoT Rule SQL might need adjustment
- API code might need to handle different format

---

### Step 6: Verify Device is Publishing Correct JSON

The ESP32 code should publish this format:

```json
{
  "device_status": 0,
  "device_data": "*,R,141125,1703,MANUALMODE,G,13.6,1.0,H,12.4,12.4,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,12345678C,#",
  "device_type": "CPAP",
  "device_id": "24"
}
```

**Check ESP32 Serial Monitor:**
```
Publishing JSON: {"device_status":0,"device_data":"...","device_type":"CPAP","device_id":"24"}
✅ Published CPAP data to AWS IoT
```

---

### Step 7: Check AWS IoT Core Test Client

1. Go to **AWS IoT Console** → **Test** → **MQTT test client**
2. Subscribe to topic: `esp32/data24`
3. Verify messages are being published

**If messages appear here:**
- ✅ ESP32 → AWS IoT is working
- ❌ AWS IoT → API is not working

**If messages don't appear:**
- ❌ ESP32 → AWS IoT has issues
- Check ESP32 code and certificates

---

## 🛠️ Common Fixes

### Fix 1: AWS IoT Rule HTTP Method Not POST

**Problem:** Rule is using GET instead of POST

**Solution:** Use AWS CLI to update rule:

```bash
# Run this script (from project root)
./update-iot-rule-post.sh
```

Or manually update via CLI:
```bash
aws iot replace-topic-rule \
  --rule-name ForwardESP32DataToBackend \
  --topic-rule-payload file://rule-update.json
```

**Verify:**
```bash
aws iot get-topic-rule --rule-name ForwardESP32DataToBackend
```

---

### Fix 2: API Endpoint URL Missing Path

**Problem:** Rule URL is `https://backend-production-9c17.up.railway.app/` instead of `https://backend-production-9c17.up.railway.app/api/iot/webhook`

**Solution:**
1. Go to **AWS IoT Console** → **Rules** → Your Rule → **Actions**
2. Click **Edit** on HTTPS action
3. Update URL to include `/api/iot/webhook`
4. Save changes

---

### Fix 3: MongoDB Connection Issues

**Problem:** MongoDB connection is failing

**Solution:**

1. **Check Railway Variables:**
   - Verify `MONGODB_URI` is set
   - Check for typos in connection string

2. **Check MongoDB Atlas:**
   - Network Access: Allow `0.0.0.0/0` (or Railway IPs)
   - Database Access: User has read/write permissions

3. **Test MongoDB Connection:**
   ```bash
   # From Railway logs, look for:
   ✅ MongoDB Connected: cluster0.xxxxx.mongodb.net
   ```

---

### Fix 4: Payload Format Mismatch

**Problem:** AWS IoT is sending data in different format than expected

**Solution:**

Check Railway logs for raw payload format. If format is different, the API code will need updates.

**Current API expects:**
```json
{
  "device_status": 0,
  "device_data": "*,R,...",
  "device_type": "CPAP",
  "device_id": "24"
}
```

**If AWS sends nested format:**
```json
{
  "payload": {
    "device_status": 0,
    "device_data": "..."
  }
}
```

The API code should handle this (it does try to extract nested payload).

---

## ✅ Verification Checklist

Use this checklist to verify everything is working:

- [ ] **AWS IoT Core**: Messages are being published to topic `esp32/data24`
- [ ] **AWS IoT Rule**: Rule is **Enabled** and **Active**
- [ ] **AWS IoT Rule SQL**: Selects correct fields from `esp32/+`
- [ ] **AWS IoT Rule Action**: HTTP Method is **POST** (not GET)
- [ ] **AWS IoT Rule Action**: URL includes `/api/iot/webhook`
- [ ] **Railway API**: Receiving requests (check logs)
- [ ] **Railway API**: MongoDB connection successful (check logs)
- [ ] **MongoDB Atlas**: Network Access allows Railway IPs
- [ ] **MongoDB Atlas**: Database user has read/write permissions
- [ ] **ESP32 Code**: Publishing correct JSON format with all fields
- [ ] **MongoDB**: Data appears in database (check MongoDB Atlas)

---

## 🔧 Quick Test Commands

### Test 1: Test API Webhook Directly
```bash
curl -X POST https://backend-production-9c17.up.railway.app/api/iot/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "device_status": 1,
    "device_data": "*,R,141125,1703,MANUALMODE,G,13.6,1.0,H,12.4,12.4,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,12345678C,#",
    "device_type": "CPAP",
    "device_id": "24",
    "topic": "esp32/data24"
  }'
```

### Test 2: Check MongoDB Data
```bash
curl "https://backend-production-9c17.up.railway.app/api/devices/24/data?limit=5&data_source=cloud"
```

### Test 3: Verify AWS IoT Rule
```bash
aws iot get-topic-rule --rule-name ForwardESP32DataToBackend
```

---

## 📊 Expected Logs (Success Case)

### Railway Logs:
```
[req_1234567890_abc] 📥 Received IoT data request
[req_1234567890_abc] 📦 Raw payload received: {"device_status":0,"device_data":"*,R,...","device_type":"CPAP","device_id":"24","topic":"esp32/data24"}
[req_1234567890_abc] 💾 Attempting to save data for device: 24, type: CPAP
[req_1234567890_abc] ✅ Data saved successfully to MongoDB (attempt 1)
[req_1234567890_abc] 📊 Saved record ID: 67890abcdef, timestamp: 2024-01-15T10:30:45.123Z
```

### AWS IoT Core Test Client:
```
Topic: esp32/data24
Message: {"device_status":0,"device_data":"*,R,...","device_type":"CPAP","device_id":"24"}
```

### MongoDB Atlas:
```
Collection: devicedatas
Document: {
  "_id": ObjectId("..."),
  "device_id": "24",
  "device_type": "CPAP",
  "device_status": 0,
  "data_source": "cloud",
  "raw_data": "*,R,...",
  "timestamp": ISODate("2024-01-15T10:30:45.123Z")
}
```

---

## 🚨 If Still Not Working

1. **Share Railway logs** (last 50-100 lines)
2. **Share AWS IoT Rule configuration** (SQL + Action details)
3. **Share MongoDB Atlas connection string** (with passwords redacted)
4. **Share test curl response** (if testing webhook directly)

---

**The most common issue is AWS IoT Rule HTTP Method not being POST. Fix that first!**

