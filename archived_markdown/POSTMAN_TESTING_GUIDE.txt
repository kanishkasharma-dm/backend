# 📮 Postman Testing Guide: Send Data to Database via API

## 🎯 Two Ways to Send Data

### Option 1: Direct API Endpoint (Recommended for Testing)
**Use this for direct API testing** - Data will be marked as `data_source: "software"`

### Option 2: IoT Webhook Endpoint (Simulates AWS IoT)
**Use this to simulate AWS IoT Core** - Data will be marked as `data_source: "cloud"`

---

## ✅ Option 1: Direct API Endpoint

### 📍 **Endpoint URL:**
```
POST https://backend-production-9c17.up.railway.app/api/devices/data
```

### 📋 **Headers:**
```
Content-Type: application/json
```

### 📦 **Request Body (JSON):**

#### **For CPAP Device:**
```json
{
  "device_status": 1,
  "device_data": "*,R,141125,1703,MANUALMODE,G,13.6,1.0,H,12.4,12.4,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,12345678C,#",
  "device_type": "CPAP",
  "device_id": "24"
}
```

#### **For BIPAP Device:**
```json
{
  "device_status": 1,
  "device_data": "*,S,141125,1447,A,12.2,1.0,B,29.6,10.8,10.6,40.0,10.0,10.0,13.0,1.0,C,16.0,10.0,10.0,10.0,10.0,10.0,0.0,200.0,1.0,D,11.0,10.0,10.0,10.0,10.0,10.0,10.0,200.0,1.0,E,20.0,10.0,5.0,10.0,20.0,20.0,1.0,200.0,1.0,170.0,500.0,F,5.0,1.0,1.0,1.0,0.0,1.0,1.0,#",
  "device_type": "BIPAP",
  "device_id": "25"
}
```

### ✅ **Expected Response:**
```json
{
  "success": true,
  "message": "Device data received and saved",
  "data": {
    "device_id": "24",
    "device_type": "CPAP",
    "device_status": 1,
    "timestamp": "2025-11-20T10:30:45.123Z",
    "record_id": "67890abcdef123456"
  },
  "config_update": {
    "available": false,
    "published": false
  }
}
```

---

## ✅ Option 2: IoT Webhook Endpoint (Simulates AWS IoT)

### 📍 **Endpoint URL:**
```
POST https://backend-production-9c17.up.railway.app/api/iot/webhook
```

### 📋 **Headers:**
```
Content-Type: application/json
```

### 📦 **Request Body (JSON):**

#### **For CPAP Device (with topic):**
```json
{
  "device_status": 1,
  "device_data": "*,R,141125,1703,MANUALMODE,G,13.6,1.0,H,12.4,12.4,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,12345678C,#",
  "device_type": "CPAP",
  "device_id": "24",
  "topic": "esp32/data24"
}
```

#### **For BIPAP Device (with topic):**
```json
{
  "device_status": 1,
  "device_data": "*,S,141125,1447,A,12.2,1.0,B,29.6,10.8,10.6,40.0,10.0,10.0,13.0,1.0,C,16.0,10.0,10.0,10.0,10.0,10.0,0.0,200.0,1.0,D,11.0,10.0,10.0,10.0,10.0,10.0,10.0,200.0,1.0,E,20.0,10.0,5.0,10.0,20.0,20.0,1.0,200.0,1.0,170.0,500.0,F,5.0,1.0,1.0,1.0,0.0,1.0,1.0,#",
  "device_type": "BIPAP",
  "device_id": "25",
  "topic": "esp32/data25"
}
```

### ✅ **Expected Response:**
```json
{
  "success": true,
  "message": "IoT data received and processed successfully",
  "requestId": "req_1763635676721_xbqjvjgu9",
  "data": {
    "device_id": "24",
    "device_type": "CPAP",
    "timestamp": "2025-11-20T10:30:45.123Z",
    "record_id": "67890abcdef123456"
  },
  "config_update": {
    "available": true,
    "published": true
  }
}
```

---

## 📝 Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `device_status` | Integer (0 or 1) | ✅ **Required** | Device status: `0` = off, `1` = on |
| `device_data` | String | ✅ **Required** | Raw CPAP/BIPAP data string (starts with `*,` and ends with `,#`) |
| `device_type` | String | ✅ **Required** | Device type: `"CPAP"` or `"BIPAP"` |
| `device_id` | String | Optional* | Device ID (e.g., `"24"`, `"25"`). If not provided, auto-generated |
| `topic` | String | Optional | MQTT topic (only for IoT webhook endpoint). Used to extract device_id if not provided |

\* *For direct API endpoint, `device_id` is optional but recommended. For IoT webhook, it can be extracted from `topic`.*

---

## 🚀 Postman Setup Steps

### Step 1: Create New Request

1. Open **Postman**
2. Click **New** → **HTTP Request**
3. Name it: `Send CPAP Data` (or `Send BIPAP Data`)

### Step 2: Configure Request

#### **Method:**
- Select **POST** from dropdown

#### **URL:**
- **Option 1 (Direct API):**
  ```
  https://backend-production-9c17.up.railway.app/api/devices/data
  ```
- **Option 2 (IoT Webhook):**
  ```
  https://backend-production-9c17.up.railway.app/api/iot/webhook
  ```

