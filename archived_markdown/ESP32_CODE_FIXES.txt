# 🔧 ESP32 Code Fixes Required

## Issues Found in Current Code

1. **Missing `device_type` field** in JSON payload
2. **Missing `device_id` field** in JSON payload
3. **Using `sprintf` for JSON** (error-prone, should use ArduinoJson)
4. **Topic subscription** - Subscribing to same topic as publish (not needed)

---

## ✅ Required Changes

### Change 1: Add Device Type and Device ID

Update `publishBipapJson()` and `publishCpapJson()` functions to include:
- `device_type`: "BIPAP" or "CPAP"
- `device_id`: Extract from topic (e.g., "24" from "esp32/data24")

### Change 2: Use ArduinoJson Library Properly

Instead of `sprintf` for JSON, use `ArduinoJson` library which you already have included.

---

## 📝 Code Changes

### Updated `publishBipapJson()` Function:

```cpp
void publishBipapJson() {
  char dataString[600];
  snprintf(dataString, sizeof(dataString),
           "*,R,%s,%s,%s,"
           "A,%.1f,%.1f,"
           "B,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,"
           "C,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,"
           "D,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,"
           "E,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,"
           "F,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,%s,#",
           // HEADER
           bipap.date, bipap.time, bipap.mode,
           // A
           bipap.startPressureA, bipap.maskTypeA,
           // B
           bipap.ipapB, bipap.epapB, bipap.startEpapB,
           bipap.tminB, bipap.tmaxB, bipap.sensitivityB,
           bipap.riseTimeB, bipap.maskTypeB,
           // C
           bipap.ipapC, bipap.epapC, bipap.startEpapC,
           bipap.respRateC, bipap.tminC, bipap.tmaxC,
           bipap.sensitivityC, bipap.riseTimeC, bipap.maskTypeC,
           // D
           bipap.ipapD, bipap.epapD, bipap.startEpapD,
           bipap.backupRateD, bipap.tminD, bipap.tmaxD,
           bipap.sensitivityD, bipap.riseTimeD, bipap.maskTypeD,
           // E
           bipap.maxIpapE, bipap.minIpapE, bipap.epapE, bipap.respRateE,
           bipap.tminE, bipap.tmaxE, bipap.sensitivityE, bipap.riseTimeE,
           bipap.maskTypeE, bipap.heightE, bipap.tidalVolumeE,
           // F
           bipap.rampTimeF, bipap.humidifierF, bipap.tubeTypeF,
           bipap.iModeF, bipap.leakAlertF, bipap.genderF,
           bipap.sleepModeF, bipap.serialNoF
  );

  Serial.print("Device Data String: ");
  Serial.println(dataString);

  // Extract device_id from topic (e.g., "esp32/data24" -> "24")
  String deviceId = String(AWS_IOT_TOPIC);
  deviceId.replace("esp32/data", "");
  
  // Create JSON using ArduinoJson
  DynamicJsonDocument doc(1024);
  doc["device_status"] = 0;  // You can make this dynamic if needed
  doc["device_data"] = dataString;
  doc["device_type"] = "BIPAP";  // Fixed for BiPAP machine
  doc["device_id"] = deviceId;
  
  char payload_ack[1024];
  serializeJson(doc, payload_ack);
  
  Serial.print("Publishing JSON: ");
  Serial.println(payload_ack);

  if (mqtt.connected()) {
    if (mqtt.publish(AWS_IOT_TOPIC, payload_ack)) {
      Serial.println("✅ Published BiPAP data to AWS IoT");
    } else {
      Serial.println("❌ Publish failed");
    }
  } else {
    Serial.println("❌ MQTT not connected");
  }
}
```

### Updated `publishCpapJson()` Function:

```cpp
void publishCpapJson() {
  char dataString[256];
  snprintf(dataString, sizeof(dataString),
           "*,R,%s,%s,%s,"
           "G,%.1f,%.1f,"
           "H,%.1f,%.1f,%.1f,%.1f,"
           "I,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,%s,#",
           cpap.date,
           cpap.time,
           cpap.mode,
           cpap.startPressureG,
           cpap.maskTypeG,
           cpap.startPressureH,
           cpap.minPressureH,
           cpap.maxPressureH,
           cpap.maskTypeH,
           cpap.rampTimeI,
           cpap.humidifierI,
           cpap.tubeTypeI,
           cpap.iModeI,
           cpap.leakAlertI,
           cpap.genderI,
           cpap.sleepModeI,
           cpap.serialNoI
  );

  Serial.print("Device Data String: ");
  Serial.println(dataString);

  // Extract device_id from topic (e.g., "esp32/data24" -> "24")
  String deviceId = String(AWS_IOT_TOPIC);
  deviceId.replace("esp32/data", "");
  
  // Create JSON using ArduinoJson
  DynamicJsonDocument doc(512);
  doc["device_status"] = 0;  // You can make this dynamic if needed
  doc["device_data"] = dataString;
  doc["device_type"] = "CPAP";  // Fixed for CPAP machine
  doc["device_id"] = deviceId;
  
  char payload_ack[512];
  serializeJson(doc, payload_ack);
  
  Serial.print("Publishing JSON: ");
  Serial.println(payload_ack);

  if (mqtt.connected()) {
    if (mqtt.publish(AWS_IOT_TOPIC, payload_ack)) {
      Serial.println("✅ Published CPAP data to AWS IoT");
    } else {
      Serial.println("❌ Publish failed");
    }
  } else {
    Serial.println("❌ MQTT not connected");
  }
}
```

