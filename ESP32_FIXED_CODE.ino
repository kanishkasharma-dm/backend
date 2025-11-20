// ============================================================
// FIXED VERSION: Complete BiPAP/CPAP parser + AWS MQTT publish
// ============================================================
// CHANGES MADE:
// 1. Added device_type and device_id to JSON payload
// 2. Used ArduinoJson library for proper JSON formatting
// 3. Fixed JSON structure to match API requirements
// ============================================================

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <string.h>
#include <stdlib.h>
#include <stdbool.h>

// ---------- Select mode ----------
#define CPAP_MACHINE true
#define BIPAP_MACHINE false   

// ---------- Device Configuration ----------
#define DEVICE_ID "24"  // Your device ID (change as needed)

// ---------- UART (STM32 -> ESP32) ----------
#define RXD2 16
#define TXD2 17
#define BAUDRATE 115200
#define RX_BUFFER_SIZE 2048

// ---------- WiFi / AWS (fill these) ----------
char *WIFI_SSID = "DECKMOUNTH";
char *WIFI_PASSWORD = "deckmount";
const char *AWS_ENDPOINT = "a2jqpfwttlq1yk-ats.iot.us-east-1.amazonaws.com";
const int AWS_PORT = 8883;
const char *AWS_IOT_TOPIC = "esp32/data24";  // Topic format: esp32/data{DEVICE_ID}

// ... (Keep all your certificate definitions as they are) ...
// AWS_CERT_CA, AWS_CERT_CRT, AWS_CERT_PRIVATE

// ... (Keep all your data structures as they are) ...
// BipapData, CpapData structures

// ... (Keep all your parsing functions as they are) ...
// parseBipapFrame(), parseCpapFrame()

// ---------- FIXED: Publisher for BiPAP ----------
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

  // ✅ FIX: Create JSON using ArduinoJson with all required fields
  DynamicJsonDocument doc(1024);
  doc["device_status"] = 0;  // 0 = off, 1 = on (change as needed)
  doc["device_data"] = dataString;
  doc["device_type"] = "BIPAP";  // Fixed for BiPAP machine
  doc["device_id"] = DEVICE_ID;  // Use defined device ID
  
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

// ---------- FIXED: Publisher for CPAP ----------
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

  // ✅ FIX: Create JSON using ArduinoJson with all required fields
  DynamicJsonDocument doc(512);
  doc["device_status"] = 0;  // 0 = off, 1 = on (change as needed)
  doc["device_data"] = dataString;
  doc["device_type"] = "CPAP";  // Fixed for CPAP machine
  doc["device_id"] = DEVICE_ID;  // Use defined device ID
  
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

// ... (Keep rest of your code - messageHandler, setup, loop, etc.) ...

