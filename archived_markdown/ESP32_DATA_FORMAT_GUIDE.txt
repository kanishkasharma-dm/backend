# 📡 ESP32 Data Format Guide

## ✅ Data Format Required for ESP32 → AWS IoT Cloud → MongoDB

### Overview
ESP32 device should publish MQTT messages to AWS IoT Core. The IoT Rule forwards this to your API, which saves it to MongoDB.

---

## 📋 Required Data Format

### MQTT Topic
```
esp32/data24
```
- Format: `esp32/data{device_id}`
- Examples: `esp32/data24`, `esp32/data25`, `esp32/data1`
- This matches the IoT Rule pattern: `esp32/+`

---

## 📦 JSON Payload Format

### Complete Payload Structure:
```json
{
  "device_status": 0,
  "device_data": "*,R,141125,1703,MANUALMODE,G,13.6,1.0,H,12.4,12.4,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,12345678C,#",
  "device_type": "CPAP",
  "device_id": "24"
}
```

### Field Descriptions:

#### 1. `device_status` (Required)
- **Type:** Integer (0 or 1)
- **Description:** Device operational status
- **Values:**
  - `0` = Device off/inactive
  - `1` = Device on/active
- **Example:** `0`

#### 2. `device_data` (Required)
- **Type:** String
- **Description:** Raw CPAP/BIPAP data string
- **Format:** Comma-separated values with sections
- **CPAP Format:**
  ```
  *,S,{date},{time},{mode},G,{pressure},H,{flow},I,{settings},#
  ```
- **Example:**
  ```
  *,R,141125,1703,MANUALMODE,G,13.6,1.0,H,12.4,12.4,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,12345678C,#
  ```
- **BIPAP Format:**
  ```
  *,S,{date},{time},A,{pressure},B,{ventilation},C,{advanced1},D,{advanced2},E,{advanced3},F,{settings},#
  ```
- **Example:**
  ```
  *,S,141125,1447,A,12.2,1.0,B,29.6,10.8,10.6,40.0,10.0,10.0,13.0,1.0,C,16.0,10.0,10.0,10.0,10.0,10.0,0.0,200.0,1.0,D,11.0,10.0,10.0,10.0,10.0,10.0,10.0,200.0,1.0,E,20.0,10.0,5.0,10.0,20.0,20.0,1.0,200.0,1.0,170.0,500.0,F,5.0,1.0,1.0,1.0,0.0,1.0,1.0,#
  ```

#### 3. `device_type` (Optional but Recommended)
- **Type:** String
- **Description:** Device type identifier
- **Values:**
  - `"CPAP"` - CPAP device
  - `"BIPAP"` - BIPAP device
- **Auto-detection:** If not provided, API auto-detects from `device_data` string
- **Example:** `"CPAP"`

#### 4. `device_id` (Optional)
- **Type:** String
- **Description:** Unique device identifier
- **Auto-extraction:** If not provided, API extracts from MQTT topic (`esp32/data24` → `24`)
- **Example:** `"24"` or `"25"`

---

## 📝 Complete Examples

### Example 1: CPAP Device (Minimal Required)
```json
{
  "device_status": 1,
  "device_data": "*,R,141125,1703,MANUALMODE,G,13.6,1.0,H,12.4,12.4,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,12345678C,#"
}
```
- Topic: `esp32/data24`
- `device_type` and `device_id` will be auto-detected/extracted

### Example 2: CPAP Device (Complete)
```json
{
  "device_status": 0,
  "device_data": "*,R,141125,17444403,MANUALMODE,G,13.6,1.0,H,12.4,12.4,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,12345678C,#",
  "device_type": "CPAP",
  "device_id": "24"
}
```
- Topic: `esp32/data24`

### Example 3: BIPAP Device
```json
{
  "device_status": 1,
  "device_data": "*,S,141125,1447,A,12.2,1.0,B,29.6,10.8,10.6,40.0,10.0,10.0,13.0,1.0,C,16.0,10.0,10.0,10.0,10.0,10.0,0.0,200.0,1.0,D,11.0,10.0,10.0,10.0,10.0,10.0,10.0,200.0,1.0,E,20.0,10.0,5.0,10.0,20.0,20.0,1.0,200.0,1.0,170.0,500.0,F,5.0,1.0,1.0,1.0,0.0,1.0,1.0,#",
  "device_type": "BIPAP",
  "device_id": "25"
}
```
- Topic: `esp32/data25`

---

## 🔧 ESP32 Code Example

### Arduino/ESP32 Code:

