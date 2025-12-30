# Backend Development Plan & Action Plan

## Executive Summary
**Timeline**: 5-6 weeks  
**Team Size**: 2 developers  
**Goal**: Implement complete backend architecture per architecture specification

---

## Current State Assessment

### ✅ What's Already Done

1. **Basic Infrastructure**
   - ✅ Express.js server setup
   - ✅ MongoDB connection & models (DeviceData, DeviceConfig, ECGData, OCData)
   - ✅ AWS IoT Core integration (webhook endpoint)
   - ✅ AWS S3 integration (ECG file storage)
   - ✅ Basic data parsing (CPAP/BIPAP string parsing)
   - ✅ Device configuration management
   - ✅ Railway deployment setup

2. **API Endpoints (Basic)**
   - ✅ `/api/iot/webhook` - IoT data ingestion
   - ✅ `/api/devices/*` - Device config & data endpoints
   - ✅ `/api/ecg/data` - ECG data storage
   - ✅ `/api/oc/data` - OC data storage

3. **Data Flow**
   - ✅ ESP32 → AWS IoT → Backend → MongoDB (working)
   - ✅ Basic validation and parsing

### ❌ What Needs to Be Done

1. **Authentication & Authorization** (Critical - Week 1-2)
   - JWT/OAuth2 implementation
   - Role-based access control (Patient, Doctor, Admin)
   - User management system
   - Session management

2. **Enhanced Data Validation** (Critical - Week 2-3)
   - 3-stage validation (Client → Backend Ingress → Parsing)
   - Corruption handling & marking
   - Versioned parsers
   - Schema validation improvements

3. **Admin Read APIs** (High Priority - Week 3)
   - Date-based filtering endpoints
   - Latest data endpoints
   - MongoDB query optimization
   - Read cache (Redis) implementation

4. **Conflict Resolution** (High Priority - Week 3-4)
   - Admin override logic
   - Timestamp-based conflict resolution
   - Device parameter protection

5. **Database Architecture** (High Priority - Week 2-4)
   - SQL database setup (Users, Devices, Sessions, Metadata)
   - MongoDB optimization (indexes, time-series)
   - Data synchronization logic

6. **Error Handling & Resilience** (Medium Priority - Week 4-5)
   - Retry logic improvements
   - Dead Letter Queue (DLQ) support
   - Timeout handling
   - Idempotency keys

7. **Offline Mode Support** (Medium Priority - Week 5)
   - Mobile app queue simulation
   - Sync status tracking
   - Duplicate detection

8. **Testing & Documentation** (Ongoing - Week 1-6)
   - Unit tests
   - Integration tests
   - API documentation
   - Deployment guides

---

## Task Allocation (2-Person Team)

### Developer 1 (You) - Backend Core & Data Layer
**Focus**: Authentication, Validation, Database, Core Business Logic

### Developer 2 (Teammate) - API Layer & Integration
**Focus**: API Endpoints, AWS Integration, Caching, Error Handling

---

## Week-by-Week Breakdown

### **WEEK 1: Foundation & Authentication**

#### Developer 1 Tasks:
- [ ] **Day 1-2: Authentication System Setup**
  - Install JWT libraries (`jsonwebtoken`, `bcrypt`)
  - Create User model (MongoDB or SQL)
  - Create authentication middleware
  - Implement login endpoint (`POST /api/auth/login`)
  - Implement token refresh endpoint
  - Create password hashing utilities

- [ ] **Day 3-4: Role-Based Access Control (RBAC)**
  - Define roles: `patient`, `doctor`, `admin`
  - Create role middleware
  - Implement permission checks
  - Create user registration endpoint (admin-only)
  - Add role assignment logic

- [ ] **Day 5: User Management**
  - Create user CRUD endpoints (admin-only)
  - Implement user profile endpoints
  - Add user-device association logic
  - Create session management

**Deliverables:**
- ✅ Authentication system working
- ✅ RBAC middleware functional
- ✅ User management endpoints ready

#### Developer 2 Tasks:
- [ ] **Day 1-2: API Structure Refinement**
  - Review existing routes
  - Add authentication middleware to all routes
  - Create API versioning structure (`/api/v1/...`)
  - Set up request validation middleware
  - Create standardized error response format

- [ ] **Day 3-4: Admin Read API Foundation**
  - Design date-filtering query structure
  - Create MongoDB index strategy
  - Implement basic admin data fetch endpoint
  - Add query parameter validation
  - Create response pagination structure

- [ ] **Day 5: Documentation & Testing Setup**
  - Set up testing framework (Jest)
  - Create API documentation structure
  - Write basic integration tests for auth
  - Set up CI/CD pipeline basics

