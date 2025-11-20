# 📊 Data Source Identification - Examples

## ✅ What Changed

I've added a `data_source` field to track where data comes from:

- **`cloud`** = From AWS IoT Core (hardware/ESP32 device)
- **`software`** = From direct API call (software/application)
- **`direct`** = Legacy/default value (backward compatibility)

---

## 🔍 How to Check Data Source

### **Method 1: MongoDB Atlas/Compass**

1. **Open MongoDB Atlas/Compass**
2. **Go to:** `DeviceData` collection
3. **View documents** - each will have a `data_source` field
4. **Filter by source:**
   - `{ "data_source": "cloud" }` - Hardware data
   - `{ "data_source": "software" }` - Software data

---

### **Method 2: API Endpoint (Filter by Source)**

#### **Get all data:**
```bash
curl "https://backend-production-9c17.up.railway.app/api/devices/24/data?limit=10"
```

#### **Get only cloud data (hardware):**
```bash
curl "https://backend-production-9c17.up.railway.app/api/devices/24/data?data_source=cloud&limit=10"
```

#### **Get only software data (direct API):**
```bash
curl "https://backend-production-9c17.up.railway.app/api/devices/24/data?data_source=software&limit=10"
```

---

## 📋 Example Responses

### **Response with Cloud Data:**
```json
{
  "success": true,
  "data": {
    "records": [
      {
        "_id": "67890abcdef",
        "device_id": "24",
        "device_type": "CPAP",
        "device_status": 0,
        "data_source": "cloud",
        "parsed_data": { ... },
        "timestamp": "2025-11-19T08:25:04.466Z",
        "createdAt": "2025-11-19T08:25:04.466Z"
      }
    ],
    "pagination": {
      "total": 150,
      "limit": 10,
      "offset": 0,
      "has_more": true
    }
  }
}
```

**Note:** `"data_source": "cloud"` means this came from hardware via AWS IoT Core!

---

### **Response with Software Data:**
```json
{
  "success": true,
  "data": {
    "records": [
      {
        "_id": "12345abcdef",
        "device_id": "24",
        "device_type": "CPAP",
        "device_status": 0,
        "data_source": "software",
        "parsed_data": { ... },
        "timestamp": "2025-11-19T08:26:51.102Z",
        "createdAt": "2025-11-19T08:26:51.102Z"
      }
    ],
    "pagination": {
      "total": 25,
      "limit": 10,
      "offset": 0,
      "has_more": true
    }
  }
}
```

**Note:** `"data_source": "software"` means this came from a direct API call!

---

## 🧪 Quick Test

### **1. Send data from cloud (hardware):**
When your ESP32 device sends data → AWS IoT Core → Railway API, it's automatically marked as `cloud`.

**Check in MongoDB:**
- Should see: `data_source: "cloud"`

### **2. Send data from software (direct API):**

```bash
curl -X POST "https://backend-production-9c17.up.railway.app/api/devices/data" \
  -H "Content-Type: application/json" \
  -d '{
    "device_status": 0,
    "device_data": "*,R,191125,1348,AUTOMODE,G,16.0,1.0,H,12.4,12.4,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,12345678C,#",
    "device_type": "CPAP",
    "device_id": "24"
  }'
```

**Check in MongoDB:**
- Should see: `data_source: "software"`

---

## 📊 Count by Source

### **Using MongoDB Query:**

```javascript
// Count cloud data
db.devicedatas.countDocuments({ 
  device_id: "24", 
  data_source: "cloud" 
})

// Count software data
db.devicedatas.countDocuments({ 
  device_id: "24", 
  data_source: "software" 
})
```

### **Using MongoDB Aggregation:**

```javascript
db.devicedatas.aggregate([
  {
    $match: { device_id: "24" }
  },
  {
    $group: {
      _id: "$data_source",
      count: { $sum: 1 },
      latest: { $max: "$timestamp" }
    }
  }
])
```

**Result:**
```json
[
  { "_id": "cloud", "count": 150, "latest": ISODate("2025-11-19T08:30:00Z") },
  { "_id": "software", "count": 25, "latest": ISODate("2025-11-19T08:28:00Z") }
]
```

---

## 💡 Use Cases

### **1. Debug Data Flow:**
- Check if data from hardware is reaching database
- Verify if software test data is being saved
- Compare data from different sources

### **2. Generate Reports:**
- Separate reports for hardware vs software data
- Track data quality by source
- Analyze patterns by source

### **3. Data Analytics:**
- Compare device behavior (hardware) vs test data (software)
- Monitor data frequency by source
- Identify data gaps by source

---

## ✅ Summary

**Every record now has:**
- ✅ `data_source: "cloud"` = From hardware via AWS IoT Core
- ✅ `data_source: "software"` = From direct API call
- ✅ `data_source: "direct"` = Legacy/default value

**To identify:**
1. Check `data_source` field in MongoDB
2. Filter by `?data_source=cloud` or `?data_source=software` in API
3. Look for `data_source` in API response

**This helps you:**
- ✅ Know exactly where data came from
- ✅ Debug data flow issues
- ✅ Generate separate analytics by source
- ✅ Track data quality by source