```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// WiFi and MQTT Configuration
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* mqtt_server = "YOUR_AWS_IOT_ENDPOINT.iot.us-east-1.amazonaws.com";
const char* mqtt_topic = "esp32/data24";  // Change 24 to your device ID

WiFiClientSecure espClient;
PubSubClient client(espClient);

void setup() {
  Serial.begin(115200);
  
  // Connect to WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("WiFi connected");
  
  // Load AWS IoT certificates (for secure connection)
  // espClient.setCACert(aws_ca_cert);
  // espClient.setCertificate(device_cert);
  // espClient.setPrivateKey(device_private_key);
  
  client.setServer(mqtt_server, 8883);  // AWS IoT uses port 8883
  client.setBufferSize(1024);  // Increase buffer for larger messages
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();
  
  // Read CPAP/BIPAP data (example)
  String deviceDataString = readDeviceData();  // Your function to read from device
  
  // Create JSON payload
  DynamicJsonDocument doc(1024);
  doc["device_status"] = 1;  // 0 or 1
  doc["device_data"] = deviceDataString;
  doc["device_type"] = "CPAP";  // or "BIPAP"
  doc["device_id"] = "24";  // Your device ID
  
  // Convert to JSON string
  String payload;
  serializeJson(doc, payload);
  
  // Publish to MQTT
  if (client.publish(mqtt_topic, payload.c_str())) {
    Serial.println("Data published successfully");
  } else {
    Serial.println("Failed to publish");
  }
  
  delay(30000);  // Publish every 30 seconds (adjust as needed)
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    if (client.connect("ESP32Client")) {  // Use device certificate in production
      Serial.println("connected");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

String readDeviceData() {
  // Your function to read actual CPAP/BIPAP data
  // Example: Read from serial port or sensors
  return "*,R,141125,1703,MANUALMODE,G,13.6,1.0,H,12.4,12.4,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,12345678C,#";
}
```

---

## 📋 Data Flow

```
ESP32 Device
    │
    │ MQTT Publish
    │ Topic: esp32/data24
    │ Payload: JSON with device_status, device_data, etc.
    ▼
AWS IoT Core
    │
    │ IoT Rule: FROM 'esp32/+'
    │ Action: HTTPS POST to API webhook
    ▼
Your API (Railway)
    │
    │ POST /api/iot/webhook
    │ Receives data, parses, saves
    ▼
MongoDB Atlas
    │
    │ DeviceData collection
    │ data_source: 'cloud'
    ▼
Data Stored ✅
```

---

## ✅ Validation Checklist

Before sending from ESP32, verify:

- [ ] **Topic format:** `esp32/data{device_id}` (e.g., `esp32/data24`)
- [ ] **Payload is valid JSON:** Use JSON validator
- [ ] **`device_status`:** Integer (0 or 1)
- [ ] **`device_data`:** String starting with `*,` and ending with `,#`
- [ ] **`device_type`:** `"CPAP"` or `"BIPAP"` (optional but recommended)
- [ ] **`device_id`:** String (optional, auto-extracted from topic)
- [ ] **MQTT connection:** ESP32 connected to AWS IoT Core
- [ ] **AWS IoT certificates:** Loaded correctly (for secure connection)

---

## 🔍 Data String Format Details

### CPAP Data String Structure:
```
*,S,{date},{time},{mode},G,{ipap},{ramp},H,{max_flow},{min_flow},{backup_rate},{mode},I,{humidity},{temperature},{tube_type},{mask_type},{trigger},{cycle},{mode},{device_id},#
```

**Sections:**
- `S` - System/Metadata (date, time, mode)
- `G` - Pressure (IPAP, ramp)
- `H` - Flow (max, min, backup rate, mode)
- `I` - Settings (humidity, temperature, etc.)

### BIPAP Data String Structure:
```
*,S,{date},{time},A,{ipap},{ramp},B,{ipap},{epap},{backup_rate},{tidal_volume},{insp_time},{rise_time},{trigger},{mode},C,{advanced1},D,{advanced2},E,{advanced3},F,{settings},#
```

**Sections:**
- `S` - System/Metadata
- `A` - Pressure
- `B` - Ventilation parameters
- `C`, `D`, `E`, `F` - Advanced settings

---

## ⚠️ Common Mistakes

### ❌ Wrong Topic Format
```
❌ esp32/24        (Missing 'data')
❌ data24          (Missing 'esp32/')
✅ esp32/data24   (Correct)
```

### ❌ Invalid JSON
```
❌ device_status=0,device_data=...  (Not JSON)
✅ {"device_status": 0, "device_data": "..."}  (Valid JSON)
```

### ❌ Missing Required Fields
```
❌ {"device_data": "..."}  (Missing device_status)
✅ {"device_status": 0, "device_data": "..."}  (Complete)
```

### ❌ Wrong device_data Format
```
❌ *,G,13.6,#  (Too short, missing sections)
✅ *,R,141125,1703,MANUALMODE,G,13.6,1.0,H,12.4,12.4,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,12345678C,#
```

---

## 🧪 Test Before Deploying

### 1. Test with MQTT Test Client
1. Go to AWS IoT Console → Test → MQTT test client
2. Subscribe to: `esp32/data24`
3. Publish test message with exact format above
4. Check Railway logs (should see request)
5. Check MongoDB (should see saved data)

### 2. Verify Data Format
- JSON is valid (use JSON validator)
- All required fields present
- Topic matches pattern `esp32/+`

---

## 📞 Summary

**Minimum Required Fields:**
```json
{
  "device_status": 0 or 1,
  "device_data": "*,...device data string...#"
}
```

**Recommended (Complete):**
```json
{
  "device_status": 0,
  "device_data": "*,R,141125,1703,MANUALMODE,G,13.6,1.0,H,12.4,12.4,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,12345678C,#",
  "device_type": "CPAP",
  "device_id": "24"
}
```

**MQTT Topic:** `esp32/data24` (or `esp32/data{device_id}`)

**This format will:**
- ✅ Be received by AWS IoT Core
- ✅ Match IoT Rule pattern (`esp32/+`)
- ✅ Be forwarded to your API
- ✅ Be parsed and saved to MongoDB
- ✅ Be marked with `data_source: "cloud"`

---

**Next Step:** Implement this format in your ESP32 code and test!

