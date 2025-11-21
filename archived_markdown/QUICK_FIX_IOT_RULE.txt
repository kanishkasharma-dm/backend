# ⚡ Quick Fix: AWS IoT Rule for esp32/data24

## Problem
Messages on `esp32/data24` are visible in MQTT test client but not reaching MongoDB.

## Solution: Configure AWS IoT Core Rule

### Step 1: Go to IoT Rules
1. Open AWS IoT Core Console
2. Navigate to: **Act** → **Rules**
   - Direct link: https://us-east-1.console.aws.amazon.com/iot/home?region=us-east-1#/rulehub

### Step 2: Create or Edit Rule

**If Rule Exists:**
- Click on your rule (e.g., `ForwardDeviceDataToAPI`)
- Edit it

**If No Rule:**
- Click **"Create rule"**

### Step 3: Rule Configuration

#### **Rule Name:** 
```
ForwardESP32DataToAPI
```

#### **SQL Statement:**
```sql
SELECT 
  device_status,
  device_data,
  device_type,
  device_id,
  topic() as topic
FROM 'esp32/data+'
```
⚠️ **Important:** Use `esp32/data+` (with `+`) to match `esp32/data24`, `esp32/data25`, etc.

#### **Action: HTTPS**

**Endpoint URL:**
```
https://backend-production-9c17.up.railway.app/api/iot/webhook
```

**HTTP Method:** `POST`

**Headers:**
```
Content-Type: application/json
```

**Message Payload Template:**
```json
{
  "device_status": ${device_status},
  "device_data": "${device_data}",
  "device_type": "${device_type}",
  "device_id": "${device_id}",
  "topic": "${topic()}"
}
```

### Step 4: Enable Rule
- Toggle switch must be **ON** (green)
- Click **"Save"** or **"Create"**

### Step 5: Test

1. **Publish test message in MQTT Test Client:**
   - Topic: `esp32/data24`
   - Payload:
     ```json
     {
       "device_status": 0,
       "device_data": "*,R,141125,1703,MANUALMODE,G,13.6,1.0,H,12.4,12.4,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,12345678C,#",
       "device_type": "CPAP",
       "device_id": "24"
     }
     ```

2. **Check Railway Logs:**
   - Go to Railway Dashboard → Your Service → Deployments → View Logs
   - Look for: `[req_...] 📥 Received IoT data request`

3. **Check MongoDB:**
   - MongoDB Atlas → Browse Collections → DeviceData
   - Filter: `{ device_id: "24", data_source: "cloud" }`
   - Should see new document within seconds

---

## ✅ Verification Checklist

- [ ] Rule exists and is enabled (toggle ON)
- [ ] SQL query: `FROM 'esp32/data+'`
- [ ] Action URL: `https://backend-production-9c17.up.railway.app/api/iot/webhook`
- [ ] HTTP Method: POST
- [ ] Header: `Content-Type: application/json`
- [ ] Message payload includes all fields
- [ ] Published test message appears in Railway logs
- [ ] Data appears in MongoDB with `data_source: "cloud"`

---

## 🔍 Troubleshooting

### Rule not forwarding?
1. Check rule is enabled (toggle green)
2. Check SQL matches topic: `esp32/data+`
3. Check webhook URL is correct
4. Check Railway service is running

### Still not working?
See detailed guide: `FIX_MQTT_TO_MONGODB.md`

