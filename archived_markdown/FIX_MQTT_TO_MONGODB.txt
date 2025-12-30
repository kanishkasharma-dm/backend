# 🔧 Fix: MQTT Data Not Saving to MongoDB

## Problem
Data is received in AWS IoT Core (visible in MQTT test client on `esp32/data24` topic) but not appearing in MongoDB database.

## Root Cause
The AWS IoT Core Rule is either:
- Not configured
- Not enabled
- SQL query doesn't match the topic pattern
- Webhook URL is incorrect
- Rule Action is not properly set up

---

## ✅ Step-by-Step Fix

### Step 1: Verify IoT Rule Exists

1. **Go to AWS IoT Core Console**
   - Navigate to: `Act` → `Rules`
   - Or direct link: https://us-east-1.console.aws.amazon.com/iot/home?region=us-east-1#/rulehub

2. **Check if Rule Exists**
   - Look for a rule that matches `esp32/data+` or `esp32/data24`
   - Rule name might be: `ForwardDeviceDataToAPI` or similar

3. **If Rule Doesn't Exist → Create New Rule** (Skip to Step 2)
4. **If Rule Exists → Edit the Rule** (Skip to Step 3)

---

### Step 2: Create New IoT Rule

1. **Click "Create rule"**

2. **Rule Name:** `ForwardESP32DataToAPI`

3. **Rule Description:** `Forward esp32/data24 messages to API webhook`

4. **SQL Statement:**
   ```sql
   SELECT 
     device_status,
     device_data,
     device_type,
     device_id,
     topic() as topic
   FROM 'esp32/data+'
   ```
   - This matches ALL topics starting with `esp32/data` (including `esp32/data24`)

5. **Click "Next"**

6. **Configure Action:**
   - **Action Type:** `HTTPS`
   - **Endpoint URL:** `https://backend-production-9c17.up.railway.app/api/iot/webhook`
   - **HTTP Method:** `POST`
   - **Headers:**
     ```
     Content-Type: application/json
     ```

7. **Message Payload Template:**
   ```json
   {
     "device_status": ${device_status},
     "device_data": "${device_data}",
     "device_type": "${device_type}",
     "device_id": "${device_id}",
     "topic": "${topic()}"
   }
   ```

8. **Click "Next"** → **Review** → **Create**

9. **Enable the Rule** (toggle switch should be ON)

---

### Step 3: Edit Existing IoT Rule

1. **Click on your existing rule** (e.g., `ForwardDeviceDataToAPI`)

2. **Check SQL Statement:**
   - Must match: `FROM 'esp32/data+'` or `FROM 'esp32/data24'`
   - Must include: `device_status`, `device_data`, `topic() as topic`

3. **Fix SQL if needed:**
   ```sql
   SELECT 
     device_status,
     device_data,
     device_type,
     device_id,
     topic() as topic
   FROM 'esp32/data+'
   ```

4. **Check Action Configuration:**
   - **Endpoint URL:** Must be `https://backend-production-9c17.up.railway.app/api/iot/webhook`
   - **HTTP Method:** Must be `POST`
   - **Headers:** Must include `Content-Type: application/json`

5. **Check Message Payload:**
   ```json
   {
     "device_status": ${device_status},
     "device_data": "${device_data}",
     "device_type": "${device_type}",
     "device_id": "${device_id}",
     "topic": "${topic()}"
   }
   ```

6. **Ensure Rule is Enabled** (toggle should be green/ON)

7. **Click "Save"** or "Update"

---

### Step 4: Test the Rule

1. **Go to MQTT Test Client**
   - Navigate to: `Test` → `MQTT test client`

2. **Publish a Test Message:**
   - **Topic:** `esp32/data24`
   - **Payload:**
     ```json
     {
       "device_status": 0,
       "device_data": "*,R,141125,1703,MANUALMODE,G,13.6,1.0,H,12.4,12.4,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,12345678C,#",
       "device_type": "CPAP",
       "device_id": "24"
     }
     ```

3. **Check Railway Logs:**
   - Go to Railway Dashboard → Your Service → Deployments → View Logs
   - Look for: `[req_...] 📥 Received IoT data request`
   - Should see: `[req_...] 💾 Attempting to save data for device: 24`

4. **Check MongoDB:**
   - Go to MongoDB Atlas → Browse Collections
   - Look for `DeviceData` collection
   - Should see new document with `data_source: "cloud"`

