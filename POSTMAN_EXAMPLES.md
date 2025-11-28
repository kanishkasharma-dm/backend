# Postman API Examples

## 1. CPAP/BIPAP Device API

### POST /api/devices/data

**CPAP Example:**
```json
{
  "device_status": 1,
  "device_data": "*,R,141125,1703,MANUALMODE,G,13.6,1.0,H,12.4,12.4,20.0,1.0,I,5.0,#",
  "device_type": "CPAP",
  "device_id": "24"
}
```

**BIPAP Example:**
```json
{
  "device_status": 1,
  "device_data": "*,R,141125,1703,MANUALMODE,G,13.6,1.0,H,12.4,12.4,20.0,1.0,I,5.0,#",
  "device_type": "BIPAP",
  "device_id": "25"
}
```

**Headers:**
```
Content-Type: application/json
```

---

## 2. ECG API

### POST /api/ecg/data

**Simple JSON Format (No PDF required):**
```json
{
  "device_id": "ECG-12345",
  "ecg_json_data": {
    "timestamp": "2025-11-18 13:16:34",
    "file": "ECG_Report_20251118_131634.pdf",
    "patient": {
      "name": "John Doe",
      "age": "45",
      "gender": "Male",
      "date_time": "2025-11-18 13:16:34"
    },
    "metrics": {
      "HR_bpm": 75,
      "PR_ms": 160,
      "QRS_ms": 90,
      "QT_ms": 400,
      "QTc_ms": 420,
      "QTcF_ms": 410,
      "ST_ms": -0.05,
      "ST_mV": -0.05,
      "RR_ms": 800,
      "Sokolow_Lyon_mV": 2.5,
      "P_QRS_T_axes_deg": ["45", "30", "60"],
      "RV5_SV1_mV": [1.5, -1.0]
    }
  }
}
```

**Headers:**
```
Content-Type: application/json
```

**Note:** For testing without PDF, just send the JSON data. The API will store the metrics and patient info.

---

## 3. OC (Oxygen Concentrator) API

### POST /api/oc/data

**Format 1: Mobile App Request**
```json
{
  "device_status": 1,
  "device_data": 2,
  "device_id": "12345678"
}
```

**Format 2: Machine Acknowledgement**
```json
{
  "device_status": 0,
  "device_data": 2,
  "device_id": "12345678"
}
```

**Format 3: Data Storage**
```json
{
  "device_data": "ON, OK",
  "device_id": "12345678"
}
```

**Headers:**
```
Content-Type: application/json
```

---

## 4. Get Endpoints

### GET /api/devices/:deviceId/data
```
GET http://localhost:3000/api/devices/24/data?limit=10
```

### GET /api/ecg/data
```
GET http://localhost:3000/api/ecg/data?device_id=ECG-12345&limit=10
```

### GET /api/oc/data/:deviceId
```
GET http://localhost:3000/api/oc/data/12345678?limit=10
```

### GET /api/oc/data/:deviceId/latest
```
GET http://localhost:3000/api/oc/data/12345678/latest
```

---

## Quick Test URLs

**Local:**
- Base URL: `http://localhost:3000`

**Production (Railway):**
- Base URL: `https://backend-production-9c17.up.railway.app`

---

## Common Headers

```
Content-Type: application/json
```

For multipart/form-data (ECG file upload):
```
Content-Type: multipart/form-data
```

