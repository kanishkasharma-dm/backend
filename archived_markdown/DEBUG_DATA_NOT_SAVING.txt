# 🔧 Debug: Data Received in Cloud But Not Saving to MongoDB

## Problem
- ✅ Data received in AWS IoT Cloud (visible in MQTT test client)
- ❌ Data NOT saving to MongoDB database

## Root Causes & Solutions

---

## 🔍 Step 1: Check Railway Logs

### Why This Matters
If the rule is working, you should see requests in Railway logs.

### How to Check:

1. **Go to Railway Dashboard:**
   - https://railway.app/dashboard
   - Select your service: `backend-production`

2. **View Logs:**
   - Click "Deployments" tab
   - Click latest deployment → "View Logs"

3. **Look for:**
   ```
   [req_...] 📥 Received IoT data request
   [req_...] 📦 Raw payload received: ...
   [req_...] 💾 Attempting to save data for device: ...
   ```

### Results:

**✅ If you see these logs:**
- Rule is working (forwarding to API)
- Issue is in API/MongoDB layer
- Continue to Step 2

**❌ If you DON'T see these logs:**
- Rule is NOT forwarding data
- Check Step 3 (Rule Configuration)

---

## 🔍 Step 2: Verify Payload Format

### Your Current Payload:
```json
{
  "device_status": 0,
  "device_data": "*,R,141125,17444403,MANUALMODE,G,13.6,1.0,H,12.4,12.4,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0, 12345678C,#"
}
```

### Issues to Check:

#### Issue 1: Missing Fields
Your payload might be missing:
- `device_type` (CPAP or BIPAP) - API can auto-detect
- `device_id` - API can extract from topic
- `topic` - Should come from IoT Rule

**Fix:** Ensure IoT Rule SQL includes these:
```sql
SELECT 
  device_status,
  device_data,
  device_type,
  device_id,
  topic() as topic
FROM 'esp32/+'
```

#### Issue 2: Extra Space in device_data
Notice: `, 12345678C,#` (space before "12345678C")

This might cause parsing issues. Check if device is sending correct format.

#### Issue 3: Payload Format in Rule

**Check IoT Rule Message Payload Template:**
```json
{
  "device_status": ${device_status},
  "device_data": "${device_data}",
  "device_type": "${device_type}",
  "device_id": "${device_id}",
  "topic": "${topic()}"
}
```

---

## 🔍 Step 3: Verify Rule Configuration

### Check Rule is Executing:

1. **Go to AWS IoT Console:**
   - https://us-east-1.console.aws.amazon.com/iot/home?region=us-east-1#/rulehub

2. **Click on rule:** `ForwardESP32DataToBackend`

3. **Click "Metrics" tab:**
   - Check "Rule executions" - Should show recent executions
   - Check "Action successes" - Should show successful HTTPS calls
   - Check "Action failures" - Should be 0 or check errors

### Check Rule SQL:

**Should be:**
```sql
SELECT 
  device_status,
  device_data,
  device_type,
  device_id,
  topic() as topic
FROM 'esp32/+'
```

**Verify:**
- Topic pattern matches your topic: `esp32/data24` matches `esp32/+`
- All fields are selected

### Check Rule Action:

- **Endpoint URL:** `https://backend-production-9c17.up.railway.app/api/iot/webhook`
- **HTTP Method:** POST (configured via CLI)
- **Headers:** `Content-Type: application/json`

---

## 🔍 Step 4: Test Webhook Directly

### Manual Test:

```bash
curl -X POST https://backend-production-9c17.up.railway.app/api/iot/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "device_status": 0,
    "device_data": "*,R,141125,17444403,MANUALMODE,G,13.6,1.0,H,12.4,12.4,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,12345678C,#",
    "device_type": "CPAP",
    "device_id": "24",
    "topic": "esp32/data24"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "IoT data received and processed successfully",
  "data": {
    "device_id": "24",
    "device_type": "CPAP",
    "timestamp": "...",
    "record_id": "..."
  }
}
```

