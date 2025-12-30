# Serverless Migration Guide

## Current Architecture Overview

### Technology Stack
- **Runtime**: Node.js (Express.js)
- **Hosting**: Railway (Platform-as-a-Service)
- **Database**: MongoDB Atlas (Cloud-hosted)
- **Cloud Services**: 
  - AWS IoT Core (MQTT message routing)
  - AWS S3 (ECG file storage)
- **API Framework**: Express.js REST API

### Current Architecture Diagram
```
┌─────────────┐
│   Devices   │ (CPAP/BIPAP/ECG/OC)
│  (ESP32)    │
└──────┬──────┘
       │ MQTT
       ▼
┌─────────────────┐
│  AWS IoT Core   │
│  (Rule Engine)  │
└──────┬──────────┘
       │ HTTP POST
       ▼
┌─────────────────────────────────┐
│   Railway (Express Server)      │
│   ┌───────────────────────────┐ │
│   │  Express.js Application   │ │
│   │  - Routes                 │ │
│   │  - Controllers            │ │
│   │  - Middleware             │ │
│   └───────────────────────────┘ │
└──────┬──────────────────────────┘
       │
       ├──► MongoDB Atlas (Data Storage)
       │
       ├──► AWS S3 (ECG Files)
       │
       └──► AWS IoT Core (Config Updates)
```

### Current API Endpoints

#### Device API (`/api/devices`)
- `POST /api/devices/data` - Receive device data
- `GET /api/devices/:deviceId/config` - Get device config
- `POST /api/devices/:deviceId/config` - Set device config
- `POST /api/devices/:deviceId/config/delivered` - Mark config delivered
- `GET /api/devices/:deviceId/data` - Get device history

#### IoT API (`/api/iot`)
- `GET /api/iot/webhook` - AWS IoT destination confirmation
- `POST /api/iot/webhook` - Receive IoT data from AWS

#### ECG API (`/api/ecg`)
- `POST /api/ecg/data` - Receive ECG data (JSON + PDF)
- `GET /api/ecg/data` - Get ECG records
- `GET /api/ecg/data/:recordId` - Get single record
- `POST /api/ecg/data/:recordId/presigned-urls` - Get S3 presigned URLs

#### OC API (`/api/oc`)
- `POST /api/oc/data` - Receive OC data
- `GET /api/oc/data/:deviceId` - Get OC history
- `GET /api/oc/data/:deviceId/latest` - Get latest OC data
- `PUT /api/oc/data/:deviceId` - Update OC data

### Current File Structure
```
backend/
├── server.js              # Express app entry point
├── config/
│   ├── database.js        # MongoDB connection
│   ├── awsIoT.js          # AWS IoT Core client
│   └── awsS3.js           # AWS S3 client
├── controllers/           # Business logic
│   ├── deviceController.js
│   ├── iotController.js
│   ├── ecgController.js
│   └── ocController.js
├── routes/                # Express routes
│   ├── deviceRoutes.js
│   ├── iotRoutes.js
│   ├── ecgRoutes.js
│   └── ocRoutes.js
├── models/                # Mongoose models
│   ├── DeviceData.js
│   ├── DeviceConfig.js
│   ├── ECGData.js
│   └── OCData.js
└── utils/
    └── dataParser.js      # Data parsing utilities
```

---

## Serverless Architecture Options

### Option 1: AWS Lambda + API Gateway (Recommended)

