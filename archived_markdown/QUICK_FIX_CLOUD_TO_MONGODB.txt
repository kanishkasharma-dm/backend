# 🚀 Quick Fix: Data on Cloud but Not in MongoDB

## ⚡ Most Common Issue: AWS IoT Rule HTTP Method Not POST

### ✅ Fix Option 1: Use AWS CLI (Recommended)

**On Windows (PowerShell or Command Prompt):**

```powershell
# 1. Create update-rule.json file with this content:
@"
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
"@ | Out-File -FilePath update-rule.json -Encoding utf8

# 2. Update the rule (make sure AWS CLI is configured)
aws iot replace-topic-rule --rule-name ForwardESP32DataToBackend --topic-rule-payload file://update-rule.json

# 3. Verify the rule was updated
aws iot get-topic-rule --rule-name ForwardESP32DataToBackend
```

### ✅ Fix Option 2: Manual Check in AWS Console

1. **Go to AWS IoT Console**: https://console.aws.amazon.com/iot/
2. **Navigate to**: Message routing → Rules → `ForwardESP32DataToBackend`
3. **Click**: "Edit"
4. **Check Action**: 
   - URL should be: `https://backend-production-9c17.up.railway.app/api/iot/webhook`
   - **HTTP Method** should be **POST** (not GET)
   - If you don't see HTTP Method dropdown, the rule is using GET (the problem!)
5. **If HTTP Method is missing/GET**: You need to use AWS CLI (Option 1) to fix it

---

## 🔍 Other Common Issues

### Issue 2: Check Railway Logs

1. **Go to**: Railway Dashboard → Your Project → Deployments → Latest → Logs
2. **Look for**:
   ```
   ✅ GOOD: [req_123] 📥 Received IoT data request
   ✅ GOOD: [req_123] ✅ Data saved successfully to MongoDB
   
   ❌ BAD: [req_123] ❌ MongoDB not connected!
   ❌ BAD: [req_123] ❌ Save attempt failed
   ```

### Issue 3: Test API Webhook Directly

**Test if API is working:**

```powershell
# In PowerShell:
$body = @{
    device_status = 1
    device_data = "*,R,141125,1703,MANUALMODE,G,13.6,1.0,H,12.4,12.4,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,12345678C,#"
    device_type = "CPAP"
    device_id = "24"
    topic = "esp32/data24"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://backend-production-9c17.up.railway.app/api/iot/webhook" -Method Post -Body $body -ContentType "application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Data received and saved",
  "requestId": "req_...",
  "data": {...}
}
```

**If this works:**
- ✅ API and MongoDB are working
- ❌ Problem is AWS IoT Rule forwarding

### Issue 4: Verify MongoDB Connection

**Check Railway Variables:**
1. Railway Dashboard → Variables tab
2. Verify `MONGODB_URI` is set correctly
3. Format: `mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority`

**Check MongoDB Atlas Network Access:**
1. MongoDB Atlas → Network Access
2. Ensure **Allow Access from Anywhere** (`0.0.0.0/0`) is enabled
   - Or add Railway's IP ranges

---

## ✅ Verification Steps

After fixing, verify everything is working:

1. **Publish test message from ESP32** (or AWS IoT Test Client)
2. **Check AWS IoT Console** → Test → MQTT test client → Subscribe to `esp32/data24`
   - Should see messages published
3. **Check Railway Logs** (within 2-5 seconds)
   - Should see: `[req_...] 📥 Received IoT data request`
   - Should see: `[req_...] ✅ Data saved successfully to MongoDB`
4. **Check MongoDB Atlas** (within 5-10 seconds)
   - Go to Collections → `devicedatas`
   - Should see new documents with `data_source: "cloud"`

---

## 🎯 Most Likely Fix

**90% of the time, the issue is:**
- ❌ AWS IoT Rule HTTP Method is **GET** (default)
- ✅ Should be **POST**

**Solution:** Use AWS CLI to update rule (see Fix Option 1 above)

---

## 📝 Still Not Working?

Share these details:
1. **Railway logs** (last 20-30 lines showing webhook requests)
2. **AWS IoT Rule configuration** (SQL + Action URL)
3. **Test curl response** (from Issue 3 above)

See `TROUBLESHOOT_CLOUD_TO_MONGODB.md` for complete troubleshooting guide.

