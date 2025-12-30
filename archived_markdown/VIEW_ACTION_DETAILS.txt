# 🔍 View Action Details to Check HTTP Method

## Current Status
✅ **Rule:** ForwardESP32DataToBackend  
✅ **Status:** Active (green checkmark)  
✅ **Topic:** `esp32/+`  
✅ **SQL:** Correct  
✅ **Action:** HTTPS endpoint (1 action configured)  
❓ **HTTP Method:** Need to verify (POST or GET?)

---

## 📍 Next Step: Click "View details"

### What You See Now:
```
Actions (1)
┌─────────────────────────────────────┐
│ Service: HTTPS endpoint             │
│ Action: Send a message to...        │
│ [View details] ⬅️ CLICK THIS!       │
└─────────────────────────────────────┘
```

### What "View details" Will Show:
```
HTTPS Endpoint Action Details:
├─ Endpoint URL: https://backend-production...
├─ HTTP Method: POST or GET? ⬅️ CHECK THIS
├─ Headers: Content-Type: application/json
├─ Message Payload Template: {...}
└─ Authentication: None
```

---

## ✅ Step-by-Step Verification

### Step 1: Click "View details" Button
- Click the **"View details"** button next to the HTTPS endpoint action
- This will expand or show a modal with complete action configuration

### Step 2: Check HTTP Method
- **Look for:** "HTTP Method" or "Method" field
- **Should be:** `POST` (not GET)
- **If it's GET:** You need to edit it

### Step 3: Verify Other Settings
- **Endpoint URL:** `https://backend-production-9c17.up.railway.app/api/iot/webhook`
- **Headers:** `Content-Type: application/json`
- **Message Payload:** Should include all required fields

---

## 🔧 If HTTP Method is GET (Wrong)

### Fix Steps:

1. **Click "Edit" button** (on the rule page, top right)
   - Or use breadcrumb: Rules → ForwardESP32DataToBackend → Edit

2. **Scroll to Actions section**

3. **Click "Edit" on the HTTPS action** (or expand it)

4. **Find HTTP Method dropdown**

5. **Change from GET to POST**

6. **Verify other settings:**
   - Endpoint URL is correct
   - Headers include `Content-Type: application/json`
   - Message Payload template is correct

7. **Save the action**

8. **Update the rule** (click "Update" at bottom)

---

## ✅ If HTTP Method is POST (Correct)

**Great! Your rule is properly configured!**

### Next: Test the Rule

1. **Go to MQTT Test Client:**
   - AWS IoT → Test → MQTT test client

2. **Subscribe to:** `esp32/data24` (optional, to see messages)

3. **Publish to:** `esp32/data24`
   - **Payload:**
     ```json
     {
       "device_status": 0,
       "device_data": "*,R,141125,1703,MANUALMODE,G,13.6,1.0,H,12.4,12.4,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,12345678C,#",
       "device_type": "CPAP",
       "device_id": "24"
     }
     ```

4. **Check Railway Logs:**
   - Within 2-5 seconds, you should see:
     ```
     [req_...] 📥 Received IoT data request
     [req_...] 💾 Attempting to save data for device: 24
     [req_...] ✅ Data saved successfully to MongoDB
     ```

5. **Check MongoDB Atlas:**
   - Browse Collections → DeviceData
   - Filter: `{ device_id: "24", data_source: "cloud" }`
   - Should see new document within 5-10 seconds

---

## 📋 Complete Configuration Checklist

After clicking "View details", verify:

- [ ] **Endpoint URL:** `https://backend-production-9c17.up.railway.app/api/iot/webhook`
- [ ] **HTTP Method:** `POST` ⬅️ **MOST CRITICAL**
- [ ] **Headers:** `Content-Type: application/json`
- [ ] **Message Payload Template:** Includes:
  - `device_status: ${device_status}`
  - `device_data: "${device_data}"`
  - `device_type: "${device_type}"`
  - `device_id: "${device_id}"`
  - `topic: "${topic()}"`
- [ ] **Rule Status:** Active (green checkmark) ✅

---

## 🔍 What Each Field Should Be

### HTTP Method:
```
✅ POST  (Correct - will send data to your API)
❌ GET   (Wrong - will not work with your API)
```

### Endpoint URL:
```
✅ https://backend-production-9c17.up.railway.app/api/iot/webhook
❌ https://backend-production-9c17.up.railway.app/ (missing /api/iot/webhook)
❌ http://... (should be https://)
```

### Headers:
```
✅ Content-Type: application/json
❌ Missing or wrong header
```

---

## ⚠️ Common Issues After Viewing Details

### Issue 1: HTTP Method is Missing
- **Problem:** Field not visible or not set
- **Fix:** Click "Edit" on the rule → Edit action → Set HTTP Method to POST

### Issue 2: HTTP Method Shows GET
- **Problem:** Default is GET, won't work with your API
- **Fix:** Change to POST (see fix steps above)

### Issue 3: Endpoint URL is Wrong
- **Problem:** URL doesn't match your Railway endpoint
- **Fix:** Update to: `https://backend-production-9c17.up.railway.app/api/iot/webhook`

---

## 🎯 Quick Action Plan

1. **Click "View details"** now ⬅️ **DO THIS FIRST**
2. **Check HTTP Method:** Should be POST
3. **If POST:** ✅ Test with MQTT Test Client
4. **If GET:** Edit rule → Change to POST → Save → Test

---

**Next Step:** Click the **"View details"** button to see the complete HTTPS action configuration, including the HTTP Method!

