Upload this package as a Zip to the Lambda function `upload-reviewed`.

Handler:
upload-reviewed.handler

Required environment variables:
- NODE_ENV=production
- JWT_SECRET=<same secret used by doctor JWT issuance>
- S3_BUCKET_NAME=deck-backend-demo
- S3_BUCKET=deck-backend-demo
- ALLOWED_ORIGINS=http://localhost:5173,https://ecgwebq.vercel.app

Optional:
- PUBLIC_API_KEY