---

### Step 5: Verify Webhook Endpoint is Accessible

1. **Test Webhook Endpoint:**
   ```bash
   curl -X POST https://backend-production-9c17.up.railway.app/api/iot/webhook \
     -H "Content-Type: application/json" \
     -d '{
       "device_status": 0,
       "device_data": "*,R,141125,1703,MANUALMODE,G,13.6,1.0,H,12.4,12.4,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,12345678C,#",
       "device_type": "CPAP",
       "device_id": "24",
       "topic": "esp32/data24"
     }'
   ```

2. **Expected Response:**
   ```json
   {
     "success": true,
     "message": "IoT data received and saved successfully",
     "data": {
       "device_id": "24",
       "device_type": "CPAP",
       "timestamp": "..."
     }
   }
   ```

3. **If you get an error:**
   - Check Railway environment variables (MONGODB_URI, AWS credentials)
   - Check Railway service is running
   - Check MongoDB Atlas network access (should allow 0.0.0.0/0)

---

### Step 6: Common Issues & Fixes

#### Issue 1: Rule SQL doesn't match topic
**Symptom:** Rule exists but no requests in Railway logs

**Fix:** Update SQL to match your topic format
```sql
-- For esp32/data24
FROM 'esp32/data+'

-- OR for exact match
FROM 'esp32/data24'
```

#### Issue 2: Rule is disabled
**Symptom:** Rule exists but not forwarding

**Fix:** Enable the rule (toggle switch should be green)

#### Issue 3: Webhook URL incorrect
**Symptom:** 404 errors in Railway logs

**Fix:** Verify URL is exactly:
```
https://backend-production-9c17.up.railway.app/api/iot/webhook
```

#### Issue 4: Payload format mismatch
**Symptom:** 400 errors in Railway logs

**Fix:** Ensure IoT Rule message payload matches:
```json
{
  "device_status": ${device_status},
  "device_data": "${device_data}",
  "device_type": "${device_type}",
  "device_id": "${device_id}",
  "topic": "${topic()}"
}
```

#### Issue 5: MongoDB connection failed
**Symptom:** 503 errors in Railway logs

**Fix:** 
- Check `MONGODB_URI` in Railway variables
- Check MongoDB Atlas network access (allow 0.0.0.0/0)
- Verify MongoDB user has read/write permissions

---

## ✅ Verification Checklist

- [ ] IoT Rule exists and is enabled
- [ ] SQL query matches topic `esp32/data+` or `esp32/data24`
- [ ] Action is configured as HTTPS POST
- [ ] Webhook URL is correct: `https://backend-production-9c17.up.railway.app/api/iot/webhook`
- [ ] Message payload template includes all required fields
- [ ] Railway service is running
- [ ] MongoDB URI is set in Railway variables
- [ ] MongoDB Atlas allows connections from anywhere (0.0.0.0/0)
- [ ] Test message published to `esp32/data24` shows up in Railway logs
- [ ] Data appears in MongoDB `DeviceData` collection with `data_source: "cloud"`

---

## 🔍 Debugging Commands

### Check Railway Logs
```bash
# In Railway Dashboard → Service → Deployments → View Logs
# Look for:
# - [req_...] 📥 Received IoT data request
# - [req_...] 💾 Attempting to save data
# - [req_...] ✅ Data saved successfully
```

### Test Webhook Manually
```bash
curl -X POST https://backend-production-9c17.up.railway.app/api/iot/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "device_status": 0,
    "device_data": "*,R,141125,1703,MANUALMODE,G,13.6,1.0,H,12.4,12.4,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,12345678C,#",
    "device_type": "CPAP",
    "device_id": "24",
    "topic": "esp32/data24"
  }'
```

### Check MongoDB Data
```bash
# Via MongoDB Atlas UI:
# 1. Browse Collections
# 2. Select DeviceData collection
# 3. Filter: { device_id: "24", data_source: "cloud" }
# 4. Should see recent documents
```

---

## 📞 Still Not Working?

1. **Check Railway Logs** - Look for error messages
2. **Check AWS IoT Core Rule Status** - Should show recent invocations
3. **Test Webhook Directly** - Use curl command above
4. **Verify MongoDB Connection** - Check Railway environment variables
5. **Check AWS IoT Core Logs** - Look for rule execution errors

---

**Last Updated:** November 2025