**Deliverables:**
- ✅ All routes protected with auth
- ✅ Admin read API structure ready
- ✅ Testing framework operational

---

### **WEEK 2: Enhanced Validation & Database Architecture**

#### Developer 1 Tasks:
- [ ] **Day 1-2: SQL Database Setup**
  - Choose SQL database (PostgreSQL recommended)
  - Set up database connection (Sequelize or Prisma)
  - Create Users table/model
  - Create Devices table/model
  - Create Sessions table/model
  - Create Metadata table/model
  - Set up migrations

- [ ] **Day 3-4: 3-Stage Validation System**
  - **Stage 1**: Client-level validation middleware
    - Start/end marker check (`*,` and `,#`)
    - Mandatory field count validation
    - Serial number presence check
  - **Stage 2**: Backend ingress validation
    - Exact API string format validation (VT30/VT60)
    - Mode validation (A-I mapping)
    - Numeric range checks
    - Mandatory field completeness
  - **Stage 3**: Parsing & normalization
    - Versioned parser system
    - Raw data storage (immutable)
    - Parsed data storage (separate)
  - Create validation error response format

- [ ] **Day 5: Corruption Handling**
  - Create `corrupted` flag in DeviceData model
  - Implement corruption marking logic
  - Create admin endpoint to view corrupted records
  - Add reprocessing capability
  - Create audit trail for corrupted data

**Deliverables:**
- ✅ SQL database operational
- ✅ 3-stage validation working
- ✅ Corruption handling implemented

#### Developer 2 Tasks:
- [ ] **Day 1-2: Enhanced Data Parser**
  - Refactor existing parser to support versioning
  - Create parser registry system
  - Add parser version to data model
  - Implement fallback parsing logic
  - Add parser validation tests

- [ ] **Day 3-4: Admin Read APIs Implementation**
  - Implement `GET /api/admin/device-data` with date filtering
  - Add `latest=true` parameter support
  - Implement MongoDB query optimization
  - Add response caching headers
  - Create admin dashboard data aggregation endpoints

- [ ] **Day 5: AWS Integration Improvements**
  - Review AWS IoT Rule configuration
  - Optimize webhook endpoint performance
  - Add AWS Lambda integration (optional)
  - Improve error handling for AWS services
  - Add AWS service health checks

**Deliverables:**
- ✅ Versioned parser system
- ✅ Admin read APIs functional
- ✅ AWS integration optimized

---

### **WEEK 3: Conflict Resolution & Admin Features**

#### Developer 1 Tasks:
- [ ] **Day 1-2: Conflict Resolution Logic**
  - Implement admin override system
  - Create timestamp-based conflict resolution
  - Add device parameter protection
  - Create conflict detection logic
  - Implement conflict resolution service

- [ ] **Day 3-4: Admin Override System**
  - Create admin configuration override endpoint
  - Implement "admin changes always win" logic
  - Add override audit trail
  - Create admin notification system
  - Add override history tracking

- [ ] **Day 5: Device Management**
  - Implement device registration (admin-only)
  - Create device serial number validation
  - Add device status tracking
  - Implement device deactivation
  - Create device-health monitoring

**Deliverables:**
- ✅ Conflict resolution working
- ✅ Admin override system functional
- ✅ Device management complete

#### Developer 2 Tasks:
- [ ] **Day 1-2: Read Cache Implementation (Redis)**
  - Set up Redis connection
  - Implement cache layer middleware
  - Create cache invalidation strategy
  - Add cache hit/miss logging
  - Implement fallback to MongoDB on cache miss

- [ ] **Day 3-4: Advanced Admin APIs**
  - Create device monitoring endpoints
  - Implement user-device management APIs
  - Add configuration control endpoints (admin-only)
  - Create data visualization data endpoints
  - Implement reporting APIs

- [ ] **Day 5: Performance Optimization**
  - Add database query optimization
  - Implement connection pooling
  - Add response compression
  - Optimize MongoDB indexes
  - Add performance monitoring

**Deliverables:**
- ✅ Redis cache operational
- ✅ Advanced admin APIs ready
- ✅ Performance optimized

---

### **WEEK 4: Error Handling & Resilience**

#### Developer 1 Tasks:
- [ ] **Day 1-2: Retry Logic & Timeout Handling**
  - Implement request-level timeout
  - Add idempotency key system
  - Create early rejection on validation failure
  - Implement exponential backoff retry
  - Add timeout configuration

- [ ] **Day 3-4: Dead Letter Queue (DLQ)**
  - Design DLQ architecture
  - Implement DLQ storage (MongoDB collection)
  - Create reprocessing Lambda/endpoint
  - Add DLQ monitoring
  - Create DLQ replay mechanism

