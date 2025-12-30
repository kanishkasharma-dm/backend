import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from '.env' file (relative to project root)
dotenv.config({ path: join(__dirname, '..', '.env') });

let isConnected = false;

const connectDB = async () => {
  // If already connected, return
  if (isConnected) {
    console.log('MongoDB already connected');
    return;
  }

  // If no MongoDB URI, warn but don't crash
  if (!process.env.MONGODB_URI && !process.env.MONGODB_URI?.includes('mongodb')) {
    console.warn('⚠️  WARNING: MONGODB_URI not set in env file');
    console.warn('   API will run but data cannot be saved to MongoDB');
    console.warn('   Set MONGODB_URI in env file or use MongoDB Atlas');
    console.warn('   See SETUP_MONGODB.md for instructions');
    return;
  }

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mehulapi';
    const conn = await mongoose.connect(mongoUri);
    isConnected = true;
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    console.error('   API will continue running, but data operations will fail');
    console.error('   Please check:');
    console.error('   1. MongoDB is running (or MongoDB Atlas is accessible)');
    console.error('   2. MONGODB_URI in env file is correct');
    console.error('   3. Network/firewall allows connection');
    // Don't exit - let server continue for testing
    isConnected = false;
  }
};

// Handle connection events
mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.log('⚠️  MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err.message);
  isConnected = false;
});

export default connectDB;
export { isConnected };