### Change 3: Remove Unnecessary Topic Subscription

In `connectMQTT()`, you're subscribing to the same topic you publish to. This is only needed if you want to receive config updates. Remove if not needed:

```cpp
void connectMQTT() {
  net.setCACert(AWS_CERT_CA);
  net.setCertificate(AWS_CERT_CRT);
  net.setPrivateKey(AWS_CERT_PRIVATE);
  mqtt.setServer(AWS_ENDPOINT, AWS_PORT);
  mqtt.setCallback(messageHandler);  // Keep this if you need to receive config updates
  
  Serial.print("Connecting to AWS MQTT");
  while (!mqtt.connected()) {
    if (mqtt.connect("ESP32Device")) {
      Serial.println(" connected to AWS MQTT");
      // Only subscribe if you need to receive config updates
      // mqtt.subscribe(AWS_IOT_TOPIC);  // Comment out if not needed
      // Or subscribe to config topic: mqtt.subscribe("esp32/config24");
    } else {
      Serial.print(".");
      delay(100);
    }
  }
}
```

---

## 📋 Summary of Required Changes

1. ✅ Add `device_type` field: "BIPAP" or "CPAP" based on machine type
2. ✅ Add `device_id` field: Extract from topic string
3. ✅ Use `ArduinoJson` library instead of `sprintf` for JSON creation
4. ✅ Ensure `device_status` is included (already present)
5. ✅ Keep `device_data` as string (already correct)

---

## 🧪 Testing

After making changes:

1. **Upload code to ESP32**
2. **Monitor Serial output** - Should see JSON payload before publishing
3. **Check AWS IoT Console** - MQTT test client should receive messages
4. **Check Railway logs** - Should see requests arriving
5. **Check MongoDB** - Should see data saved with `data_source: "cloud"`

---

## ✅ Expected JSON Output

### For BiPAP:
```json
{
  "device_status": 0,
  "device_data": "*,R,141125,1703,MANUALMODE,A,12.2,1.0,B,29.6,10.8,10.6,40.0,10.0,10.0,13.0,1.0,C,16.0,10.0,10.0,10.0,10.0,10.0,0.0,200.0,1.0,D,11.0,10.0,10.0,10.0,10.0,10.0,10.0,200.0,1.0,E,20.0,10.0,5.0,10.0,20.0,20.0,1.0,200.0,1.0,170.0,500.0,F,5.0,1.0,1.0,1.0,0.0,1.0,1.0,12345678,#",
  "device_type": "BIPAP",
  "device_id": "24"
}
```

### For CPAP:
```json
{
  "device_status": 0,
  "device_data": "*,R,141125,1703,MANUALMODE,G,13.6,1.0,H,12.4,12.4,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,12345678C,#",
  "device_type": "CPAP",
  "device_id": "24"
}
```

---

## 🔍 Additional Improvements

### Option 1: Make Device ID a Constant

Instead of extracting from topic, you can define it:

```cpp
#define DEVICE_ID "24"  // Add at top of file

// Then in publish functions:
doc["device_id"] = DEVICE_ID;
```

### Option 2: Dynamic Device Status

If you want to send actual device status:

```cpp
// Add global variable or read from hardware
int currentDeviceStatus = 1;  // 0 = off, 1 = on

// Then in publish functions:
doc["device_status"] = currentDeviceStatus;
```

### Option 3: Subscribe to Config Topic

If you want to receive configuration updates:

```cpp
// In connectMQTT(), subscribe to config topic:
mqtt.subscribe("esp32/config24");  // For device 24

// In messageHandler(), check topic:
void messageHandler(char* topic, byte* payload, unsigned int length) {
  String topicStr = String(topic);
  
  if (topicStr.indexOf("/config") > 0) {
    // Handle config update
    // Parse config and apply to device
  } else if (topicStr.indexOf("/data") > 0) {
    // Handle data request (your current code)
  }
}
```

---

**Make these changes and your data will be correctly formatted for the API and MongoDB!**

