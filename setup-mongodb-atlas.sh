#!/bin/bash

echo "🔧 MongoDB Atlas Setup Helper"
echo "============================="
echo ""

echo "📋 Step-by-Step Guide:"
echo ""
echo "1. Go to: https://www.mongodb.com/cloud/atlas/register"
echo "2. Create free account"
echo "3. Create M0 FREE cluster"
echo "4. Create database user (save username & password!)"
echo "5. Configure network access (Allow from Anywhere)"
echo "6. Get connection string from 'Connect' button"
echo "7. Update .env file with connection string"
echo ""
echo "📝 Your .env file should have:"
echo "   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/mehulapi?retryWrites=true&w=majority"
echo ""
echo "✅ After setup, restart server: npm run dev"
echo ""

read -p "Have you set up MongoDB Atlas? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Check your .env file:"
    if [ -f .env ]; then
        if grep -q "MONGODB_URI" .env; then
            echo "✅ MONGODB_URI found in .env"
            echo ""
            echo "Testing connection string format..."
            MONGO_URI=$(grep MONGODB_URI .env | cut -d '=' -f2-)
            if [[ $MONGO_URI == mongodb+srv://* ]]; then
                echo "✅ Connection string looks correct (mongodb+srv)"
            else
                echo "⚠️  Connection string format might be incorrect"
            fi
        else
            echo "❌ MONGODB_URI not found in .env"
            echo "Add: MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/mehulapi?retryWrites=true&w=majority"
        fi
    else
        echo "❌ .env file not found"
        echo "Create .env file with your MongoDB connection string"
    fi
else
    echo ""
    echo "👉 Follow the guide in MONGODB_SETUP_SIMPLE.md"
    echo "   Or go to: https://www.mongodb.com/cloud/atlas/register"
fi
