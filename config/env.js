/**
 * Safe Environment Variable Access
 * Provides validation and fallbacks for all environment variables
 */

// Required environment variables with validation
const REQUIRED_VARS = {
  SUPABASE_URL: {
    description: 'Supabase project URL',
    validator: (value) => {
      return typeof value === 'string' && value.startsWith('https://') && value.includes('.supabase.co');
    }
  },
  SUPABASE_ANON_KEY: {
    description: 'Supabase anonymous key',
    validator: (value) => typeof value === 'string' && value.length > 50
  },
  SUPABASE_SERVICE_ROLE_KEY: {
    description: 'Supabase service role key',
    validator: (value) => typeof value === 'string' && value.length > 50
  },
  JWT_SECRET: {
    description: 'JWT secret key',
    validator: (value) => typeof value === 'string' && value.length >= 32
  }
};

// Optional environment variables with defaults
const OPTIONAL_VARS = {
  AWS_REGION: {
    description: 'AWS region',
    default: 'us-east-1',
    validator: (value) => typeof value === 'string' && value.length === 9 && value.includes('-')
  },
  PORT: {
    description: 'Server port',
    default: '3000',
    validator: (value) => {
      const port = parseInt(value);
      return !isNaN(port) && port > 0 && port < 65536;
    }
  },
  NODE_ENV: {
    description: 'Environment',
    default: 'development',
    validator: (value) => ['development', 'staging', 'production'].includes(value)
  },
  ALLOWED_ORIGINS: {
    description: 'CORS allowed origins',
    default: 'http://localhost:3000',
    validator: (value) => typeof value === 'string' && value.length > 0
  },
  API_URL: {
    description: 'API base URL',
    default: 'http://localhost:3000',
    validator: (value) => typeof value === 'string' && value.length > 0
  },
  EMAIL_PROVIDER: {
    description: 'Email provider',
    default: 'ses',
    validator: (value) => ['ses', 'sendgrid', 'smtp'].includes(value?.toLowerCase())
  },
  SES_REGION: {
    description: 'SES region',
    default: 'us-east-1',
    validator: (value) => typeof value === 'string' && value.length === 9 && value.includes('-')
  },
  S3_BUCKET_NAME: {
    description: 'S3 bucket name',
    default: null,
    validator: (value) => !value || (typeof value === 'string' && value.length > 0)
  },
  MONGODB_URI: {
    description: 'MongoDB connection string',
    default: null,
    validator: (value) => !value || (typeof value === 'string' && value.startsWith('mongodb://'))
  }
};

/**
 * Validate a single environment variable
 */
function validateEnvVar(key, value, config) {
  if (!value) {
    if (config.default !== undefined) {
      console.warn(`⚠️  ${key} not set, using default: ${config.default}`);
      return config.default;
    }
    throw new Error(`❌ Required environment variable ${key} is missing: ${config.description}`);
  }

  if (config.validator && !config.validator(value)) {
    throw new Error(`❌ Invalid format for ${key}: ${config.description}`);
  }

  return value;
}

/**
 * Load and validate all environment variables
 */
function loadEnv() {
  const env = {};
  const errors = [];

  // Validate required variables
  for (const [key, config] of Object.entries(REQUIRED_VARS)) {
    try {
      env[key] = validateEnvVar(key, process.env[key], config);
    } catch (error) {
      errors.push(error.message);
    }
  }

  // Validate optional variables
  for (const [key, config] of Object.entries(OPTIONAL_VARS)) {
    try {
      env[key] = validateEnvVar(key, process.env[key], config);
    } catch (error) {
      console.warn(`⚠️  ${error.message}`);
      env[key] = config.default;
    }
  }

  // Report errors
  if (errors.length > 0) {
    console.error('\n❌ Environment Variable Validation Failed:');
    errors.forEach(error => console.error(`   ${error}`));
    console.error('\nPlease check your .env file or AWS Lambda environment variables.\n');
    
    if (env.NODE_ENV === 'production') {
      throw new Error('Critical environment variables missing');
    }
  }

  return env;
}

/**
 * Get environment variable with fallback
 */
function getEnv(key, fallback = null) {
  return process.env[key] || fallback;
}

/**
 * Check if running in AWS Lambda
 */
function isLambda() {
  return !!process.env.AWS_LAMBDA_FUNCTION_NAME;
}

/**
 * Get current environment
 */
function getEnvironment() {
  return process.env.NODE_ENV || 'development';
}

/**
 * Check if in production
 */
function isProduction() {
  return getEnvironment() === 'production';
}

/**
 * Check if in development
 */
function isDevelopment() {
  return getEnvironment() === 'development';
}

/**
 * Get database configuration
 */
function getDatabaseConfig() {
  const env = loadEnv();
  
  return {
    mongodb: env.MONGODB_URI ? {
      uri: env.MONGODB_URI
    } : null,
    supabase: {
      url: env.SUPABASE_URL,
      anonKey: env.SUPABASE_ANON_KEY,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY
    }
  };
}

/**
 * Get AWS configuration
 */
function getAWSConfig() {
  const env = loadEnv();
  
  return {
    region: env.AWS_REGION,
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    iotEndpoint: env.AWS_IOT_ENDPOINT,
    s3Bucket: env.S3_BUCKET_NAME
  };
}

/**
 * Get JWT configuration
 */
function getJWTConfig() {
  const env = loadEnv();
  
  return {
    secret: env.JWT_SECRET,
    expiresIn: isProduction() ? '24h' : '7d'
  };
}

/**
 * Get server configuration
 */
function getServerConfig() {
  const env = loadEnv();
  
  return {
    port: parseInt(env.PORT),
    nodeEnv: env.NODE_ENV,
    allowedOrigins: env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()),
    apiUrl: env.API_URL
  };
}

/**
 * Get email configuration
 */
function getEmailConfig() {
  const env = loadEnv();
  
  return {
    provider: env.EMAIL_PROVIDER,
    from: env.EMAIL_FROM,
    sesRegion: env.SES_REGION
  };
}

/**
 * Initialize environment variables
 */
function initEnv() {
  const env = loadEnv();
  
  console.log(`✅ Environment loaded: ${env.NODE_ENV}`);
  console.log(`🌐 API URL: ${env.API_URL}`);
  console.log(`📊 Database: ${env.MONGODB_URI ? 'MongoDB' : 'Supabase'}`);
  
  return env;
}

export {
  initEnv,
  loadEnv,
  getEnv,
  isLambda,
  getEnvironment,
  isProduction,
  isDevelopment,
  getDatabaseConfig,
  getAWSConfig,
  getJWTConfig,
  getServerConfig,
  getEmailConfig
};
