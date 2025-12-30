/**
 * Parse CPAP device data string
 * Format: *,S,141125,1447,G,12.2,1.0,H,10.6,10.6,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,#
 * Also handles: *,R,141125,1703,MANUALMODE,G,13.6,1.0,H,12.4,12.4,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,12345678,#
 */
export function parseCPAPData(dataString) {
  const parts = dataString.split(',');
  
  // Remove start (*) and end (#) markers
  const cleanParts = parts.filter(p => p !== '*' && p !== '#');
  
  const parsed = {
    sections: {},
  };
  
  let currentSection = null;
  let currentSectionData = [];
  
  for (let i = 0; i < cleanParts.length; i++) {
    const part = cleanParts[i];
    
    // Check if this is a section marker (single letter)
    if (part.length === 1 && /[A-Z]/.test(part)) {
      // Save previous section if exists
      if (currentSection) {
        parsed.sections[currentSection] = currentSectionData;
      }
      currentSection = part;
      currentSectionData = [];
    } else {
      // Add to current section data
      const numValue = parseFloat(part);
      currentSectionData.push(isNaN(numValue) ? part : numValue);
    }
  }
  
  // Save last section
  if (currentSection) {
    parsed.sections[currentSection] = currentSectionData;
  }
  
  // Map section data to meaningful names for CPAP
  if (parsed.sections.S) {
    parsed.metadata = {
      date: parsed.sections.S[0] || null,
      time: parsed.sections.S[1] || null,
    };
  }
  
  if (parsed.sections.G) {
    parsed.pressure = {
      ipap: parsed.sections.G[0] || null,
      ramp: parsed.sections.G[1] || null,
    };
  }
  
  if (parsed.sections.H) {
    parsed.flow = {
      max_flow: parsed.sections.H[0] || null,
      min_flow: parsed.sections.H[1] || null,
      backup_rate: parsed.sections.H[2] || null,
      mode: parsed.sections.H[3] || null,
    };
  }
  
  if (parsed.sections.I) {
    parsed.settings = {
      humidity: parsed.sections.I[0] || null,
      temperature: parsed.sections.I[1] || null,
      tube_type: parsed.sections.I[2] || null,
      mask_type: parsed.sections.I[3] || null,
      trigger: parsed.sections.I[4] || null,
      cycle: parsed.sections.I[5] || null,
      mode: parsed.sections.I[6] || null,
    };
  }
  
  return parsed;
}

/**
 * Parse BIPAP device data string
 * Format: *,S,141125,1447,A,12.2,1.0,B,29.6,10.8,10.6,40.0,10.0,10.0,13.0,1.0,C,16.0,10.0,10.0,10.0,10.0,10.0,0.0,200.0,1.0,D,11.0,10.0,10.0,10.0,10.0,10.0,10.0,200.0,1.0,E,20.0,10.0,5.0,10.0,20.0,20.0,1.0,200.0,1.0,170.0,500.0,F,5.0,1.0,1.0,1.0,0.0,1.0,1.0,#
 */
export function parseBIPAPData(dataString) {
  const parts = dataString.split(',');
  
  // Remove start (*) and end (#) markers
  const cleanParts = parts.filter(p => p !== '*' && p !== '#');
  
  const parsed = {
    sections: {},
  };
  
  let currentSection = null;
  let currentSectionData = [];
  
  for (let i = 0; i < cleanParts.length; i++) {
    const part = cleanParts[i];
    
    // Check if this is a section marker (single letter)
    if (part.length === 1 && /[A-Z]/.test(part)) {
      // Save previous section if exists
      if (currentSection) {
        parsed.sections[currentSection] = currentSectionData;
      }
      currentSection = part;
      currentSectionData = [];
    } else {
      // Add to current section data
      const numValue = parseFloat(part);
      currentSectionData.push(isNaN(numValue) ? part : numValue);
    }
  }
  
  // Save last section
  if (currentSection) {
    parsed.sections[currentSection] = currentSectionData;
  }
  
  // Map section data to meaningful names for BIPAP
  if (parsed.sections.S) {
    parsed.metadata = {
      date: parsed.sections.S[0] || null,
      time: parsed.sections.S[1] || null,
    };
  }
  
  if (parsed.sections.A) {
    parsed.pressure = {
      ipap: parsed.sections.A[0] || null,
      ramp: parsed.sections.A[1] || null,
    };
  }
  
  if (parsed.sections.B) {
    parsed.ventilation = {
      ipap: parsed.sections.B[0] || null,
      epap: parsed.sections.B[1] || null,
      backup_rate: parsed.sections.B[2] || null,
      tidal_volume: parsed.sections.B[3] || null,
      insp_time: parsed.sections.B[4] || null,
      rise_time: parsed.sections.B[5] || null,
      trigger: parsed.sections.B[6] || null,
      mode: parsed.sections.B[7] || null,
    };
  }
  
  // Additional sections C, D, E, F can be mapped as needed
  if (parsed.sections.C) {
    parsed.section_c = parsed.sections.C;
  }
  
  if (parsed.sections.D) {
    parsed.section_d = parsed.sections.D;
  }
  
  if (parsed.sections.E) {
    parsed.section_e = parsed.sections.E;
  }
  
  if (parsed.sections.F) {
    parsed.settings = {
      humidity: parsed.sections.F[0] || null,
      temperature: parsed.sections.F[1] || null,
      tube_type: parsed.sections.F[2] || null,
      mask_type: parsed.sections.F[3] || null,
      trigger: parsed.sections.F[4] || null,
      cycle: parsed.sections.F[5] || null,
      mode: parsed.sections.F[6] || null,
    };
  }
  
  return parsed;
}

/**
 * Main parser function that detects device type and parses accordingly
 */
export function parseDeviceData(deviceData, deviceType) {
  if (deviceType === 'CPAP') {
    return parseCPAPData(deviceData);
  } else if (deviceType === 'BIPAP') {
    return parseBIPAPData(deviceData);
  }
  throw new Error(`Unknown device type: ${deviceType}`);
}

/**
 * Extract device ID from data string (if present)
 * For now, we'll use a timestamp-based ID if not found
 */
export function extractDeviceId(dataString) {
  // If device ID is embedded in the data, extract it here
  // For now, return null and let the API handle device ID
  return null;
}

