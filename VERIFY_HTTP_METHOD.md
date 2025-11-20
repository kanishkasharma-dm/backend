# ✅ Verify HTTP Method After Viewing Action Details

## Current Status
✅ **Endpoint URL is correct:** `https://backend-production-9c17.up.railway.app/api/iot/webhook`  
❓ **HTTP Method (POST/GET):** Not visible in popup  
❓ **Need to verify:** Is it set to POST?

---

## 🔍 Next Steps: Find HTTP Method

The popup shows the endpoint URL, but the **HTTP Method (POST/GET)** might not be displayed there.

### Option 1: Check if HTTP Method is in Popup

1. **Scroll down** in the popup (if there's more content)
2. **Look for:** "HTTP Method", "Method", or similar field
3. **If you see it:** Verify it's set to **POST**

### Option 2: Edit the Rule to See/Set HTTP Method

Since HTTP Method might not be visible in the popup, edit the rule:

1. **Close the popup** (click "Close" button)

2. **Click "Edit" button** (on the rule page, top right)
   - Or use breadcrumb: Rules → ForwardESP32DataToBackend → Edit

3. **Scroll to "Actions" section**

4. **Click on the HTTPS action** (or "Edit" button next to it)

5. **Look for HTTP Method dropdown:**
   - Should be visible when editing the action
   - Dropdown options: GET, POST, PUT, etc.
   - **Must be set to: POST** ⬅️ Critical!

6. **If it's GET or not set:**
   - Select **POST** from the dropdown
   - Verify other settings:
     - Endpoint URL: `https://backend-production-9c17.up.railway.app/api/iot/webhook`
     - Headers: `Content-Type: application/json`
     - Message Payload Template: (check if present)

7. **Save the action**

8. **Update the rule** (click "Update" at bottom)

---

## 📋 Complete Action Configuration Checklist

When editing the action, verify:

### Endpoint URL:
```
✅ https://backend-production-9c17.up.railway.app/api/iot/webhook
```

### HTTP Method: ⬅️ **MOST CRITICAL**
```
✅ POST  (Correct - will send data to your API)
❌ GET   (Wrong - will not work with your API)
```

### Headers:
```
✅ Content-Type: application/json
```

### Message Payload Template (if visible):
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

## ⚠️ Important: HTTP Method MUST be POST

**Why POST is critical:**
- Your API endpoint `/api/iot/webhook` expects **POST** requests
- **GET** requests will return 404 or not work
- AWS IoT defaults to **GET** if not explicitly set

**If HTTP Method is not POST:**
- Data will not reach your API
- No errors in AWS (rule executes successfully)
- But your API won't receive the data
- MongoDB won't get the data

---

## 🧪 Test After Setting HTTP Method to POST

### Step 1: Verify Configuration
- [ ] HTTP Method is **POST** ✅
- [ ] Endpoint URL is correct ✅
- [ ] Rule Status is **Active** (green checkmark) ✅

### Step 2: Publish Test Message

1. **Go to MQTT Test Client:**
   - AWS IoT → Test → MQTT test client

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

### Step 3: Verify Data Flow

**Check Railway Logs (within 2-5 seconds):**
- Go to Railway Dashboard → Your Service → Deployments → View Logs
- Look for:
  ```
  [req_...] 📥 Received IoT data request
  [req_...] 💾 Attempting to save data for device: 24
  [req_...] ✅ Data saved successfully to MongoDB
  ```

**Check MongoDB (within 5-10 seconds):**
- MongoDB Atlas → Browse Collections → DeviceData
- Filter: `{ device_id: "24", data_source: "cloud" }`
- Should see new document with your data

---

## 🔧 Troubleshooting

### Issue 1: HTTP Method field not visible when editing
- **Solution:** Try expanding the action section more
- Look for dropdown or field labeled "Method" or "HTTP Method"
- It might be in a collapsed section

### Issue 2: HTTP Method defaults to GET
- **Problem:** If not explicitly set, AWS defaults to GET
- **Solution:** Must explicitly select POST from dropdown
- Cannot leave it unset

### Issue 3: After setting POST, still not working
- **Check:** Rule is saved and status is Active
- **Check:** Endpoint URL is exactly correct (no trailing slash)
- **Check:** Headers include Content-Type: application/json
- **Check:** Railway service is running
- **Check:** MongoDB connection is working

---

## ✅ Summary

**What you've done:**
1. ✅ Rule is configured with correct endpoint URL
2. ✅ Rule status is Active
3. ✅ Topic pattern `esp32/+` matches `esp32/data24`

**What to do next:**
1. ⬅️ **Edit the rule** to verify/set HTTP Method to **POST**
2. ✅ Verify Headers include `Content-Type: application/json`
3. ✅ Verify Message Payload Template (if visible)
4. ✅ Save and test

**Most Critical:** HTTP Method **MUST be POST**. If it's GET or not set, the data won't reach your API!

---

**Next Step:** Click "Close" on the popup, then click "Edit" on the rule to verify/set HTTP Method to POST.

