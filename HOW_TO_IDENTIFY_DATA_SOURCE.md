# 📊 How to Identify Data Source: Cloud vs Software

## ✅ What I Added

I've added a `data_source` field to track where data comes from:

- **`cloud`** = Data from AWS IoT Core (hardware/device)
- **`software`** = Data from direct API calls (software/application)

---

## 📋 Data Source Values

| Source | Value | Description |
|--------|-------|-------------|
| **Hardware via AWS IoT** | `cloud` | Data sent by ESP32 device → AWS IoT Core → Railway API |
| **Direct API Call** | `software` | Data sent directly to API endpoint (POST /api/devices/data) |
| **Legacy/Default** | `direct` | Old data or default value (for backward compatibility) |

---

## 🔍 How to Query Data by Source

### **Option 1: Using MongoDB Compass/Atlas**

1. **Open MongoDB Atlas/Compass**
2. **Connect to your database**
3. **Go to:** `DeviceData` collection
4. **Add filter:**

#### **Get all cloud data:**
```javascript
{ "data_source": "cloud" }
```

#### **Get all software data:**
```javascript
{ "data_source": "software" }
```

#### **Get data for specific device from cloud:**
```javascript
{ 
  "device_id": "24",
  "data_source": "cloud"
}
```

#### **Get data for specific device from software:**
```javascript
{ 
  "device_id": "24",
  "data_source": "software"
}
```

---

### **Option 2: Using API Endpoint**

#### **Get data from cloud (hardware):**

```bash
curl "https://backend-production-9c17.up.railway.app/api/devices/24/data?data_source=cloud&limit=10"
```

#### **Get data from software (direct API):**

```bash
curl "https://backend-production-9c17.up.railway.app/api/devices/24/data?data_source=software&limit=10"
```

#### **Get all data (both sources):**

```bash
curl "https://backend-production-9c17.up.railway.app/api/devices/24/data?limit=10"
```

**Note:** You may need to update the API endpoint to support `data_source` query parameter (see below).

---

### **Option 3: Using JavaScript/Node.js**

```javascript
const mongoose = require('mongoose');
const DeviceData = require('./models/DeviceData');

// Get all cloud data
const cloudData = await DeviceData.find({ 
  data_source: 'cloud',
  device_id: '24'
}).sort({ timestamp: -1 }).limit(10);

// Get all software data
const softwareData = await DeviceData.find({ 
  data_source: 'software',
  device_id: '24'
}).sort({ timestamp: -1 }).limit(10);

// Get data from both sources
const allData = await DeviceData.find({ 
  device_id: '24'
}).sort({ timestamp: -1 }).limit(10);
```

---

### **Option 4: Using Python**

```python
from pymongo import MongoClient

client = MongoClient("your_mongodb_uri")
db = client["your_database"]
collection = db["devicedatas"]

# Get cloud data
cloud_data = list(collection.find({
    "device_id": "24",
    "data_source": "cloud"
}).sort("timestamp", -1).limit(10))

# Get software data
software_data = list(collection.find({
    "device_id": "24",
    "data_source": "software"
}).sort("timestamp", -1).limit(10))
```

---

## 🔍 Check Data Source in Response

When you fetch data, each record will include the `data_source` field:

### **Example API Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "67890abcdef",
      "device_id": "24",
      "device_type": "CPAP",
      "device_status": 0,
      "data_source": "cloud",
      "raw_data": "*,R,191125,1348,AUTOMODE,G,16.0,1.0...",
      "parsed_data": { ... },
      "timestamp": "2025-11-19T08:25:04.466Z",
      "createdAt": "2025-11-19T08:25:04.466Z",
      "updatedAt": "2025-11-19T08:25:04.466Z"
    },
    {
      "_id": "12345abcdef",
      "device_id": "24",
      "device_type": "CPAP",
      "device_status": 0,
      "data_source": "software",
      "raw_data": "*,R,191125,1348,AUTOMODE,G,16.0,1.0...",
      "parsed_data": { ... },
      "timestamp": "2025-11-19T08:26:51.102Z",
      "createdAt": "2025-11-19T08:26:51.102Z",
      "updatedAt": "2025-11-19T08:26:51.102Z"
    }
  ]
}
```

**Look for `"data_source": "cloud"` or `"data_source": "software"`** in each record!

---

## 📊 Count Data by Source

### **Using MongoDB:**

```javascript
// Count cloud data
const cloudCount = await DeviceData.countDocuments({ 
  device_id: '24',
  data_source: 'cloud'
});

// Count software data
const softwareCount = await DeviceData.countDocuments({ 
  device_id: '24',
  data_source: 'software'
});

console.log(`Cloud (hardware): ${cloudCount}`);
console.log(`Software (direct): ${softwareCount}`);
```

### **Using MongoDB Aggregation:**

```javascript
const stats = await DeviceData.aggregate([
  {
    $match: { device_id: '24' }
  },
  {
    $group: {
      _id: '$data_source',
      count: { $sum: 1 },
      latest: { $max: '$timestamp' }
    }
  }
]);

// Result:
// [
//   { _id: 'cloud', count: 150, latest: ISODate('2025-11-19T08:30:00Z') },
//   { _id: 'software', count: 25, latest: ISODate('2025-11-19T08:28:00Z') }
// ]
```

---

## 🧪 Test It

### **1. Send data from cloud (via AWS IoT):**
Your ESP32 device will automatically mark it as `cloud` when it sends data.

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

This will be saved with `data_source: "software"`.

### **3. Check in MongoDB:**

```bash
# Check cloud data
# Look for records with data_source: "cloud"

# Check software data  
# Look for records with data_source: "software"
```

---

## 📝 Summary

**Every record now has:**
- ✅ `data_source: "cloud"` = From hardware via AWS IoT Core
- ✅ `data_source: "software"` = From direct API call

**To identify source:**
1. Check the `data_source` field in MongoDB
2. Filter by `data_source` in queries
3. Look for `data_source` in API responses

**This helps you:**
- ✅ Track which data comes from hardware vs software
- ✅ Debug data flow issues
- ✅ Generate separate reports for cloud vs software data
- ✅ Analyze data quality by source

---

## 🔄 Migration Note

**Old data** (before this update) will have:
- `data_source: "direct"` (default value)
- OR missing `data_source` field

**New data** will have:
- `data_source: "cloud"` (from AWS IoT)
- `data_source: "software"` (from direct API)

If you want to update old data, you can run a migration script (see below).

---

## 🔄 Optional: Update Old Data

If you want to update existing records to have a `data_source` value:

```javascript
// In MongoDB or Node.js script:
await DeviceData.updateMany(
  { data_source: { $exists: false } },
  { $set: { data_source: 'direct' } }
);
```

This will set `data_source: "direct"` for all old records without the field.

