Upload this package as a Zip to the Lambda function `ecg-reports`.

Handler:
reports.handler

Required environment variables:
- JWT_SECRET
- NODE_ENV=production
- S3_BUCKET=deck-backend-demo
- S3_BUCKET_NAME=deck-backend-demo
- ALLOWED_ORIGINS=http://localhost:5173,https://ecgwebq.vercel.app
