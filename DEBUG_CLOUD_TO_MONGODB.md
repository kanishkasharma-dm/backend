# 🔍 Debug: Data in Cloud but Not Saving to MongoDB

## Problem
- ✅ Data is visible in AWS IoT Core Cloud
- ❌ Data is NOT saving to MongoDB when sent from hardware
- ✅ Manual API calls (curl/Postman) work fine

**This means the AWS IoT Core Rule is NOT forwarding data to your Railway API!**

---

## 🔍 Step 1: Check Railway Logs

1. **Go to Railway Dashboard**
   - https://railway.app
   - Open your backend service
   - Click **"Deployments"** tab
   - Click on the latest deployment
   - Click **"View Logs"**

2. **Look for webhook requests:**
   ```
   [req_xxx] 📥 Received IoT data request
   ```

3. **If you DON'T see these logs when hardware sends data:**
   - ❌ AWS IoT Rule is NOT calling your API
   - Problem is in AWS IoT Core Rule configuration

---

## 🔍 Step 2: Verify AWS IoT Core Rule

### Check Rule Status

1. **Go to AWS IoT Core Console**
   - https://console.aws.amazon.com/iot/
   - Navigate to: **Act** → **Rules**

2. **Find your rule** (should be something like `ForwardESP32DataToBackend`)

3. **Check:**
   - ✅ Rule is **Enabled** (Status should be "Enabled")
   - ✅ Rule SQL statement includes your topic
   - ✅ HTTPS action URL is correct

### Verify Rule SQL

Your rule SQL should be:

```sql
SELECT 
    *,
    topic() as topic,
    timestamp() as timestamp
FROM 
    'esp32/+'
```

**OR for specific topic:**

```sql
SELECT 
    *,
    topic() as topic,
    timestamp() as timestamp
FROM 
    'esp32/data24'
```

**Common mistakes:**
- ❌ SQL doesn't match your topic (`esp32/data24`)
- ❌ Missing `topic()` function
- ❌ Wrong topic pattern

---

## 🔍 Step 3: Check HTTPS Action URL

1. **In AWS IoT Rule → Actions → HTTPS endpoint**

2. **URL should be:**
   ```
   https://backend-production-9c17.up.railway.app/api/iot/webhook
   ```
   ⚠️ **Must include `/api/iot/webhook` at the end!**

3. **Common mistakes:**
   - ❌ URL is just: `https://backend-production-9c17.up.railway.app` (missing path)
   - ❌ URL uses HTTP instead of HTTPS
   - ❌ URL has trailing slash: `/api/iot/webhook/` (extra slash)

---

## 🔍 Step 4: Test AWS IoT Rule Manually

### Test 1: Publish Test Message via AWS IoT Console

1. **Go to AWS IoT Core → Test**

2. **Publish to topic:** `esp32/data24`

3. **Payload:**
   ```json
   {
     "device_status": 0,
     "device_data": "*,R,191125,1348,AUTOMODE,G,16.0,1.0,H,12.4,12.4,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,12345678C,#"
   }
   ```

4. **Check Railway Logs:**
   - You should see: `[req_xxx] 📥 Received IoT data request`
   - If not, the rule is not forwarding!

### Test 2: Check Rule Execution in CloudWatch

1. **Go to AWS CloudWatch**
   - https://console.aws.amazon.com/cloudwatch/

2. **Navigate to:** Logs → Log groups

3. **Look for:** `/aws/iot/` log groups

4. **Check for errors:**
   - Rule execution errors
   - HTTPS endpoint errors
   - Authentication errors

---

## 🔍 Step 5: Verify Rule IAM Permissions

The Rule needs permission to invoke HTTPS endpoint:

1. **Go to AWS IoT Core → Rules → Your Rule**

2. **Click on the Rule**

3. **Check "Resource role"**

4. **The role should have:**
   - `iotactions` service permissions
   - Permission to invoke HTTPS endpoint

5. **If missing, create/update role:**
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "iotactions:InvokeHTTPS"
         ],
         "Resource": "*"
       }
     ]
   }
   ```

---

## 🔍 Step 6: Common Issues & Fixes

### Issue 1: Rule is Disabled

**Fix:**
1. Go to AWS IoT Core → Rules
2. Find your rule
3. Click **"Enable"**

### Issue 2: Wrong Topic Pattern

**Your device publishes to:** `esp32/data24`

**Rule SQL should include:**
```sql
FROM 'esp32/+'  -- Matches esp32/* topics
-- OR
FROM 'esp32/data24'  -- Matches specific topic
```

**Fix:** Update rule SQL to match your topic.

### Issue 3: HTTPS URL Missing Path

**Wrong:**
```
https://backend-production-9c17.up.railway.app
```

**Correct:**
```
https://backend-production-9c17.up.railway.app/api/iot/webhook
```

**Fix:** Add `/api/iot/webhook` to the URL.

### Issue 4: Railway API Not Receiving Requests

**Check Railway Logs:**
```bash
# Look for these in Railway logs:
[req_xxx] 📥 Received IoT data request
[req_xxx] 📦 Raw payload received: ...
```

**If not present:**
- Rule is not calling the API
- Check rule configuration
- Check IAM permissions

### Issue 5: CORS or Authentication Issues

Railway API should accept POST requests without authentication for IoT webhook.

**Check:** Railway API logs for 403/401 errors.

---

## ✅ Verification Checklist

- [ ] AWS IoT Rule is **Enabled**
- [ ] Rule SQL matches your topic (`esp32/+` or `esp32/data24`)
- [ ] HTTPS URL includes full path: `/api/iot/webhook`
- [ ] HTTPS URL uses `https://` (not `http://`)
- [ ] Rule IAM role has `iotactions:InvokeHTTPS` permission
- [ ] Railway logs show webhook requests when testing
- [ ] MongoDB connection is working (test via manual API call)

---

## 🧪 Quick Test

### Test if Rule is Working:

1. **Publish test message via AWS IoT Console:**
   - Topic: `esp32/data24`
   - Payload:
   ```json
   {
     "device_status": 0,
     "device_data": "*,R,191125,1348,AUTOMODE,G,16.0,1.0,H,12.4,12.4,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,12345678C,#"
   }
   ```

2. **Check Railway logs immediately:**
   - Should see: `[req_xxx] 📥 Received IoT data request`

3. **If NOT seeing logs:**
   - Rule is not calling API
   - Fix rule configuration (see above)

4. **If seeing logs but data not saving:**
   - Check MongoDB connection in logs
   - Check for parsing errors
   - Check error messages in response

---

## 📝 Expected Logs (When Working)

**Railway Logs should show:**
```
[req_1234567890_abc123] 📥 Received IoT data request
[req_1234567890_abc123] 📦 Raw payload received: {"device_status":0,"device_data":"*,R,191125...
[req_1234567890_abc123] 💾 Attempting to save data for device: 24, type: CPAP
[req_1234567890_abc123] ✅ Data saved successfully to MongoDB (attempt 1)
[req_1234567890_abc123] 📊 Saved record ID: 67890abcdef, timestamp: 2025-11-19T...
[req_1234567890_abc123] ✅ Request completed successfully
```

**If you don't see `📥 Received IoT data request` when hardware sends data:**
- The rule is not forwarding!
- Fix AWS IoT Rule configuration!

---

## 🚀 Most Likely Issue

**99% chance the problem is:**
- AWS IoT Rule HTTPS URL is missing `/api/iot/webhook` path
- OR Rule is disabled
- OR Rule SQL doesn't match your topic

**Fix these first!** ✅

