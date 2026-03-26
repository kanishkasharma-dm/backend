Upload this package as a Zip to the Lambda function `upload-reviewed`.

Handler:
upload-reviewed.handler

Required environment variables:
- NODE_ENV=production
- S3_BUCKET_NAME=deck-backend-demo
- SUPABASE_URL=https://mnvpodcfsflfpfxmukjr.supabase.co
- SUPABASE_ANON_KEY=<anon public key>
- ALLOWED_ORIGINS=http://localhost:5173,https://ecgwebq.vercel.app

Optional:
- S3_BUCKET=deck-backend-demo
- JWT_SECRET (not used by this package)
- PUBLIC_API_KEY