**Architecture:**
```
┌─────────────┐
│   Devices   │
└──────┬──────┘
       │ MQTT
       ▼
┌─────────────────┐
│  AWS IoT Core   │
└──────┬──────────┘
       │ HTTP POST
       ▼
┌─────────────────────────────────┐
│      API Gateway                │
│  (REST API / HTTP API)          │
└──────┬──────────────────────────┘
       │
       ├──► Lambda Function (Device API)
       ├──► Lambda Function (IoT Webhook)
       ├──► Lambda Function (ECG API)
       └──► Lambda Function (OC API)
       │
       ▼
┌─────────────────────────────────┐
│   Lambda Functions               │
│   ┌───────────────────────────┐ │
│   │  Shared Layer             │ │
│   │  - Database connection    │ │
│   │  - AWS SDK clients        │ │
│   │  - Models                 │ │
│   │  - Utils                  │ │
│   └───────────────────────────┘ │
└──────┬──────────────────────────┘
       │
       ├──► MongoDB Atlas
       ├──► AWS S3
       └──► AWS IoT Core
```

**Pros:**
- Pay-per-request pricing (cost-effective for variable traffic)
- Auto-scaling (handles traffic spikes automatically)
- No server management
- Integrated with AWS services (IoT Core, S3)
- High availability built-in

**Cons:**
- Cold start latency (first request after idle period)
- 15-minute execution time limit
- Connection pooling requires careful handling
- More complex deployment setup

### Option 2: AWS App Runner

**Architecture:**
Similar to current Railway setup but AWS-managed.

**Pros:**
- Minimal code changes (container-based)
- Auto-scaling
- Simpler than Lambda for Express apps

**Cons:**
- More expensive than Lambda
- Still requires container management
- Less "serverless" than Lambda

### Option 3: Vercel / Netlify Functions

**Pros:**
- Easy deployment
- Good for frontend + backend combo

**Cons:**
- Less control over infrastructure
- May not support all AWS integrations easily
- Function timeout limits

---

## Migration Plan: AWS Lambda + API Gateway

### Step 1: Project Structure for Serverless

Create new structure:
```
backend/
├── serverless.yml              # Serverless Framework config
├── handler.js                  # Lambda entry point (optional)
├── lambda/                     # Lambda functions
│   ├── devices/
│   │   ├── handler.js          # Device API handler
│   │   └── index.js
│   ├── iot/
│   │   ├── handler.js          # IoT webhook handler
│   │   └── index.js
│   ├── ecg/
│   │   ├── handler.js          # ECG API handler
│   │   └── index.js
│   └── oc/
│       ├── handler.js          # OC API handler
│       └── index.js
├── shared/                     # Shared code (Lambda Layer)
│   ├── config/
│   │   ├── database.js
│   │   ├── awsIoT.js
│   │   └── awsS3.js
│   ├── models/
│   │   ├── DeviceData.js
│   │   ├── DeviceConfig.js
│   │   ├── ECGData.js
│   │   └── OCData.js
│   └── utils/
│       └── dataParser.js
└── package.json
```

### Step 2: Convert Express Routes to Lambda Handlers

#### Example: Device API Lambda Handler

**Before (Express):**
```javascript
// routes/deviceRoutes.js
router.post('/data', receiveDeviceData);

// controllers/deviceController.js
export const receiveDeviceData = async (req, res) => {
  // ... logic
  res.json({ success: true });
};
```

**After (Lambda):**
```javascript
// lambda/devices/handler.js
import { receiveDeviceData } from '../../controllers/deviceController.js';

export const handler = async (event) => {
  // Convert API Gateway event to Express-like request
  const req = {
    body: JSON.parse(event.body || '{}'),
    params: event.pathParameters || {},
    query: event.queryStringParameters || {},
  };
  
  // Call controller (returns data instead of sending response)
  const result = await receiveDeviceData(req);
  
  // Return Lambda response format
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(result),
  };
};
```

### Step 3: Database Connection Handling

**Challenge:** Lambda functions are stateless. Need connection pooling strategy.

**Solution:** Use MongoDB connection caching with singleton pattern:

```javascript
// shared/config/database.js
import mongoose from 'mongoose';

let cachedConnection = null;

export const connectDB = async () => {
  // Reuse existing connection if available
  if (cachedConnection) {
    return cachedConnection;
  }

  // Create new connection
  const mongoUri = process.env.MONGODB_URI;
  cachedConnection = await mongoose.connect(mongoUri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  return cachedConnection;
};
```

