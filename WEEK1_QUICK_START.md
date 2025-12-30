# Week 1 Tasks - Quick Start Guide

## Installation

1. **Install dependencies:**
   ```bash
   cd backend-main
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env` file in `backend-main/` directory with:
   ```env
   PORT=3000
   NODE_ENV=development
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key_here
   JWT_EXPIRES_IN=24h
   API_VERSION=v1
   API_BASE_URL=http://localhost:3000
   ```

3. **Run the server:**
   ```bash
   npm run dev
   ```

## Testing

1. **Run tests:**
   ```bash
   npm test
   ```

2. **Run tests with coverage:**
   ```bash
   npm run test:coverage
   ```

## API Documentation

Once the server is running, access Swagger documentation at:
```
http://localhost:3000/api-docs
```

## Testing Admin Endpoints

To test admin endpoints, you'll need a JWT token. For now, you can:

1. **Generate a test token** (using Node.js):
   ```javascript
   const jwt = require('jsonwebtoken');
   const token = jwt.sign(
     { userId: '123', username: 'admin', role: 'admin' },
     process.env.JWT_SECRET,
     { expiresIn: '24h' }
   );
   console.log(token);
   ```

2. **Test admin endpoint:**
   ```bash
   curl -X GET "http://localhost:3000/api/v1/admin/device-data?device_id=24&latest=true" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

## What's Been Implemented

✅ JWT authentication middleware  
✅ API versioning (/api/v1)  
✅ Centralized error handling  
✅ Request validation  
✅ Admin data fetch endpoints  
✅ Jest testing setup  
✅ Swagger documentation  

## File Structure

```
backend-main/
├── middleware/
│   ├── auth.js              # JWT authentication
│   ├── errorHandler.js      # Centralized error handling
│   └── validation.js       # Request validation
├── controllers/
│   └── adminController.js  # Admin endpoints
├── routes/
│   └── adminRoutes.js      # Admin routes
├── config/
│   └── swagger.js          # Swagger configuration
├── tests/
│   ├── setup.js            # Test setup
│   └── middleware/        # Test files
├── jest.config.js          # Jest configuration
└── server.js              # Updated with versioning & error handling
```

## Next Steps

1. Install dependencies: `npm install`
2. Set up `.env` file
3. Test the implementation: `npm test`
4. Start the server: `npm run dev`
5. Access Swagger docs: `http://localhost:3000/api-docs`

