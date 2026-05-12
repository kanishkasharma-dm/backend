/**
 * Example: Safe Environment Variable Usage
 * Shows how to use the env.js configuration in your application
 */

import { 
  initEnv, 
  getDatabaseConfig, 
  getAWSConfig, 
  getJWTConfig, 
  getServerConfig,
  getEmailConfig,
  isProduction,
  isDevelopment,
  isLambda
} from '../config/env.js';

// Initialize environment at application start
try {
  const env = initEnv();
  
  // Example: Database configuration
  const dbConfig = getDatabaseConfig();
  console.log('Database Config:', dbConfig);
  
  // Example: AWS configuration
  const awsConfig = getAWSConfig();
  console.log('AWS Config:', {
    region: awsConfig.region,
    iotEndpoint: awsConfig.iotEndpoint ? 'Set' : 'Not set',
    s3Bucket: awsConfig.s3Bucket || 'Not set'
  });
  
  // Example: JWT configuration
  const jwtConfig = getJWTConfig();
  console.log('JWT Config:', {
    secretLength: jwtConfig.secret.length,
    expiresIn: jwtConfig.expiresIn
  });
  
  // Example: Server configuration
  const serverConfig = getServerConfig();
  console.log('Server Config:', serverConfig);
  
  // Example: Email configuration
  const emailConfig = getEmailConfig();
  console.log('Email Config:', emailConfig);
  
} catch (error) {
  console.error('❌ Failed to initialize environment:', error.message);
  process.exit(1);
}

// Example: Usage in Express app
import express from 'express';
import { createClient } from '@supabase/supabase-js';

const app = express();

// Safe Supabase client initialization
function createSupabaseClient() {
  const { supabase } = getDatabaseConfig();
  
  if (!supabase.url || !supabase.anonKey) {
    throw new Error('Supabase configuration missing');
  }
  
  return createClient(supabase.url, supabase.anonKey);
}

// Safe AWS S3 client initialization
import { S3Client } from '@aws-sdk/client-s3';

function createS3Client() {
  const awsConfig = getAWSConfig();
  
  if (!awsConfig.region) {
    throw new Error('AWS region not configured');
  }
  
  const clientConfig = {
    region: awsConfig.region
  };
  
  // Only add credentials if not in Lambda (which uses IAM roles)
  if (!isLambda() && awsConfig.accessKeyId && awsConfig.secretAccessKey) {
    clientConfig.credentials = {
      accessKeyId: awsConfig.accessKeyId,
      secretAccessKey: awsConfig.secretAccessKey
    };
  }
  
  return new S3Client(clientConfig);
}

// Example: Middleware for environment validation
function validateEnvironment(req, res, next) {
  try {
    // This will throw if critical env vars are missing
    getDatabaseConfig();
    getJWTConfig();
    
    next();
  } catch (error) {
    console.error('Environment validation failed:', error.message);
    
    if (isProduction()) {
      return res.status(500).json({
        error: 'Server configuration error'
      });
    } else {
      return res.status(500).json({
        error: 'Server configuration error',
        details: error.message
      });
    }
  }
}

// Example: Lambda function handler
export const lambdaHandler = async (event) => {
  try {
    // Environment is already validated by initEnv()
    const { supabase } = getDatabaseConfig();
    const jwtConfig = getJWTConfig();
    
    // Your Lambda logic here
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Success',
        environment: process.env.NODE_ENV,
        isLambda: isLambda()
      })
    };
    
  } catch (error) {
    console.error('Lambda handler error:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: isDevelopment() ? error.message : undefined
      })
    };
  }
};

// Example: Conditional logic based on environment
function getLogLevel() {
  if (isProduction()) {
    return 'error';
  } else if (process.env.NODE_ENV === 'staging') {
    return 'warn';
  } else {
    return 'debug';
  }
}

// Example: Feature flags based on environment
function getFeatureFlags() {
  return {
    enableDebugMode: !isProduction(),
    enableDetailedErrors: isDevelopment(),
    enableMetrics: isProduction(),
    enableLocalTesting: isDevelopment()
  };
}

export {
  createSupabaseClient,
  createS3Client,
  validateEnvironment,
  getLogLevel,
  getFeatureFlags
};
