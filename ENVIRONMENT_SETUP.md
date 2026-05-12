# AWS Lambda Environment Variables Configuration

## Staging Environment Variables

| Variable Name | Value | Description |
|---------------|-------|-------------|
| SUPABASE_URL | `https://staging-project.supabase.co` | Staging Supabase project URL |
| SUPABASE_ANON_KEY | `staging_supabase_anon_key` | Staging Supabase anonymous key |
| SUPABASE_SERVICE_ROLE_KEY | `staging_supabase_service_role_key` | Staging Supabase service role key |
| JWT_SECRET | `staging_jwt_secret_minimum_32_characters` | JWT secret for staging |
| AWS_REGION | `us-east-1` | AWS region |
| AWS_ACCESS_KEY_ID | `staging_aws_access_key` | Staging AWS access key |
| AWS_SECRET_ACCESS_KEY | `staging_aws_secret_key` | Staging AWS secret key |
| AWS_IOT_ENDPOINT | `staging-iot-endpoint.iot.us-east-1.amazonaws.com` | Staging IoT endpoint |
| S3_BUCKET_NAME | `staging-s3-bucket` | Staging S3 bucket name |
| EMAIL_PROVIDER | `ses` | Email provider |
| EMAIL_FROM | `staging@yourdomain.com` | Staging from email |
| SES_REGION | `us-east-1` | SES region |
| NODE_ENV | `staging` | Environment |
| ALLOWED_ORIGINS | `https://staging.yourdomain.com` | Allowed CORS origins |
| API_URL | `https://staging-api.yourdomain.com` | Staging API URL |
| DOCTOR_SETUP_BASE_URL | `https://staging.yourdomain.com/doctor-setup` | Staging doctor setup URL |
| MONGODB_URI | `mongodb://staging-host:27017/mehulapi_staging` | Staging MongoDB URI |

## Production Environment Variables

| Variable Name | Value | Description |
|---------------|-------|-------------|
| SUPABASE_URL | `https://prod-project.supabase.co` | Production Supabase project URL |
| SUPABASE_ANON_KEY | `prod_supabase_anon_key` | Production Supabase anonymous key |
| SUPABASE_SERVICE_ROLE_KEY | `prod_supabase_service_role_key` | Production Supabase service role key |
| JWT_SECRET | `prod_jwt_secret_minimum_32_characters_long_and_secure` | JWT secret for production |
| AWS_REGION | `us-east-1` | AWS region |
| AWS_ACCESS_KEY_ID | `prod_aws_access_key` | Production AWS access key |
| AWS_SECRET_ACCESS_KEY | `prod_aws_secret_key` | Production AWS secret key |
| AWS_IOT_ENDPOINT | `prod-iot-endpoint.iot.us-east-1.amazonaws.com` | Production IoT endpoint |
| S3_BUCKET_NAME | `prod-s3-bucket` | Production S3 bucket name |
| EMAIL_PROVIDER | `ses` | Email provider |
| EMAIL_FROM | `noreply@yourdomain.com` | Production from email |
| SES_REGION | `us-east-1` | SES region |
| NODE_ENV | `production` | Environment |
| ALLOWED_ORIGINS | `https://yourdomain.com` | Allowed CORS origins |
| API_URL | `https://api.yourdomain.com` | Production API URL |
| DOCTOR_SETUP_BASE_URL | `https://yourdomain.com/doctor-setup` | Production doctor setup URL |
| MONGODB_URI | `mongodb://prod-host:27017/mehulapi_prod` | Production MongoDB URI |

## AWS Lambda Setup Instructions

### 1. Set Environment Variables via AWS Console

1. Go to AWS Lambda Console
2. Select your Lambda function
3. Go to **Configuration** → **Environment variables**
4. Click **Edit**
5. Add each variable from the tables above

### 2. Set Environment Variables via AWS CLI

```bash
# Staging
aws lambda update-function-configuration \
  --function-name your-staging-function \
  --environment Variables="{SUPABASE_URL=https://staging-project.supabase.co,SUPABASE_ANON_KEY=staging_supabase_anon_key,...}"

# Production
aws lambda update-function-configuration \
  --function-name your-production-function \
  --environment Variables="{SUPABASE_URL=https://prod-project.supabase.co,SUPABASE_ANON_KEY=prod_supabase_anon_key,...}"
```

### 3. Environment Variable Security

- **Never commit actual secrets to version control**
- **Use AWS Secrets Manager for sensitive values**
- **Rotate secrets regularly**
- **Use IAM roles instead of access keys when possible**
- **Enable encryption at rest for Lambda functions**

### 4. Best Practices

- Use different AWS accounts for staging and production
- Implement least privilege access for IAM roles
- Monitor environment variable changes with CloudTrail
- Use parameter validation for critical variables
- Set up alerts for failed Lambda executions due to missing env vars
