import mongoose from 'mongoose';

const deviceDataSchema = new mongoose.Schema({
  device_type: {
    type: String,
    enum: ['CPAP', 'BIPAP'],
    required: true,
  },
  device_id: {
    type: String,
    required: true,
    index: true,
  },
  device_status: {
    type: Number,
    required: true,
  },
  raw_data: {
    type: String,
    required: true,
  },
  parsed_data: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  data_source: {
    type: String,
    enum: ['cloud', 'software', 'direct'],
    default: 'direct',
    index: true,
    required: true,
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
deviceDataSchema.index({ device_id: 1, timestamp: -1 });

export default mongoose.model('DeviceData', deviceDataSchema);

