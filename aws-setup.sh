#!/bin/bash

echo "🚀 AWS Deployment Setup Script"
echo "==============================="
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found"
    echo "Install: brew install awscli"
    exit 1
fi

# Check if EB CLI is installed
if ! command -v eb &> /dev/null; then
    echo "❌ EB CLI not found"
    echo "Install: pip install awsebcli"
    echo "Or: brew install aws-elasticbeanstalk"
    exit 1
fi

echo "✅ AWS CLI and EB CLI found"
echo ""

# Check AWS credentials
echo "Checking AWS credentials..."
if aws sts get-caller-identity &> /dev/null; then
    echo "✅ AWS credentials configured"
    aws sts get-caller-identity
else
    echo "❌ AWS credentials not configured"
    echo "Run: aws configure"
    exit 1
fi

echo ""
echo "📋 Next Steps:"
echo "1. eb init"
echo "2. eb create mehulapi-production"
echo "3. eb setenv NODE_ENV=production MONGODB_URI=..."
echo "4. eb deploy"
echo ""
echo "See AWS_DEPLOYMENT_QUICK_START.md for detailed guide"