### Step 4: Serverless Framework Configuration

Create `serverless.yml`:

```yaml
service: medical-device-api

frameworkVersion: '3'

provider:
  name: aws
  runtime: nodejs18.x
  region: us-east-1
  environment:
    MONGODB_URI: ${env:MONGODB_URI}
    AWS_REGION: ${env:AWS_REGION}
    AWS_IOT_ENDPOINT: ${env:AWS_IOT_ENDPOINT}
    AWS_ACCESS_KEY_ID: ${env:AWS_ACCESS_KEY_ID}
    AWS_SECRET_ACCESS_KEY: ${env:AWS_SECRET_ACCESS_KEY}
  iam:
    role:
      statements:
        - Effect: Allow
          Action:
            - iot:Publish
            - iot:Connect
            - s3:PutObject
            - s3:GetObject
            - s3:DeleteObject
          Resource: '*'

functions:
  # Device API
  receiveDeviceData:
    handler: lambda/devices/handler.receiveDeviceData
    events:
      - http:
          path: /api/devices/data
          method: post
          cors: true
  
  getDeviceConfig:
    handler: lambda/devices/handler.getDeviceConfig
    events:
      - http:
          path: /api/devices/{deviceId}/config
          method: get
          cors: true
  
  setDeviceConfig:
    handler: lambda/devices/handler.setDeviceConfig
    events:
      - http:
          path: /api/devices/{deviceId}/config
          method: post
          cors: true
  
  markConfigDelivered:
    handler: lambda/devices/handler.markConfigDelivered
    events:
      - http:
          path: /api/devices/{deviceId}/config/delivered
          method: post
          cors: true
  
  getDeviceDataHistory:
    handler: lambda/devices/handler.getDeviceDataHistory
    events:
      - http:
          path: /api/devices/{deviceId}/data
          method: get
          cors: true

  # IoT Webhook
  iotWebhook:
    handler: lambda/iot/handler.iotWebhook
    events:
      - http:
          path: /api/iot/webhook
          method: get
          cors: true
      - http:
          path: /api/iot/webhook
          method: post
          cors: true
    timeout: 30

  # ECG API
  receiveECGData:
    handler: lambda/ecg/handler.receiveECGData
    events:
      - http:
          path: /api/ecg/data
          method: post
          cors: true
    timeout: 60  # Longer timeout for file uploads
  
  getECGData:
    handler: lambda/ecg/handler.getECGData
    events:
      - http:
          path: /api/ecg/data
          method: get
          cors: true
  
  getECGDataById:
    handler: lambda/ecg/handler.getECGDataById
    events:
      - http:
          path: /api/ecg/data/{recordId}
          method: get
          cors: true
  
  getPresignedURLs:
    handler: lambda/ecg/handler.getPresignedURLs
    events:
      - http:
          path: /api/ecg/data/{recordId}/presigned-urls
          method: post
          cors: true

  # OC API
  receiveOCData:
    handler: lambda/oc/handler.receiveOCData
    events:
      - http:
          path: /api/oc/data
          method: post
          cors: true
  
  getOCDataHistory:
    handler: lambda/oc/handler.getOCDataHistory
    events:
      - http:
          path: /api/oc/data/{deviceId}
          method: get
          cors: true
  
  getLatestOCData:
    handler: lambda/oc/handler.getLatestOCData
    events:
      - http:
          path: /api/oc/data/{deviceId}/latest
          method: get
          cors: true
  
  updateOCData:
    handler: lambda/oc/handler.updateOCData
    events:
      - http:
          path: /api/oc/data/{deviceId}
          method: put
          cors: true

  # Health check
  health:
    handler: lambda/health/handler.health
    events:
      - http:
          path: /health
          method: get
          cors: true

plugins:
  - serverless-offline  # For local development

package:
  patterns:
    - '!node_modules/**'
    - '!*.md'
    - '!*.txt'
    - '!archived_markdown/**'
```

