# Medical Device Data API

A single source of truth for receiving, parsing, and storing medical device telemetry data. Supports CPAP/BIPAP devices, ECG data, and OC (Oxygen Concentrator) devices with realtime mobile-machine communication.

## Table of Contents
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Environment Variables](#environment-variables)
- [Running the Server](#running-the-server)
- [HTTP Methods Explained](#http-methods-explained)
- [API Endpoints](#api-endpoints)
- [Postman Testing](#postman-testing)
- [IoT Rule & Webhook](#iot-rule--webhook)
- [Troubleshooting & Verification](#troubleshooting--verification)
- [Common Errors](#common-errors)
- [Data Validation](#data-validation)
- [Archived Guides](#archived-guides)

## Features
- **CPAP/BIPAP API**: Receives MQTT-originated data via an IoT webhook and direct device payloads. Parses device data strings into structured fields and persists them to MongoDB. Tracks configuration updates pushed back to devices.
- **ECG API**: Handles ECG data with JSON and PDF file storage in AWS S3, with presigned URL generation for secure access.
- **OC API**: Manages Oxygen Concentrator devices with realtime bidirectional communication between mobile apps and machines. Supports data storage and status tracking.
- Supports AWS IoT Core forwarding and manual Postman/cURL testing.

## Prerequisites
- Node.js 18 or newer
- MongoDB Atlas or local MongoDB instance
- npm or yarn for dependency management
- Optional: AWS IoT Core credentials if you plan to forward MQTT data through the cloud

## Setup
1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/<your-org>/mehulapi.git
   cd mehulapi
   npm install
   ```
2. Create a `.env` file in the project root:
   ```env
   PORT=3000
   NODE_ENV=development
   MONGODB_URI=mongodb://localhost:27017/mehulapi
   # Optional AWS IoT Core variables
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=your_access_key
   AWS_SECRET_ACCESS_KEY=your_secret_key
   AWS_IOT_ENDPOINT=xxxxxx-ats.iot.us-east-1.amazonaws.com
   ```
3. Ensure MongoDB Atlas allows access from Railway (if deployed) and that the cluster is reachable from your environment.

## Environment Variables
| Variable | Purpose |
|----------|---------|
| `PORT` | Server listening port (default 3000) |
| `NODE_ENV` | `development` or `production` |
| `MONGODB_URI` | MongoDB connection string |
| `AWS_REGION` | AWS region for IoT Core (optional) |
| `AWS_ACCESS_KEY_ID` | AWS key (optional) |
| `AWS_SECRET_ACCESS_KEY` | AWS secret (optional) |
| `AWS_IOT_ENDPOINT` | IoT endpoint for config publishing (optional) |

## Running the Server
- Development mode with auto-reload:
  ```bash
  npm run dev
  ```
- Production mode:
  ```bash
  npm start
  ```
The API will be reachable at `http://localhost:<PORT>`.

## HTTP Methods Explained
- **GET** – Ask the API to give back data without changing anything. Example: `GET /api/devices/24/data` returns saved records for device 24.
- **POST** – Send new information to the API so it can store it. Example: `POST /api/devices/data` pushes telemetry.
- **PUT** – Replace an existing resource with a fresh version. Example: `PUT /api/devices/:deviceId/config` would overwrite a device’s configuration.
- **PATCH** – Make a small update without sending the whole object. (This API mostly keeps writing with POST/PUT.)
- **DELETE** – Remove something from the database. Not used frequently in this project.

## API Endpoints

### Health Check
- `GET /health`
- Returns `200 OK` with a heartbeat message.

---

## CPAP/BIPAP Device API

### Receive Device Data
- `POST /api/devices/data`
- Receives smart device payloads coming directly from hardware or diagnostic tools.
- Required fields:
  ```json
  {
    "device_status": 1,
    "device_data": "*,S,141125,1447,G,12.2,1.0,...,#",
    "device_type": "CPAP",
    "device_id": "device_001"
  }
  ```
- Response:
  ```json
  {
    "success": true,
    "message": "Device data received and saved",
    "data": {
      "device_id": "device_001",
      "device_type": "CPAP",
      "timestamp": "2025-11-20T10:30:45.123Z",
      "record_id": "67890abcdef123456"
    },
    "config_update": {
      "available": false,
      "published": false
    }
  }
  ```

### Get Device Configuration
- `GET /api/devices/:deviceId/config`
- Returns the latest configuration that a device should apply.
- Response includes `pending_update` flag and `config_values` object.

### Set Device Configuration
- `POST /api/devices/:deviceId/config`
- Saves configuration data that will be pushed to the device.
- Sample request:
  ```json
  {
    "device_type": "CPAP",
    "config_values": {
      "pressure": 12.0,
      "humidity": 5.0,
      "temperature": 1.0,
      "mode": 1
    }
  }
  ```
- Response:
  ```json
  {
    "success": true,
    "message": "Device configuration saved successfully",
    "data": {
      "device_id": "device_001",
      "pending_update": true
    }
  }
  ```

### Mark Configuration as Delivered
- `POST /api/devices/:deviceId/config/delivered`
- Called by the device once it applies a configuration update.
- Response confirms delivery and sets `pending_update` to false.

### Get Device Data History
- `GET /api/devices/:deviceId/data?limit=100&offset=0`
- Returns paginated history of saved telemetry records.
- Query parameters: `limit` (default 100), `offset` (default 0), optional `data_source` (`software` or `cloud`).

### IoT Webhook Endpoint
- `POST /api/iot/webhook`
- Consumes payload forwarded from AWS IoT Core rules.
- Required fields are the same as the direct `devices/data` endpoint, with the addition of `topic` when forwarding from IoT Core:
  ```json
  {
    "device_status": 1,
    "device_data": "*,R,141125,1703,MANUALMODE,...,#",
    "device_type": "CPAP",
    "device_id": "24",
    "topic": "esp32/data24"
  }
  ```
- Response mirrors the direct endpoint and returns `config_update` metadata.

---

## ECG Data API

### Receive ECG Data
- `POST /api/ecg/data`
- Receives ECG data with JSON and PDF files, stores them in AWS S3, and saves metadata to MongoDB.
- Required fields:
  ```json
  {
    "device_id": "ecg_device_001",
    "patient_id": "patient_123",
    "ecg_json": { /* ECG data object */ },
    "ecg_pdf": "base64_encoded_pdf_string"
  }
  ```
- Response includes S3 URLs and record ID.

### Get ECG Data
- `GET /api/ecg/data?device_id=xxx&patient_id=xxx&limit=10`
- Retrieves ECG records with optional filtering and pagination.

### Get ECG Record by ID
- `GET /api/ecg/data/:recordId`
- Returns a specific ECG record with metadata.

### Get Presigned URLs
- `POST /api/ecg/data/:recordId/presigned-urls`
- Generates temporary presigned URLs for accessing S3 files.

---

## OC (Oxygen Concentrator) API

### Receive OC Data
- `POST /api/oc/data`
- Handles realtime communication between mobile apps and machines, plus data storage.

**Format 1: Mobile App Request**
```json
{
  "device_status": 1,
  "device_data": 0,
  "device_id": "12345678"
}
```
- `device_status: 1` indicates request from mobile
- `device_data: 0/1/2/3` represents command/status code

**Format 2: Machine Acknowledgement**
```json
{
  "device_status": 0,
  "device_data": 0,
  "device_id": "12345678"
}
```
- `device_status: 0` indicates acknowledgement from machine
- `device_data: 0/1/2/3` represents response code

**Format 3: Data Storage**
```json
{
  "device_data": "power_status, alm_status",
  "device_id": "12345678"
}
```
- Stores device data as comma-separated string
- Automatically parses into `power_status` and `alm_status`

**Response:**
```json
{
  "success": true,
  "message": "OC data received and stored",
  "data": {
    "id": "67890abcdef123456",
    "device_id": "12345678",
    "device_status": 1,
    "device_data": 0,
    "source": "mobile",
    "timestamp": "2025-11-27T10:30:45.123Z"
  }
}
```

### Get OC Data History
- `GET /api/oc/data/:deviceId?limit=50&source=mobile&device_status=1`
- Retrieves historical OC data for a device with optional filters:
  - `limit`: Number of records (default: 50)
  - `source`: Filter by `mobile`, `machine`, or `direct`
  - `device_status`: Filter by `0` (ack) or `1` (request)

### Get Latest OC Data
- `GET /api/oc/data/:deviceId/latest`
- Returns the most recent OC data record for a device.

### Update OC Data
- `PUT /api/oc/data/:deviceId`
- Updates device data in storage format:
  ```json
  {
    "device_data": "power_status, alm_status"
  }
  ```
- Automatically parses and stores the comma-separated values.

---

## Postman Testing

### CPAP/BIPAP Device Testing
1. Create a POST request to `https://backend-production-9c17.up.railway.app/api/devices/data`.
2. Set header `Content-Type: application/json`.
3. Send payload (example for CPAP):
   ```json
   {
     "device_status": 1,
     "device_data": "*,R,141125,1703,MANUALMODE,G,13.6,1.0,H,12.4,12.4,20.0,1.0,I,5.0,...,#",
     "device_type": "CPAP",
     "device_id": "24"
   }
   ```
4. Expect `200 OK` with success response.
5. For IoT-style payloads, POST to `/api/iot/webhook` with identical JSON plus the `topic` field (e.g., `esp32/data24`).

### OC API Testing

**Test Mobile Request:**
```bash
POST https://backend-production-9c17.up.railway.app/api/oc/data
Content-Type: application/json

{
  "device_status": 1,
  "device_data": 2,
  "device_id": "12345678"
}
```

**Test Machine Acknowledgement:**
```bash
POST https://backend-production-9c17.up.railway.app/api/oc/data
Content-Type: application/json

{
  "device_status": 0,
  "device_data": 2,
  "device_id": "12345678"
}
```

**Test Data Storage:**
```bash
POST https://backend-production-9c17.up.railway.app/api/oc/data
Content-Type: application/json

{
  "device_data": "ON, OK",
  "device_id": "12345678"
}
```

**Get OC Data History:**
```bash
GET https://backend-production-9c17.up.railway.app/api/oc/data/12345678?limit=10&source=mobile
```

**Get Latest OC Data:**
```bash
GET https://backend-production-9c17.up.railway.app/api/oc/data/12345678/latest
```

### Success Indicators
- `200 OK` and `success: true` in the response body
- `config_update.available`/`published` flags indicate pending device config (CPAP/BIPAP)
- If the server responds with `503 Database unavailable`, verify MongoDB connectivity

## IoT Rule & Webhook
AWS IoT Core rules forward device MQTT data to the webhook. Use the following SQL + template in your rule:
```sql
SELECT
  device_status,
  device_data,
  device_type,
  device_id,
  topic() AS topic
FROM 'esp32/+'
```
Payload template:
```json
{
  "device_status": ${device_status},
  "device_data": "${device_data}",
  "device_type": "${device_type}",
  "device_id": "${device_id}",
  "topic": "${topic()}"
}
```
Ensure the HTTP action posts to `https://backend-production-9c17.up.railway.app/api/iot/webhook` with `Content-Type: application/json`.

## Troubleshooting & Verification
1. **Check Railway Logs:** Look for requests with `[req_...] 📥 Received IoT data request`, `📦 Raw payload received`, and `💾 Attempting to save data for device:`. If logs are absent, the rule isn’t forwarding data.
2. **Verify Payload Format:** Ensure every required field (`device_status`, `device_data`, `device_type`, `device_id`, `topic`) is present. Trim extra spaces inside `device_data`.
3. **Rule Configuration:** Confirm the SQL matches your topic (e.g., `esp32/data24` matches `esp32/+`). Ensure the HTTP method is POST and the endpoint URL is correct.
4. **Test Webhook Directly:** Use curl to POST a payload to `/api/iot/webhook` (see Postman section). A `success: true` response proves the webhook works even without AWS.
5. **MongoDB Connection:** Verify the `MONGODB_URI` environment variable in Railway and that Atlas network access allows Railway (0.0.0.0/0). Look for MongoDB errors like `MongoDB not connected` in the logs.

**Quick Checklist:**
- [ ] Railway logs show incoming requests (`[req_...] 📥`).
- [ ] Rule metrics show executions and action successes.
- [ ] Rule SQL selects `device_status`, `device_data`, `device_type`, `device_id`, `topic()`.
- [ ] Rule action URL is `https://backend-production-9c17.up.railway.app/api/iot/webhook` with POST.
- [ ] Webhook tests (curl/Postman) return `success: true`.
- [ ] MongoDB URI is configured, and Atlas allows the Railways IP.
- [ ] Payload includes all required fields and formats `device_data` correctly.

## Common Errors

### CPAP/BIPAP API
- `400 device_status is required`: Add `device_status` (0 or 1).
- `400 device_data is required`: Provide the raw CPAP/BIPAP string (starts with `*,` and ends with `,#`).
- `400 device_type is required and must be CPAP or BIPAP`: Supply a valid type.
- `400 Failed to parse device data`: Check `device_data` formatting and remove stray spaces.

### OC API
- `400 device_id is required`: Provide `device_id` in the request body.
- `400 device_data is required`: Provide `device_data` (number 0-3 for realtime, or string for storage).
- `400 device_status must be 0 (acknowledgement) or 1 (request)`: Use valid status values.
- `400 device_data must be 0, 1, 2, or 3 for realtime communication`: Use valid numeric codes.
- `400 device_data must be a string for data storage format`: Use string format like "power_status, alm_status".

### General
- `503 Database unavailable`: MongoDB is unreachable—check `MONGODB_URI` and Atlas network access.

## Data Validation

### CPAP/BIPAP Data
- `GET https://backend-production-9c17.up.railway.app/api/devices/:deviceId/data?limit=5`
- Optional query `data_source=cloud` or `data_source=software` filters the results.

### OC Data
- `GET https://backend-production-9c17.up.railway.app/api/oc/data/:deviceId?limit=10`
- Optional queries: `source=mobile|machine|direct`, `device_status=0|1`

### Via MongoDB Atlas
1. Open Atlas → Database → Collections.
2. Check collections:
   - `devicedatas` - CPAP/BIPAP device data
   - `ecgdatas` - ECG records
   - `ocdatas` - OC device data
3. Filter by `device_id`, `data_source`/`source`, and `timestamp` to confirm new records appear.

## Archived Guides
All legacy `.md` guides (Postman testing notes, IoT setup, troubleshooting steps, etc.) have been relocated to `archived_markdown/` as `.txt` files so that this README remains the single Markdown source. Refer to that directory if you need historic context or additional examples.
