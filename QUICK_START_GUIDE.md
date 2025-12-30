# Quick Start Guide - Backend Development

## For New Team Members

---

## Current Architecture Overview

```
┌─────────────┐
│   ESP32     │ (CPAP/BIPAP Devices)
│   Devices   │
└──────┬──────┘
       │ MQTT
       ▼
┌─────────────────┐
│  AWS IoT Core   │
│  (Rule Engine)  │
└──────┬──────────┘
       │ HTTP POST
       ▼
┌─────────────────────────┐
│  Express.js Backend     │ (Railway)
│  ┌───────────────────┐  │
│  │  Controllers      │  │
│  │  Routes           │  │
│  │  Models           │  │
│  │  Middleware       │  │
│  └───────────────────┘  │
└──────┬──────────────────┘
       │
       ├──► MongoDB Atlas (Time-series data)
       │
       ├──► AWS S3 (ECG files)
       │
       └──► AWS IoT Core (Config updates)
```

---

## Current File Structure

```
backend/
├── server.js                 # Main Express app entry point
├── package.json              # Dependencies
│
├── config/
│   ├── database.js           # MongoDB connection
│   ├── awsIoT.js            # AWS IoT Core client
│   └── awsS3.js             # AWS S3 client
│
├── controllers/
│   ├── deviceController.js   # Device data & config
│   ├── iotController.js      # IoT webhook handler
│   ├── ecgController.js      # ECG data handler
│   └── ocController.js       # OC data handler
│
├── models/
│   ├── DeviceData.js         # CPAP/BIPAP data schema
│   ├── DeviceConfig.js       # Device config schema
│   ├── ECGData.js            # ECG data schema
│   └── OCData.js             # OC data schema
│
├── routes/
│   ├── deviceRoutes.js       # Device API routes
│   ├── iotRoutes.js          # IoT webhook routes
│   ├── ecgRoutes.js          # ECG API routes
│   └── ocRoutes.js           # OC API routes
│
└── utils/
    └── dataParser.js         # CPAP/BIPAP string parser
```

---

## Key Endpoints (Current)

### IoT Data Ingestion
```
POST /api/iot/webhook
Body: {
  "device_status": 1,
  "device_data": "*,S,261225,1103,S_MODE,A,11.0,1.0,..."
}
```

### Device Configuration
```
GET  /api/devices/:deviceId/config
POST /api/devices/:deviceId/config
POST /api/devices/:deviceId/config/delivered
```

### ECG Data
```
POST /api/ecg/data
GET  /api/ecg/data
GET  /api/ecg/data/:recordId
```

### OC Data
```
POST /api/oc/data
GET  /api/oc/data/:deviceId
GET  /api/oc/data/:deviceId/latest
```

---

## Data String Formats

### CPAP (VT30) Format
```
*,S,261225,1103,AUTOMODE,
G,11.0,1.0,
H,17.0,17.0,14.4,1.0,
I,45.0,2.0,1.0,0.0,0.0,1.0,0.0,
12345678C,#
```

**Sections:**
- `G` = CPAP mode (pressure settings)
- `H` = AUTO mode (pressure range)
- `I` = Common settings (humidity, tube, etc.)

### BIPAP (VT60) Format
```
*,S,261225,1103,S_MODE,
A,11.0,1.0,
B,16.8,15.8,9.0,11.0,2.0,4.0,6.0,1.0,
C,7.2,4.0,4.0,17.0,10.0,20.0,0.0,200.0,1.0,
D,30.0,15.0,7.8,21.0,3.0,4.0,6.0,8.0,1.0,
E,20.0,11.2,5.0,10.0,70.0,20.0,1.0,200.0,1.0,171.0,500.0,
F,45.0,2.0,1.0,0.0,0.0,1.0,0.0,
12345678B,#
```

**Sections:**
- `A` = CPAP mode
- `B` = S Mode
- `C` = T Mode
- `D` = ST Mode
- `E` = VAPS
- `F` = Common settings

---

## What Needs to Be Built

### 1. Authentication System (Week 1)
- JWT token-based authentication
- Role-based access control (Patient, Doctor, Admin)
- User management endpoints
- Session management

### 2. Enhanced Validation (Week 2)
- **Stage 1**: Client-level validation (start/end markers, field count)
- **Stage 2**: Backend ingress validation (format, mode, ranges)
- **Stage 3**: Parsing & normalization (versioned parsers)
- Corruption handling & marking

### 3. Admin Read APIs (Week 2-3)
```
GET /api/admin/device-data?
  device_id=24
  &from=2025-01-20T00:00:00Z
  &to=2025-01-20T23:59:59Z

GET /api/admin/device-data?
  device_id=24
  &latest=true
```

### 4. Conflict Resolution (Week 3)
- Admin override system
- Timestamp-based resolution
- Device parameter protection