- [ ] **Day 5: Failure Classification**
  - Implement failure classification matrix
  - Add error categorization (validation, infrastructure, etc.)
  - Create error response standardization
  - Add error logging and monitoring
  - Implement error alerting

**Deliverables:**
- ✅ Retry logic implemented
- ✅ DLQ system operational
- ✅ Error handling complete

#### Developer 2 Tasks:
- [ ] **Day 1-2: AWS IoT Rule Optimization**
  - Review and optimize IoT Rule SQL
  - Add Lambda integration (if needed)
  - Implement timeout-safe design
  - Add IoT Core error handling
  - Create IoT health monitoring

- [ ] **Day 3-4: Data Flow Improvements**
  - Optimize ESP32 → AWS IoT → Backend flow
  - Add message queuing (if needed)
  - Implement batch processing
  - Add data flow monitoring
  - Create data flow diagrams

- [ ] **Day 5: Integration Testing**
  - Create end-to-end test scenarios
  - Test complete data flow
  - Test error scenarios
  - Test retry mechanisms
  - Create integration test suite

**Deliverables:**
- ✅ AWS IoT optimized
- ✅ Data flow improved
- ✅ Integration tests complete

---

### **WEEK 5: Offline Mode & Final Features**

#### Developer 1 Tasks:
- [ ] **Day 1-2: Offline Mode Support (Backend)**
  - Create sync status tracking
  - Implement duplicate detection logic
  - Add session ID tracking
  - Create sync queue processing
  - Implement chronological sync order

- [ ] **Day 3-4: Mobile App Queue Simulation**
  - Create queue processing endpoint
  - Implement FIFO queue logic
  - Add sync status endpoints
  - Create queue monitoring
  - Add partial sync handling

- [ ] **Day 5: Data Integrity**
  - Implement data validation on sync
  - Add duplicate prevention
  - Create data consistency checks
  - Implement data reconciliation
  - Add integrity monitoring

**Deliverables:**
- ✅ Offline mode support ready
- ✅ Queue processing functional
- ✅ Data integrity ensured

#### Developer 2 Tasks:
- [ ] **Day 1-2: API Documentation**
  - Complete API documentation (Swagger/OpenAPI)
  - Document all endpoints
  - Add request/response examples
  - Create API usage guides
  - Document error codes

- [ ] **Day 3-4: Security Hardening**
  - Implement rate limiting
  - Add input sanitization
  - Implement CORS properly
  - Add security headers
  - Create security audit checklist

- [ ] **Day 5: Deployment Preparation**
  - Create deployment scripts
  - Set up environment variables
  - Create deployment documentation
  - Add health check endpoints
  - Prepare rollback procedures

**Deliverables:**
- ✅ API documentation complete
- ✅ Security hardened
- ✅ Deployment ready

---

### **WEEK 6: Testing, Bug Fixes & Final Polish**

#### Both Developers:
- [ ] **Day 1-2: Comprehensive Testing**
  - Unit tests for all services
  - Integration tests for all flows
  - Load testing
  - Security testing
  - Bug fixes

- [ ] **Day 3-4: Performance Tuning**
  - Database query optimization
  - Cache optimization
  - Response time optimization
  - Memory leak fixes
  - Connection pool tuning

- [ ] **Day 5: Final Review & Documentation**
  - Code review
  - Architecture review
  - Documentation finalization
  - Deployment guide
  - Handoff documentation

**Deliverables:**
- ✅ All tests passing
- ✅ Performance optimized
- ✅ Documentation complete
- ✅ Production ready

---

## Technical Implementation Details

### 1. Authentication & Authorization

```javascript
// Structure
middleware/
  - auth.js          // JWT verification
  - roles.js         // RBAC middleware
  - permissions.js   // Permission checks

models/
  - User.js          // User model (SQL or MongoDB)
  - Role.js          // Role definitions
  - Session.js       // Session tracking

controllers/
  - authController.js
  - userController.js

routes/
  - authRoutes.js
  - userRoutes.js
```

### 2. Validation System

```javascript
// Structure
middleware/
  - validation/
    - clientValidation.js    // Stage 1
    - ingressValidation.js   // Stage 2
    - parsingValidation.js   // Stage 3

utils/
  - validators/
    - cpapValidator.js
    - bipapValidator.js
    - ecgValidator.js

services/
  - validationService.js
  - corruptionService.js
```

### 3. Database Architecture

```
SQL Database (PostgreSQL):
- users
- devices
- sessions
- metadata

MongoDB:
- devicedatas (time-series)
- ecgdatas
- ocdatas
- corrupted_data (audit)
- dlq_messages
```