**Results:**
- ✅ If this works: Webhook is functional, issue is with rule forwarding
- ❌ If this fails: Check Railway logs for error details

---

## 🔍 Step 5: Check MongoDB Connection

### Verify MongoDB is Connected:

1. **Check Railway Environment Variables:**
   - Go to Railway → Your Service → Variables
   - Verify `MONGODB_URI` is set correctly

2. **Check MongoDB Atlas Network Access:**
   - Go to MongoDB Atlas → Network Access
   - Should allow `0.0.0.0/0` (all IPs) for Railway

3. **Check MongoDB Database:**
   - Go to MongoDB Atlas → Browse Collections
   - Check if `DeviceData` collection exists
   - Check for any recent documents

### Railway Logs - MongoDB Errors:

Look for:
```
❌ MongoDB not connected!
❌ Failed to reconnect to MongoDB
❌ Save attempt failed
```

If you see these:
- MongoDB connection issue
- Check `MONGODB_URI` in Railway variables
- Verify MongoDB Atlas network access

---

## 🔍 Step 6: Common Issues & Fixes

### Issue 1: Rule Not Forwarding

**Symptom:** No requests in Railway logs

**Possible Causes:**
- Rule is disabled
- SQL doesn't match topic
- HTTP Method is GET (not POST)
- Endpoint URL incorrect

**Fix:**
1. Verify rule is enabled (green checkmark)
2. Check SQL matches your topic
3. Re-run: `./update-iot-rule-post.sh` to ensure POST method
4. Verify endpoint URL in rule

### Issue 2: Payload Missing Fields

**Symptom:** Requests in logs but 400 errors

**Fix:**
- Ensure rule SQL selects all required fields
- Verify message payload template includes all fields

### Issue 3: MongoDB Save Failures

**Symptom:** Requests in logs but data not in MongoDB

**Fix:**
- Check Railway logs for MongoDB errors
- Verify MongoDB connection string
- Check MongoDB Atlas network access

### Issue 4: Device ID Extraction

**Symptom:** Data might be saving but with wrong device_id

**Check:**
- Topic should be `esp32/data24` to extract device ID `24`
- Rule should include `topic() as topic` in SQL

---

## ✅ Quick Verification Checklist

- [ ] Railway logs show incoming requests (`[req_...] 📥`)
- [ ] Rule metrics show executions and successes
- [ ] Rule SQL selects all required fields
- [ ] Rule action URL is correct
- [ ] HTTP Method is POST (set via CLI)
- [ ] Webhook test works (curl command succeeds)
- [ ] MongoDB URI is set in Railway
- [ ] MongoDB Atlas allows all IPs (0.0.0.0/0)
- [ ] Device topic matches rule SQL pattern (`esp32/+`)
- [ ] Payload includes all required fields

---

## 🧪 Complete Test Flow

### 1. Publish Test Message:
- **Topic:** `esp32/data24`
- **Payload:**
  ```json
  {
    "device_status": 0,
    "device_data": "*,R,141125,17444403,MANUALMODE,G,13.6,1.0,H,12.4,12.4,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,12345678C,#",
    "device_type": "CPAP",
    "device_id": "24"
  }
  ```

### 2. Immediately Check Railway Logs (within 2-5 seconds)
- Should see request logs

### 3. Check MongoDB (within 5-10 seconds)
- Should see new document

### 4. If Nothing Happens:
- Check rule metrics in AWS IoT
- Verify rule is enabled
- Check rule action configuration

---

## 📞 Still Not Working?

1. **Share Railway logs** - What do you see when publishing?
2. **Share rule metrics** - Are executions showing?
3. **Test webhook directly** - Does curl command work?
4. **Check MongoDB Atlas** - Any connection errors?

---

**Most Likely Issue:** Rule is not forwarding (check Railway logs first - if no logs appear, rule isn't working)

