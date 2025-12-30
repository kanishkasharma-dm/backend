import mongoose from 'mongoose';

const deviceConfigSchema = new mongoose.Schema({
  device_id: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  device_type: {
    type: String,
    enum: ['CPAP', 'BIPAP'],
    required: true,
  },
  config_values: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  last_updated: {
    type: Date,
    default: Date.now,
  },
  pending_update: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

export default mongoose.model('DeviceConfig', deviceConfigSchema);

