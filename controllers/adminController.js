import DeviceData from '../models/DeviceData.js';
import ECGData from '../models/ECGData.js';
import OCData from '../models/OCData.js';
import { createError } from '../middleware/errorHandler.js';

/**
 * Get device data with date filtering
 * GET /api/v1/admin/device-data?device_id=24&from=2025-01-20T00:00:00Z&to=2025-01-20T23:59:59Z
 * GET /api/v1/admin/device-data?device_id=24&latest=true
 */
export const getDeviceData = async (req, res, next) => {
  try {
    const { device_id, from, to, latest, device_type, limit = 1000, include_corrupted } = req.query;
    
    if (!device_id) {
      throw createError('device_id is required', 400, 'MISSING_DEVICE_ID');
    }
    
    const query = { device_id };
    
    // Add device type filter if provided
    if (device_type) {
      query.device_type = device_type;
    }
    
    // Handle latest record request
    if (latest === 'true' || latest === true) {
      const latestRecord = await DeviceData.findOne(query)
        .sort({ timestamp: -1 })
        .lean();
      
      if (!latestRecord) {
        throw createError('No data found for this device', 404, 'DEVICE_DATA_NOT_FOUND');
      }
      
      return res.json({
        success: true,
        data: latestRecord,
        timestamp: new Date().toISOString(),
      });
    }
    
    // Handle date range filtering
    if (from || to) {
      query.timestamp = {};
      if (from) {
        query.timestamp.$gte = new Date(from);
      }
      if (to) {
        query.timestamp.$lte = new Date(to);
      }
    }
    
    // Exclude corrupted data by default (add ?include_corrupted=true to include)
    if (include_corrupted !== 'true' && include_corrupted !== true) {
      query.corruption_status = { $ne: 'corrupted' };
    }
    
    const limitNum = parseInt(limit) || 1000;
    const data = await DeviceData.find(query)
      .sort({ timestamp: -1 })
      .limit(limitNum)
      .lean();
    
    const total = await DeviceData.countDocuments(query);
    
    return res.json({
      success: true,
      count: data.length,
      total,
      data,
      filters: {
        device_id,
        from,
        to,
        device_type,
        include_corrupted: include_corrupted === 'true' || include_corrupted === true,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get ECG data with date filtering
 * GET /api/v1/admin/ecg-data?device_id=xxx&from=2025-01-20T00:00:00Z&to=2025-01-20T23:59:59Z
 */
export const getECGDataAdmin = async (req, res, next) => {
  try {
    const { device_id, patient_id, from, to, latest, limit = 100 } = req.query;
    
    const query = {};
    
    if (device_id) query.device_id = device_id;
    if (patient_id) query.patient_id = patient_id;
    
    if (latest === 'true' || latest === true) {
      const latestRecord = await ECGData.findOne(query)
        .sort({ recording_date: -1 })
        .lean();
      
      if (!latestRecord) {
        throw createError('No ECG data found', 404, 'ECG_DATA_NOT_FOUND');
      }
      
      return res.json({
        success: true,
        data: latestRecord,
        timestamp: new Date().toISOString(),
      });
    }
    
    if (from || to) {
      query.recording_date = {};
      if (from) query.recording_date.$gte = new Date(from);
      if (to) query.recording_date.$lte = new Date(to);
    }
    
    const limitNum = parseInt(limit) || 100;
    const data = await ECGData.find(query)
      .sort({ recording_date: -1 })
      .limit(limitNum)
      .select('-ecg_data') // Exclude large JSON
      .lean();
    
    const total = await ECGData.countDocuments(query);
    
    return res.json({
      success: true,
      count: data.length,
      total,
      data,
      filters: {
        device_id,
        patient_id,
        from,
        to,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get OC data with date filtering
 * GET /api/v1/admin/oc-data?device_id=xxx&from=2025-01-20T00:00:00Z&to=2025-01-20T23:59:59Z
 */
export const getOCDataAdmin = async (req, res, next) => {
  try {
    const { device_id, from, to, latest, limit = 100 } = req.query;
    
    if (!device_id) {
      throw createError('device_id is required', 400, 'MISSING_DEVICE_ID');
    }
    
    const query = { device_id };
    
    if (latest === 'true' || latest === true) {
      const latestRecord = await OCData.findOne(query)
        .sort({ timestamp: -1 })
        .lean();
      
      if (!latestRecord) {
        throw createError('No OC data found', 404, 'OC_DATA_NOT_FOUND');
      }
      
      return res.json({
        success: true,
        data: latestRecord,
        timestamp: new Date().toISOString(),
      });
    }
    
    if (from || to) {
      query.timestamp = {};
      if (from) query.timestamp.$gte = new Date(from);
      if (to) query.timestamp.$lte = new Date(to);
    }
    
    const limitNum = parseInt(limit) || 100;
    const data = await OCData.find(query)
      .sort({ timestamp: -1 })
      .limit(limitNum)
      .lean();
    
    const total = await OCData.countDocuments(query);
    
    return res.json({
      success: true,
      count: data.length,
      total,
      data,
      filters: {
        device_id,
        from,
        to,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

