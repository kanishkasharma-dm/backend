import mongoose from 'mongoose';

const ocDataSchema = new mongoose.Schema({
  device_id: {
    type: String,
    required: true,
    index: true,
  },
  device_status: {
    type: Number,
    enum: [0, 1], // 0 = Acknowledgement from machine, 1 = Request from mobile
    required: true,
  },
  device_data: {
    // Can be either:
    // - Number (0/1/2/3) for realtime communication
    // - String ("power_status, alm_status") for data storage
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  // Parsed device_data when it's a string format
  parsed_data: {
    power_status: String,
    alm_status: String,
  },
  // Source of the data
  source: {
    type: String,
    enum: ['mobile', 'machine', 'direct'],
    default: 'direct',
    index: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  timestamps: true,
});

// Index for efficient queries
ocDataSchema.index({ device_id: 1, timestamp: -1 });
ocDataSchema.index({ device_id: 1, device_status: 1 });

export default mongoose.model('OCData', ocDataSchema);