### Step 5: Update Controllers for Lambda

Controllers need to return data instead of sending responses:

```javascript
// Before (Express)
export const receiveDeviceData = async (req, res) => {
  try {
    const data = await saveDeviceData(req.body);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// After (Lambda-compatible)
export const receiveDeviceData = async (req) => {
  try {
    const data = await saveDeviceData(req.body);
    return { success: true, data };
  } catch (error) {
    throw {
      statusCode: 500,
      message: error.message,
      body: { success: false, error: error.message },
    };
  }
};
```

### Step 6: Deployment Steps

1. **Install Serverless Framework:**
```bash
npm install -g serverless
npm install --save-dev serverless-offline
```

2. **Configure AWS Credentials:**
```bash
aws configure
# Or set environment variables:
# AWS_ACCESS_KEY_ID
# AWS_SECRET_ACCESS_KEY
```

3. **Deploy:**
```bash
serverless deploy
```

4. **Update AWS IoT Rule:**
   - Change webhook URL to API Gateway endpoint
   - Format: `https://{api-id}.execute-api.{region}.amazonaws.com/{stage}/api/iot/webhook`

### Step 7: Environment Variables

Set in `serverless.yml` or AWS Systems Manager Parameter Store:

```yaml
provider:
  environment:
    MONGODB_URI: ${ssm:/medical-device-api/mongodb-uri}
    AWS_REGION: us-east-1
    # ... other vars
```

Or use AWS Secrets Manager for sensitive data.

---

## Alternative: Use AWS SAM (Serverless Application Model)

If you prefer AWS-native tooling:

### `template.yaml` (SAM Template)
```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Resources:
  DeviceDataFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: lambda/devices/handler.receiveDeviceData
      Runtime: nodejs18.x
      Events:
        DeviceDataApi:
          Type: Api
          Properties:
            Path: /api/devices/data
            Method: post
      Environment:
        Variables:
          MONGODB_URI: !Ref MongoDBUri
```

---

## Cost Comparison

### Current (Railway)
- **Fixed cost**: ~$5-20/month (depending on plan)
- **Scaling**: Manual or auto-scaling with higher costs

### Serverless (Lambda)
- **Free tier**: 1M requests/month free
- **After free tier**: $0.20 per 1M requests
- **Compute**: $0.0000166667 per GB-second
- **API Gateway**: $3.50 per 1M requests (after free tier)

**Example monthly cost (100K requests):**
- Lambda: ~$0.02
- API Gateway: ~$0.35
- **Total**: ~$0.37/month (vs $5-20 on Railway)

---

## Migration Checklist

- [ ] Install Serverless Framework
- [ ] Create Lambda function structure
- [ ] Convert Express routes to Lambda handlers
- [ ] Update controllers to return data (not send responses)
- [ ] Implement MongoDB connection caching
- [ ] Create `serverless.yml` configuration
- [ ] Test locally with `serverless offline`
- [ ] Deploy to AWS (staging first)
- [ ] Update AWS IoT Rule webhook URL
- [ ] Test all endpoints
- [ ] Monitor CloudWatch logs
- [ ] Set up CloudWatch alarms
- [ ] Update documentation
- [ ] Deploy to production
- [ ] Decommission Railway instance

---

## Next Steps

1. **Choose deployment tool**: Serverless Framework (easier) or AWS SAM (native)
2. **Set up AWS account** and configure credentials
3. **Create Lambda function structure** in your codebase
4. **Start with one endpoint** (e.g., health check) to test the setup
5. **Gradually migrate** other endpoints
6. **Test thoroughly** before switching production traffic

Would you like me to:
1. Create the actual Lambda handler code for your endpoints?
2. Set up the Serverless Framework configuration files?
3. Create a migration script to help convert your Express code?

