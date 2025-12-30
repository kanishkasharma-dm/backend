# Current Architecture Summary

## Overview
Your backend is a **monolithic Express.js application** deployed on **Railway** that handles medical device data (CPAP/BIPAP, ECG, OC devices).

## Current Stack

### 1. **Application Server**
- **Framework**: Express.js (Node.js)
- **Hosting**: Railway (PaaS - Platform as a Service)
- **Port**: 3000 (configurable via `PORT` env var)
- **Deployment**: Railway automatically builds and deploys from your repo

### 2. **Database**
- **Type**: MongoDB
- **Hosting**: MongoDB Atlas (cloud-hosted)
- **Connection**: Via `MONGODB_URI` environment variable
- **Collections**:
  - `devicedatas` - CPAP/BIPAP device telemetry
  - `deviceconfigs` - Device configuration settings
  - `ecgdatas` - ECG records with S3 file references
  - `ocdatas` - Oxygen Concentrator data

### 3. **AWS Services Integration**
- **AWS IoT Core**: 
  - Receives MQTT messages from ESP32 devices
  - Routes messages via IoT Rules to your webhook endpoint
  - Publishes configuration updates back to devices
- **AWS S3**: 
  - Stores ECG PDF and JSON files
  - Generates presigned URLs for secure file access

## Data Flow

### Device Data Flow (CPAP/BIPAP)
```
ESP32 Device
    │
    │ MQTT
    ▼
AWS IoT Core (Rule: esp32/+)
    │
    │ HTTP POST
    ▼
Railway Express Server (/api/iot/webhook)
    │
    ├──► Parse & Validate Data
    ├──► Save to MongoDB (devicedatas collection)
    └──► Check for pending config updates
        │
        └──► If available, publish to AWS IoT Core
            │
            └──► Device receives config via MQTT
```

### ECG Data Flow
```
ECG Device/App
    │
    │ HTTP POST (JSON + Base64 PDF)
    ▼
Railway Express Server (/api/ecg/data)
    │
    ├──► Decode Base64 PDF
    ├──► Upload PDF to AWS S3
    ├──► Upload JSON to AWS S3
    └──► Save metadata to MongoDB (ecgdatas collection)
```

### OC (Oxygen Concentrator) Data Flow
```
Mobile App / Machine
    │
    │ HTTP POST
    ▼
Railway Express Server (/api/oc/data)
    │
    ├──► Determine source (mobile/machine/direct)
    ├──► Parse device_data (realtime or storage format)
    └──► Save to MongoDB (ocdatas collection)
```

## API Structure

### Express Application (`server.js`)
- **Entry Point**: `server.js`
- **Routes**: Modular route files in `/routes`
- **Controllers**: Business logic in `/controllers`
- **Models**: Mongoose schemas in `/models`
- **Config**: Database and AWS clients in `/config`

### Route Organization
```
/api/devices/*     → Device routes (deviceRoutes.js)
/api/iot/*         → IoT webhook routes (iotRoutes.js)
/api/ecg/*         → ECG routes (ecgRoutes.js)
/api/oc/*          → OC routes (ocRoutes.js)
/health            → Health check endpoint
/                  → API information endpoint
```

## Key Features

### 1. **Device Configuration Management**
- Mobile app sets device config → Saved to MongoDB
- Device polls for config → Returns pending config
- Device applies config → Marks as delivered
- Config published to AWS IoT Core for real-time updates

### 2. **Data Parsing**
- CPAP/BIPAP data comes as comma-separated strings
- Parsed into structured fields (pressure, humidity, etc.)
- Stored with metadata (device_id, timestamp, source)

### 3. **File Storage (ECG)**
- PDF files stored in S3
- JSON data stored in S3
- MongoDB stores S3 keys and metadata
- Presigned URLs generated for secure access

### 4. **Realtime Communication (OC)**
- Mobile app sends commands (device_status: 1)
- Machine acknowledges (device_status: 0)
- Bidirectional communication via HTTP

## Environment Variables

Required in `.env` or Railway environment:
```env
PORT=3000
NODE_ENV=production
MONGODB_URI=mongodb+srv://...
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_IOT_ENDPOINT=xxxxxx-ats.iot.us-east-1.amazonaws.com
```

## Current Deployment (Railway)

### How Railway Works
1. **Git Integration**: Connects to your GitHub repo
2. **Auto-build**: Detects Node.js project, runs `npm install`
3. **Auto-deploy**: Runs `npm start` (from `package.json`)
4. **Scaling**: Manual or auto-scaling based on traffic
5. **Logs**: Available in Railway dashboard

### Railway Configuration
- **Build**: NIXPACKS (auto-detected)
- **Start Command**: `npm start` (from `railway.json`)
- **Restart Policy**: ON_FAILURE (max 10 retries)

## Limitations of Current Architecture

1. **Cost**: Fixed monthly cost even with low traffic
2. **Scaling**: Manual scaling or pay for always-on resources
3. **Cold Starts**: N/A (server always running)
4. **Server Management**: Railway handles it, but still a server
5. **Regional Deployment**: Single region (Railway's choice)

## Why Go Serverless?

### Benefits
- ✅ **Pay-per-request**: Only pay for actual usage
- ✅ **Auto-scaling**: Handles traffic spikes automatically
- ✅ **No server management**: Fully managed by AWS
- ✅ **Better cost efficiency**: For variable/intermittent traffic
- ✅ **Global deployment**: Deploy to multiple regions easily

### Trade-offs
- ⚠️ **Cold starts**: First request after idle period may be slower
- ⚠️ **Execution limits**: 15-minute max execution time
- ⚠️ **Connection pooling**: Requires careful MongoDB connection handling
- ⚠️ **Learning curve**: Different deployment model

## Migration Path

See `SERVERLESS_MIGRATION_GUIDE.md` for detailed migration steps.

**Quick Summary:**
1. Convert Express routes → Lambda functions
2. Use API Gateway for HTTP routing
3. Implement MongoDB connection caching
4. Deploy using Serverless Framework or AWS SAM
5. Update AWS IoT Rule webhook URL

---

## Current Production URL
Based on your README: `https://backend-production-9c17.up.railway.app`

## Next Steps
1. Review `SERVERLESS_MIGRATION_GUIDE.md` for detailed migration plan
2. Decide on serverless approach (Lambda recommended)
3. Set up AWS account and credentials
4. Start migration with one endpoint as proof of concept

