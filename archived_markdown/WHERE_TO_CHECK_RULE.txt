# 🔍 Where to Check: AWS IoT Rule Configuration

## Current Status
✅ **Rule Found:** `ForwardESP32DataToBackend`  
✅ **Status:** Active  
✅ **Topic Pattern:** `esp32/+` (matches `esp32/data24`)

---

## 📍 Step 1: Check Rule Configuration (Action URL)

### In AWS IoT Core Console:

1. **Click on the rule name:** `ForwardESP32DataToBackend`
   - Or select it and click "Edit"

2. **Check the Action Configuration:**
   - Scroll down to the **"Actions"** section
   - Look for **HTTPS action**
   - **Verify Endpoint URL is:**
     ```
     https://backend-production-9c17.up.railway.app/api/iot/webhook
     ```
   - **Verify HTTP Method is:** `POST`
   - **Verify Headers include:**
     ```
     Content-Type: application/json
     ```

3. **Check Message Payload Template:**
   - Should include:
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

## 📊 Step 2: Check if Rule is Executing

### Option A: Check Rule Metrics (AWS IoT Console)

1. **Click on your rule:** `ForwardESP32DataToBackend`
2. **Click on the "Metrics" tab** (or "Monitoring" tab)
3. **Look for:**
   - **Rule executions** - Should show recent executions
   - **Action successes** - Should show successful HTTPS calls
   - **Action failures** - Check for errors

### Option B: Check CloudWatch Logs

1. **Go to CloudWatch Console:**
   - https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1
   
2. **Navigate to:** Logs → Log groups
   
3. **Look for log group:**
   - `/aws/iot/ForwardESP32DataToBackend`
   - Or `/aws/iot/rule/ForwardESP32DataToBackend`

4. **Check recent logs** for:
   - Rule execution messages
   - Action errors
   - HTTPS call results

---

## 🚂 Step 3: Check Railway Logs (API Endpoint)

### In Railway Dashboard:

1. **Go to Railway:** https://railway.app/dashboard

2. **Select your service:** `backend-production` (or similar)

3. **Click on "Deployments"** tab

4. **Click on latest deployment** → **"View Logs"**

5. **Look for these log entries:**
   ```
   [req_...] 📥 Received IoT data request
   [req_...] 📦 Raw payload received: ...
   [req_...] 💾 Attempting to save data for device: 24
   [req_...] ✅ Data saved successfully to MongoDB
   ```

6. **Filter logs by:**
   - Search for: `Received IoT data request`
   - Search for: `esp32/data24`
   - Search for: `device: 24`

**If you see these logs:** ✅ Rule is working, data is reaching the API  
**If you DON'T see these logs:** ❌ Rule is not forwarding (check Step 1)

---

## 🗄️ Step 4: Check MongoDB Database

### In MongoDB Atlas:

1. **Go to MongoDB Atlas:** https://cloud.mongodb.com/

2. **Select your cluster**

3. **Click "Browse Collections"**

4. **Select database:** `mehulapi` (or your database name)

5. **Select collection:** `DeviceData`

6. **Filter by:**
   ```json
   {
     "device_id": "24",
     "data_source": "cloud"
   }
   ```
   - Or just search for: `"device_id": "24"`

7. **Sort by:** `timestamp` (newest first)

8. **Check recent documents:**
   - Should see records with `data_source: "cloud"`
   - Should see `device_id: "24"` (or extracted from topic)
   - Timestamp should be recent

**If you see data:** ✅ Everything is working!  
**If you DON'T see data:** Continue to troubleshooting below

---

## 🧪 Step 5: Test Rule Manually

### Publish Test Message from MQTT Test Client:

1. **Go to AWS IoT Console:**
   - Navigate to: **Test** → **MQTT test client**

2. **Publish to topic:** `esp32/data24`

3. **Message payload:**
   ```json
   {
     "device_status": 0,
     "device_data": "*,R,141125,1703,MANUALMODE,G,13.6,1.0,H,12.4,12.4,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,12345678C,#",
     "device_type": "CPAP",
     "device_id": "24"
   }
   ```

4. **Click "Publish"**

5. **Immediately check:**
   - Railway logs (should see request within 2-5 seconds)
   - MongoDB (should see new document within 5-10 seconds)

---

## 🔧 Quick Checklist

### Rule Configuration:
- [ ] Rule is **Active** (green checkmark)
- [ ] Topic pattern matches: `esp32/+` or `esp32/data+`
- [ ] Action type is **HTTPS**
- [ ] Endpoint URL is correct: `https://backend-production-9c17.up.railway.app/api/iot/webhook`
- [ ] HTTP Method is **POST**
- [ ] Headers include `Content-Type: application/json`
- [ ] Message payload template includes all required fields

### Execution Verification:
- [ ] Rule metrics show recent executions
- [ ] Railway logs show incoming requests
- [ ] MongoDB shows new documents with `data_source: "cloud"`

---

## ❌ Troubleshooting: Still Not Working?

### If Rule Metrics Show 0 Executions:
- **Problem:** Rule is not matching messages
- **Fix:** Check SQL statement uses `FROM 'esp32/+'` or `FROM 'esp32/data+'`

### If Rule Executes but Railway Logs Show Nothing:
- **Problem:** Action URL is incorrect or unreachable
- **Fix:** Verify URL is exactly: `https://backend-production-9c17.up.railway.app/api/iot/webhook`

### If Railway Logs Show Requests but MongoDB is Empty:
- **Problem:** MongoDB connection issue
- **Fix:** Check Railway environment variables (MONGODB_URI)

### If You See 400 Errors in Railway Logs:
- **Problem:** Payload format mismatch
- **Fix:** Check message payload template matches API expectations

---

## 📞 Direct Links

- **AWS IoT Rules:** https://us-east-1.console.aws.amazon.com/iot/home?region=us-east-1#/rulehub
- **Edit Rule:** Click on `ForwardESP32DataToBackend` → Edit
- **Railway Dashboard:** https://railway.app/dashboard
- **MongoDB Atlas:** https://cloud.mongodb.com/

---

**Next Step:** Edit the `ForwardESP32DataToBackend` rule and verify the Action URL matches the webhook endpoint!