### 5. Database Architecture (Week 2-4)
- SQL database for Users, Devices, Sessions
- MongoDB optimization (indexes, time-series)
- Data synchronization

### 6. Error Handling (Week 4)
- Retry logic with exponential backoff
- Dead Letter Queue (DLQ)
- Timeout handling
- Idempotency keys

### 7. Caching (Week 3)
- Redis cache for read operations
- Cache invalidation strategy
- Fallback to MongoDB

### 8. Offline Mode (Week 5)
- Sync status tracking
- Duplicate detection
- Queue processing

---

## Development Setup

### Prerequisites
```bash
Node.js >= 18.x
npm or yarn
MongoDB Atlas account
AWS account (IoT Core, S3)
```

### Installation
```bash
cd backend
npm install
```

### Environment Variables
Create `.env` file:
```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb+srv://...
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_IOT_ENDPOINT=xxxxxx-ats.iot.us-east-1.amazonaws.com
```

### Run Development Server
```bash
npm run dev
```

### Run Production Server
```bash
npm start
```

---

## Code Style Guidelines

### File Naming
- Controllers: `*Controller.js`
- Models: `*Model.js` or `*Data.js`
- Routes: `*Routes.js`
- Middleware: `*Middleware.js` or `*Auth.js`
- Services: `*Service.js`
- Utils: `*Utils.js` or `*Parser.js`

### Function Naming
- Controllers: `camelCase` (e.g., `receiveIoTData`)
- Routes: RESTful (e.g., `GET /api/devices/:id`)
- Models: PascalCase (e.g., `DeviceData`)

### Error Handling
```javascript
try {
  // code
} catch (error) {
  console.error('Error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
}
```

### Response Format
```javascript
// Success
{
  success: true,
  message: 'Operation successful',
  data: { ... }
}

// Error
{
  success: false,
  message: 'Error description',
  error: 'Detailed error (dev only)'
}
```

---

## Testing Strategy

### Unit Tests
- Test individual functions
- Mock external dependencies
- Test edge cases

### Integration Tests
- Test API endpoints
- Test database operations
- Test AWS integrations

### Test Commands
```bash
npm test              # Run all tests
npm test -- --watch   # Watch mode
npm test -- --coverage # Coverage report
```

---

## Git Workflow

### Branch Naming
- `feature/authentication` - New features
- `fix/validation-bug` - Bug fixes
- `refactor/parser` - Code refactoring
- `docs/api-docs` - Documentation

### Commit Messages
```
feat: Add JWT authentication
fix: Fix data parsing for VT30
refactor: Improve error handling
docs: Update API documentation
test: Add unit tests for parser
```

### Pull Request Process
1. Create feature branch
2. Make changes
3. Write tests
4. Update documentation
5. Create PR
6. Code review
7. Merge to main

---

## Common Tasks

### Adding a New Endpoint
1. Create controller function in `controllers/`
2. Create route in `routes/`
3. Add route to `server.js`
4. Write tests
5. Update documentation

### Adding a New Model
1. Create schema in `models/`
2. Add indexes if needed
3. Create controller functions
4. Create routes
5. Write tests

### Adding Validation
1. Add validation middleware
2. Create validator function
3. Add to route
4. Test validation cases

---

## Debugging Tips

### MongoDB Connection Issues
```javascript
// Check connection state
console.log('MongoDB state:', mongoose.connection.readyState);
// 0 = disconnected
// 1 = connected
// 2 = connecting
// 3 = disconnecting
```

### AWS IoT Issues
- Check AWS credentials
- Verify IoT endpoint
- Check topic permissions
- Review IoT Rule SQL

### Data Parsing Issues
- Log raw data string
- Check parser version
- Verify data format
- Test with sample strings

---

## Useful Commands

```bash
# Start development server
npm run dev

# Run tests
npm test

# Check code style
npm run lint

# Build for production
npm run build

# View logs (Railway)
railway logs

# Deploy (Railway)
git push origin main
```

---

## Resources

### Documentation
- [Express.js Docs](https://expressjs.com/)
- [Mongoose Docs](https://mongoosejs.com/)
- [AWS IoT Core Docs](https://docs.aws.amazon.com/iot/)
- [JWT Guide](https://jwt.io/)

### Architecture Documents
- `ARCHITECTURE_SUMMARY.md` - Current architecture
- `BACKEND_DEVELOPMENT_PLAN.md` - Development plan
- `TASK_CHECKLIST.md` - Task tracking

---

## Getting Help

### Questions?
1. Check documentation first
2. Review existing code
3. Ask teammate
4. Check GitHub issues
5. Review architecture docs

### Blockers?
- Document the issue
- Create GitHub issue
- Discuss in standup
- Ask for help early

---

**Last Updated**: [Date]  
**Version**: 1.0.0

