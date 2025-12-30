import mongoose from 'mongoose';

const ecgDataSchema = new mongoose.Schema({
  device_id: {
    type: String,
    required: true,
    index: true,
  },
  patient_id: {
    type: String,
    index: true,
  },
  session_id: {
    type: String,
    index: true,
  },
  // Metadata from JSON data (full index.json structure)
  ecg_data: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  // Upload metadata (from upload_metadata)
  upload_metadata: {
    filename: String,
    uploaded_at: Date,
    file_size: Number,
    file_type: String,
    patient_name: String,
    patient_age: String,
    report_date: String,
    machine_serial: String,
    heart_rate: String,
  },
  // Patient information (from index.json patient object)
  patient: {
    name: String,
    age: String,
    gender: String,
    date_time: String,
  },
  // ECG Metrics (from index.json metrics object)
  metrics: {
    HR_bpm: Number,
    PR_ms: Number,
    QRS_ms: Number,
    QT_ms: Number,
    QTc_ms: Number,
    QTcF_ms: Number,
    ST_ms: Number,
    ST_mV: Number,
    RR_ms: Number,
    Sokolow_Lyon_mV: Number,
    P_QRS_T_axes_deg: [String],
    RV5_SV1_mV: [Number],
  },
  // S3 file references
  json_s3_key: {
    type: String,
  },
  json_s3_url: {
    type: String,
  },
  pdf_s3_key: {
    type: String,
    required: true,
  },
  pdf_s3_url: {
    type: String,
    required: true,
  },
  // JSON twin file (if exists)
  json_twin_s3_key: {
    type: String,
  },
  json_twin_s3_url: {
    type: String,
  },
  s3_bucket: {
    type: String,
    required: true,
  },
  // File metadata
  file_metadata: {
    json_size: Number,
    pdf_size: Number,
    json_content_type: { type: String, default: 'application/json' },
    pdf_content_type: { type: String, default: 'application/pdf' },
  },
  // Recording metadata
  recording_date: {
    type: Date,
    index: true,
  },
  recording_duration: Number, // in seconds
  sample_rate: Number, // Hz
  leads: [String], // e.g., ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', ...]
  // Status and processing
  status: {
    type: String,
    enum: ['uploaded', 'processed', 'analyzed', 'error'],
    default: 'uploaded',
    index: true,
  },
  data_source: {
    type: String,
    enum: ['software', 'api', 'webhook', 'direct'],
    default: 'software',
    index: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  // Optional: Link to CPAP/BIPAP data if same patient/device
  linked_device_id: {
    type: String,
    index: true,
  },
  linked_device_type: {
    type: String,
    enum: ['CPAP', 'BIPAP'],
  },
}, {
  timestamps: true,
});

// Indexes for efficient queries
ecgDataSchema.index({ device_id: 1, timestamp: -1 });
ecgDataSchema.index({ patient_id: 1, timestamp: -1 });
ecgDataSchema.index({ recording_date: -1 });
ecgDataSchema.index({ status: 1, timestamp: -1 });

export default mongoose.model('ECGData', ecgDataSchema);