### 4. Admin Read APIs

```javascript
// Endpoints
GET /api/admin/device-data?
  device_id=24
  &from=2025-01-20T00:00:00Z
  &to=2025-01-20T23:59:59Z

GET /api/admin/device-data?
  device_id=24
  &latest=true

// With caching
GET /api/admin/device-data/:deviceId/summary
GET /api/admin/devices/status
```

### 5. Conflict Resolution

```javascript
// Service
services/
  - conflictResolutionService.js
  - adminOverrideService.js

// Logic
- Admin changes → timestamp + override flag
- User changes → timestamp only
- Resolution: Admin always wins
- Audit trail for all changes
```

---

## Dependencies to Add

```json
{
  "jsonwebtoken": "^9.0.0",
  "bcrypt": "^5.1.0",
  "express-validator": "^7.0.1",
  "redis": "^4.6.0",
  "ioredis": "^5.3.0",
  "joi": "^17.11.0",
  "helmet": "^7.1.0",
  "express-rate-limit": "^7.1.0",
  "compression": "^1.7.4",
  "pg": "^8.11.0",
  "sequelize": "^6.35.0"
}
```

---

## Success Criteria

### Week 1
- ✅ Users can login and receive JWT tokens
- ✅ Role-based access control working
- ✅ All existing endpoints protected

### Week 2
- ✅ 3-stage validation operational
- ✅ SQL database connected
- ✅ Corruption handling working

### Week 3
- ✅ Admin can override device configs
- ✅ Conflict resolution functional
- ✅ Redis cache operational

### Week 4
- ✅ Retry logic working
- ✅ DLQ system operational
- ✅ Error handling complete

### Week 5
- ✅ Offline sync support ready
- ✅ API documentation complete
- ✅ Security hardened

### Week 6
- ✅ All tests passing
- ✅ Performance optimized
- ✅ Production deployment ready

---

## Risk Mitigation

### High Risk Items
1. **Database Migration**: SQL + MongoDB dual setup
   - **Mitigation**: Start with MongoDB, add SQL gradually
   - **Fallback**: Use MongoDB for all if SQL setup fails

2. **Authentication Complexity**: RBAC implementation
   - **Mitigation**: Start simple, add roles incrementally
   - **Fallback**: Basic auth first, enhance later

3. **Performance**: Redis cache setup
   - **Mitigation**: Implement cache as optional first
   - **Fallback**: Direct MongoDB queries if cache fails

### Medium Risk Items
1. **AWS Integration**: Lambda + IoT complexity
   - **Mitigation**: Keep current Express setup, add Lambda later
   - **Fallback**: Express-only architecture

2. **Data Validation**: Complex parsing logic
   - **Mitigation**: Version parsers, keep old versions
   - **Fallback**: Basic validation, enhance incrementally

---

## Communication & Coordination

### Daily Standups (15 min)
- What did you complete yesterday?
- What are you working on today?
- Any blockers?

### Weekly Reviews (1 hour)
- Review completed tasks
- Plan next week
- Address blockers
- Code review session

### Tools
- **Project Management**: GitHub Projects / Jira
- **Communication**: Slack / Discord
- **Code Review**: GitHub PRs
- **Documentation**: Markdown files in repo

---

## Estimated Effort

| Task Category | Developer 1 | Developer 2 | Total Hours |
|--------------|-------------|-------------|-------------|
| Authentication & RBAC | 40h | 20h | 60h |
| Validation System | 30h | 20h | 50h |
| Database Setup | 30h | 10h | 40h |
| Admin APIs | 20h | 40h | 60h |
| Conflict Resolution | 30h | 10h | 40h |
| Error Handling | 20h | 30h | 50h |
| Offline Mode | 30h | 20h | 50h |
| Testing & Docs | 20h | 30h | 50h |
| **TOTAL** | **220h** | **180h** | **400h** |

**Per Developer**: ~20-25 hours/week × 6 weeks = 120-150 hours
**Team Total**: 240-300 hours available
**Buffer**: 100-160 hours for unexpected issues

---

## Next Steps (Immediate)

1. **Review this plan** with teammate
2. **Set up project board** (GitHub Projects)
3. **Create feature branches** for Week 1 tasks
4. **Install dependencies** for authentication
5. **Start Week 1 tasks** (Day 1)

---

## Notes

- This plan is flexible and can be adjusted based on progress
- Prioritize critical features (auth, validation) first
- Keep existing functionality working while adding new features
- Test incrementally, don't wait until the end
- Document as you go, not at the end

---

**Last Updated**: [Current Date]  
**Status**: Ready for Implementation  
**Approval**: Pending Architecture Review

