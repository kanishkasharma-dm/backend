# ✅ Create New IoT Rule - Complete Step-by-Step Guide

## Current Status
✅ **Old rule deleted:** ForwardESP32DataToBackend  
✅ **On Create Rule page:** Step 1 - Specify rule properties  
✅ **HTTP Method should be visible** when creating NEW action

---

## 📋 Step 1: Specify Rule Properties

### Rule Name:
```
ForwardESP32DataToBackend
```
- Must be alphanumeric with underscores (no spaces)
- Click "Next" button (orange)

---

## 📋 Step 2: Configure SQL Statement

### SQL Version:
```
2016-03-23
```
(Leave as default)

### SQL Statement:
```sql
SELECT 
  device_status,
  device_data,
  device_type,
  device_id,
  topic() as topic,
  timestamp() as timestamp
FROM 'esp32/+'
```

**Explanation:**
- `SELECT` - Fields to extract from MQTT message
- `FROM 'esp32/+'` - Matches all topics like `esp32/data24`, `esp32/data25`, etc.
- `+` wildcard matches any single level in the topic

### Click "Next" button (orange)

---

## 📋 Step 3: Attach Rule Actions ⬅️ **MOST IMPORTANT**

This is where you'll configure the HTTPS action with **POST method**.

### Step 3.1: Add HTTPS Action

1. **Click "Add action"** button

2. **Select action type:**
   - Look for **"HTTPS"** or **"HTTPS endpoint"**
   - Click on it

3. **Configure HTTPS Action:**

   **A. Endpoint URL:**
   ```
   https://backend-production-9c17.up.railway.app/api/iot/webhook
   ```
   - Paste the URL in the endpoint field
   - Make sure it's `https://` (not `http://`)

   **B. HTTP Method:** ⬅️ **THIS SHOULD BE VISIBLE NOW!**
   - Look for dropdown: **"HTTP Method"** or **"Method"**
   - **Select: POST** ⬅️ **CRITICAL - Must be POST, not GET!**
   - This dropdown should be visible when creating NEW action

   **C. Confirmation URL (optional):**
   - Leave blank (not required)

   **D. Headers:**
   - Click **"Add new header"** button
   - **Key:** `Content-Type`
   - **Value:** `application/json`
   - Click to add

   **E. Authentication:**
   - Select: **"None"** (default is fine)

   **F. Message Payload Template:**
   - Look for "Message payload" or "Payload template" section
   - Select **"Use message content"** or enter:
     ```json
     {
       "device_status": ${device_status},
       "device_data": "${device_data}",
       "device_type": "${device_type}",
       "device_id": "${device_id}",
       "topic": "${topic()}"
     }
     ```

4. **Click "Add action"** or **"Save"** button

5. **Verify action is added:**
   - Should see: "Actions (1/1)" or similar
   - HTTPS endpoint should be listed

### Step 3.2: Error Action (Optional)
- Leave blank (not required)

### Click "Next" button (orange)

---

## 📋 Step 4: Review and Create

### Review Checklist:

1. **Rule name:** `ForwardESP32DataToBackend` ✅
2. **SQL statement:** `FROM 'esp32/+'` ✅
3. **Action:** HTTPS endpoint ✅
4. **Endpoint URL:** `https://backend-production-9c17.up.railway.app/api/iot/webhook` ✅
5. **HTTP Method:** **POST** ⬅️ **VERIFY THIS!** ✅
6. **Headers:** `Content-Type: application/json` ✅
7. **Message Payload:** Includes all required fields ✅

### Enable Rule:
- **Toggle switch should be ON** (green) - Rule enabled
- This allows the rule to execute immediately

### Click "Create rule" button (orange)

---

## ✅ After Creating Rule

### Step 1: Verify Rule is Active

1. **You'll see success message:** "Successfully created rule ForwardESP32DataToBackend"
2. **Go to Rules list:** Click "View rule" or go back to Rules
3. **Check Status:** Should be **Active** (green checkmark)

### Step 2: Test the Rule

1. **Go to MQTT Test Client:**
   - AWS IoT → Test → MQTT test client

2. **Publish test message:**
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
   - Click **"Publish"**

3. **Check Railway Logs (within 2-5 seconds):**
   - Go to Railway Dashboard → Your Service → Deployments → View Logs
   - Look for:
     ```
     [req_...] 📥 Received IoT data request
     [req_...] 💾 Attempting to save data for device: 24
     [req_...] ✅ Data saved successfully to MongoDB
     ```

4. **Check MongoDB (within 5-10 seconds):**
   - MongoDB Atlas → Browse Collections → DeviceData
   - Filter: `{ device_id: "24", data_source: "cloud" }`
   - Should see new document with your test data

---

## 🎯 Key Points When Creating Action

### HTTP Method MUST Be POST:
```
✅ POST  (Correct - will send data to your API)
❌ GET   (Wrong - will not work with your API)
```

### Why It Should Be Visible Now:
- When **creating NEW action**, AWS console usually shows HTTP Method dropdown
- When **editing existing action**, it might not show (UI limitation)
- That's why we deleted and are recreating!

### If HTTP Method Still Not Visible:
1. Try scrolling down in the action configuration
2. Try expanding/collapsing sections
3. Try a different browser (Chrome, Firefox, Safari)
4. Check if there's an "Advanced" or "More options" section

---

## 📋 Complete Configuration Summary

**Rule Name:** `ForwardESP32DataToBackend`

**SQL Statement:**
```sql
SELECT 
  device_status,
  device_data,
  device_type,
  device_id,
  topic() as topic,
  timestamp() as timestamp
FROM 'esp32/+'
```

**Action Configuration:**
- **Type:** HTTPS endpoint
- **Endpoint URL:** `https://backend-production-9c17.up.railway.app/api/iot/webhook`
- **HTTP Method:** **POST** ⬅️ Critical!
- **Headers:** `Content-Type: application/json`
- **Message Payload:**
  ```json
  {
    "device_status": ${device_status},
    "device_data": "${device_data}",
    "device_type": "${device_type}",
    "device_id": "${device_id}",
    "topic": "${topic()}"
  }
  ```
- **Authentication:** None

**Rule Status:** Enabled (Active)

---

## ⚠️ Common Mistakes to Avoid

1. **❌ Forgetting to set HTTP Method to POST**
   - AWS defaults to GET if not set
   - GET requests won't work with your API

2. **❌ Wrong endpoint URL**
   - Must be exactly: `https://backend-production-9c17.up.railway.app/api/iot/webhook`
   - Include `/api/iot/webhook` at the end

3. **❌ Missing Content-Type header**
   - Your API expects JSON
   - Without header, request might fail

4. **❌ Wrong SQL topic pattern**
   - Use `'esp32/+'` to match `esp32/data24`
   - `+` matches single level, `#` matches multiple levels

5. **❌ Rule not enabled**
   - Make sure toggle is ON (green)
   - Disabled rules don't execute

---

## ✅ Success Checklist

After creating the rule, verify:

- [ ] Rule name: `ForwardESP32DataToBackend`
- [ ] Rule status: **Active** (green checkmark)
- [ ] SQL statement: `FROM 'esp32/+'`
- [ ] Action: HTTPS endpoint configured
- [ ] Endpoint URL: Correct ✅
- [ ] **HTTP Method: POST** ✅ ⬅️ Most important!
- [ ] Headers: `Content-Type: application/json` ✅
- [ ] Message Payload: All required fields ✅
- [ ] Test message reaches Railway logs ✅
- [ ] Data appears in MongoDB ✅

---

**Next Step:** Fill in Step 1 (Rule name: `ForwardESP32DataToBackend`) and click "Next"!