#### **Headers:**
1. Click **Headers** tab
2. Add header:
   - **Key**: `Content-Type`
   - **Value**: `application/json`

#### **Body:**
1. Click **Body** tab
2. Select **raw**
3. Select **JSON** from dropdown
4. Paste JSON payload (see examples above)

### Step 3: Send Request

1. Click **Send** button
2. Check **Response** section for result

---

## ✅ Success Indicators

### **Response Status:**
- **200 OK** = Success ✅
- **400 Bad Request** = Invalid data format ❌
- **500 Internal Server Error** = Server error ❌
- **503 Service Unavailable** = MongoDB not connected ❌

### **Response Body:**
Should contain:
```json
{
  "success": true,
  "message": "...",
  "data": {
    "device_id": "...",
    "device_type": "...",
    "record_id": "..."
  }
}
```

---

## 🔍 Verify Data in MongoDB

### Method 1: Check via API

```bash
# Get latest data for device 24
GET https://backend-production-9c17.up.railway.app/api/devices/24/data?limit=5

# Get only cloud data
GET https://backend-production-9c17.up.railway.app/api/devices/24/data?limit=5&data_source=cloud

# Get only software/direct API data
GET https://backend-production-9c17.up.railway.app/api/devices/24/data?limit=5&data_source=software
```

### Method 2: Check MongoDB Atlas

1. Go to **MongoDB Atlas** → **Database** → **Collections**
2. Open `devicedatas` collection
3. Look for new documents with:
   - `device_id`: Your device ID
   - `data_source`: `"software"` (for direct API) or `"cloud"` (for IoT webhook)
   - Recent `timestamp`

---

## 📋 Complete Postman Collection (JSON)

### **Save this as a Postman Collection:**

```json
{
  "info": {
    "name": "CPAP/BIPAP Device API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Send CPAP Data (Direct API)",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"device_status\": 1,\n  \"device_data\": \"*,R,141125,1703,MANUALMODE,G,13.6,1.0,H,12.4,12.4,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,12345678C,#\",\n  \"device_type\": \"CPAP\",\n  \"device_id\": \"24\"\n}"
        },
        "url": {
          "raw": "https://backend-production-9c17.up.railway.app/api/devices/data",
          "protocol": "https",
          "host": ["backend-production-9c17", "up", "railway", "app"],
          "path": ["api", "devices", "data"]
        }
      }
    },
    {
      "name": "Send CPAP Data (IoT Webhook)",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"device_status\": 1,\n  \"device_data\": \"*,R,141125,1703,MANUALMODE,G,13.6,1.0,H,12.4,12.4,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,12345678C,#\",\n  \"device_type\": \"CPAP\",\n  \"device_id\": \"24\",\n  \"topic\": \"esp32/data24\"\n}"
        },
        "url": {
          "raw": "https://backend-production-9c17.up.railway.app/api/iot/webhook",
          "protocol": "https",
          "host": ["backend-production-9c17", "up", "railway", "app"],
          "path": ["api", "iot", "webhook"]
        }
      }
    },
    {
      "name": "Get Device Data",
      "request": {
        "method": "GET",
        "url": {
          "raw": "https://backend-production-9c17.up.railway.app/api/devices/24/data?limit=10",
          "protocol": "https",
          "host": ["backend-production-9c17", "up", "railway", "app"],
          "path": ["api", "devices", "24", "data"],
          "query": [
            {
              "key": "limit",
              "value": "10"
            }
          ]
        }
      }
    }
  ]
}
```

**To import:**
1. Open Postman
2. Click **Import**
3. Paste the JSON above
4. Click **Import**

---

## ❌ Common Errors

### Error 400: "device_status is required"
**Fix:** Include `device_status` field (0 or 1)

### Error 400: "device_data is required"
**Fix:** Include `device_data` field with valid data string

### Error 400: "device_type is required and must be CPAP or BIPAP"
**Fix:** Include `device_type` field with value `"CPAP"` or `"BIPAP"`

### Error 400: "Failed to parse device data"
**Fix:** Check `device_data` format. Should start with `*,` and end with `,#`

### Error 503: "Database unavailable"
**Fix:** MongoDB connection issue. Check Railway environment variables.

---

## 🎯 Quick Test Examples

### **Test 1: Simple CPAP Data**
```json
{
  "device_status": 1,
  "device_data": "*,R,141125,1703,MANUALMODE,G,13.6,1.0,H,12.4,12.4,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,12345678C,#",
  "device_type": "CPAP",
  "device_id": "24"
}
```

### **Test 2: Simple BIPAP Data**
```json
{
  "device_status": 1,
  "device_data": "*,S,141125,1447,A,12.2,1.0,B,29.6,10.8,10.6,40.0,10.0,10.0,13.0,1.0,C,16.0,10.0,10.0,10.0,10.0,10.0,0.0,200.0,1.0,D,11.0,10.0,10.0,10.0,10.0,10.0,10.0,200.0,1.0,E,20.0,10.0,5.0,10.0,20.0,20.0,1.0,200.0,1.0,170.0,500.0,F,5.0,1.0,1.0,1.0,0.0,1.0,1.0,#",
  "device_type": "BIPAP",
  "device_id": "25"
}
```

---

**That's it! Use Postman to test sending data to your database! 🚀**

