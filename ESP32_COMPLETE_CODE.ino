/*
 * ============================================================
 * COMPLETE ESP32 CODE: BiPAP/CPAP Data Parser + AWS IoT MQTT
 * ============================================================
 * 
 * Features:
 * - Parses BiPAP/CPAP data from STM32 via Serial2
 * - Publishes to AWS IoT Core via MQTT
 * - Receives config updates from cloud
 * - Auto-reconnection handling
 * - WiFi credential update via Serial
 * 
 * Data Flow:
 * STM32 -> ESP32 (Serial2) -> Parse -> Publish to AWS IoT -> API -> MongoDB
 * Cloud -> AWS IoT -> ESP32 (MQTT) -> Apply Config
 * 
 * ============================================================
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <string.h>
#include <stdlib.h>

// ============================================================
// CONFIGURATION - UPDATE THESE VALUES
// ============================================================

// ---------- Select Machine Type ----------
#define CPAP_MACHINE true
#define BIPAP_MACHINE false

// ---------- Device Configuration ----------
#define DEVICE_ID "24"  // Your device ID (change as needed)

// ---------- WiFi Configuration ----------
const char* WIFI_SSID = "DECKMOUNTH";
const char* WIFI_PASSWORD = "deckmount";

// ---------- AWS IoT Configuration ----------
const char* AWS_ENDPOINT = "a2jqpfwttlq1yk-ats.iot.us-east-1.amazonaws.com";
const int AWS_PORT = 8883;
const char* AWS_IOT_TOPIC = "esp32/data24";  // Topic: esp32/data{DEVICE_ID}
const char* AWS_IOT_CONFIG_TOPIC = "esp32/config24";  // Config topic

// ---------- UART Configuration (STM32 -> ESP32) ----------
#define RXD2 16
#define TXD2 17
#define BAUDRATE 115200
#define RX_BUFFER_SIZE 2048

// ============================================================
// AWS IOT CERTIFICATES - REPLACE WITH YOUR ACTUAL CERTIFICATES
// ============================================================

static const char AWS_CERT_CA[] PROGMEM = R"EOF(
-----BEGIN CERTIFICATE-----
MIIDQTCCAimgAwIBAgITBmyfz5m/jAo54vB4ikPmljZbyjANBgkqhkiG9w0BAQsF
ADA5MQswCQYDVQQGEwJVUzEPMA0GA1UEChMGQW1hem9uMRkwFwYDVQQDExBBbWF6
b24gUm9vdCBDQSAxMB4XDTE1MDUyNjAwMDAwMFoXDTM4MDExNzAwMDAwMFowOTEL
MAkGA1UEBhMCVVMxDzANBgNVBAoTBkFtYXpvbjEZMBcGA1UEAxMQQW1hem9uIFJv
b3QgQ0EgMTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBALJ4gHHKeNXj
ca9HgFB0fW7Y14h29Jlo91ghYPl0hAEvrAIthtOgQ3pOsqTQNroBvo3bSMgHFzZM
9O6II8c+6zf1tRn4SWiw3te5djgdYZ6k/oI2peVKVuRF4fn9tBb6dNqcmzU5L/qw
IFAGbHrQgLKm+a/sRxmPUDgH3KKHOVj4utWp+UhnMJbulHheb4mjUcAwhmahRWa6
VOujw5H5SNz/0egwLX0tdHA114gk957EWW67c4cX8jJGKLhD+rcdqsq08p8kDi1L
93FcXmn/6pUCyziKrlA4b9v7LWIbxcceVOF34GfID5yHI9Y/QCB/IIDEgEw+OyQm
jgSubJrIqg0CAwEAAaNCMEAwDwYDVR0TAQH/BAUwAwEB/zAOBgNVHQ8BAf8EBAMC
AYYwHQYDVR0OBBYEFIQYzIU07LwMlJQuCFmcx7IQTgoIMA0GCSqGSIb3DQEBCwUA
A4IBAQCY8jdaQZChGsV2USggNiMOruYou6r4lK5IpDB/G/wkjUu0yKGX9rbxenDI
U5PMCCjjmCXPI6T53iHTfIUJrU6adTrCC2qJeHZERxhlbI1Bjjt/msv0tadQ1wUs
N+gDS63pYaACbvXy8MWy7Vu33PqUXHeeE6V/Uq2V8viTO96LXFvKWlJbYK8U90vv
o/ufQJVtMVT8QtPHRh8jrdkPSHCa2XV4cdFyQzR1bldZwgJcJmApzyMZFo6IQ6XU
5MsI+yMRQ+hDKXJioaldXgjUkK642M4UwtBV8ob2xJNDd2ZhwLnoQdeXeGADbkpy
rqXRfboQnoZsG4q5WTP468SQvvG5
-----END CERTIFICATE-----
)EOF";

static const char AWS_CERT_CRT[] PROGMEM = R"EOF(
-----BEGIN CERTIFICATE-----
MIIDWTCCAkGgAwIBAgIUex4CwwkUMWNhYRRBAfLwZqK7dckwDQYJKoZIhvcNAQEL
BQAwTTFLMEkGA1UECwxCQW1hem9uIFdlYiBTZXJ2aWNlcyBPPUFtYXpvbi5jb20g
SW5jLiBMPVNlYXR0bGUgU1Q9V2FzaGluZ3RvbiBDPVVTMB4XDTI1MTAwNzExNDk1
MFoXDTQ5MTIzMTIzNTk1OVowHjEcMBoGA1UEAwwTQVdTIElvVCBDZXJ0aWZpY2F0
ZTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAMxDbFVnpiwGOMcwEcc5
2+LEMnYmqUpZSRsPP5g5Su17Yvq6IJ7f/8dh+cRYM9lPsTy5/gaz5oxEG8XOM4qx
DkmC3Ql7TqCwGu/wb2GOHz+DXJtmb+2rII0WRxe1gsQ7fP8PPnTJaf5oCPmBudLm
HrRAzE0azNFnaiJE6kIR+mYD2W746f8jPMhWZkMF5TggrwPOmJLSPH8wEQwmPWGK
duM9z2cukcjKDqi/F6GLYMxuXx0je5RUgK+jH27LpLlAiwsgFXXZRygLrOsCA9l5
r2LeHUI8jebT+kY4uxZOlMUSuBmpNdeghVBGe+olpUwhkIoW/YsiZa4p1YfHgrGm
fmECAwEAAaNgMF4wHwYDVR0jBBgwFoAUGk3oKY7+hm3FWdhTO3ohEzcYcQ0wHQYD
VR0OBBYEFMSlEiQrhWX6mZHsu6quCJtOCL3cMAwGA1UdEwEB/wQCMAAwDgYDVR0P
AQH/BAQDAgeAMA0GCSqGSIb3DQEBCwUAA4IBAQA0Xo4tB3+9iXyHz28mYfEQRS+O
Ddrkn1PyodKL7P9juo1qrbTKIAIm+/amMa5ldhUByRLSdP71UIe8PEFgHcQK7qDf
tY6gihExRbAMElC73DRQdyS+HoV5g16ExYdhrSG4Qq06PdJR0Akb5D89QPQkBR3X
jmpJzEIGl++VOi0hvAMYrRzosGe0+c+ZIVDoBIVuZOpWchTFNRsMGUFRFT8eEKLC
SNDBGFpRQvSp6YBwRwa1/6yrfH89DB+FuWPOwUNnYEgLcSqGn7j+GtxPihdkHKv3
fWHwBudr/TwYTBS/29TtPxywnrPnNHKqmMCJ8P+PKIe/QRL7Tad1rnXz+1zE
-----END CERTIFICATE-----
)EOF";

static const char AWS_CERT_PRIVATE[] PROGMEM = R"EOF(
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEAzENsVWemLAY4xzARxznb4sQydiapSllJGw8/mDlK7Xti+rog
nt//x2H5xFgz2U+xPLn+BrPmjEQbxc4zirEOSYLdCXtOoLAa7/BvYY4fP4Ncm2Zv
7asgjRZHF7WCxDt8/w8+dMlp/mgI+YG50uYetEDMTRrM0WdqIkTqQhH6ZgPZbvjp
/yM8yFZmQwXlOCCvA86YktI8fzARDCY9YYp24z3PZy6RyMoOqL8XoYtgzG5fHSN7
lFSAr6MfbsukuUCLCyAVddlHKAus6wID2XmvYt4dQjyN5tP6Rji7Fk6UxRK4Gak1
16CFUEZ76iWlTCGQihb9iyJlrinVh8eCsaZ+YQIDAQABAoIBADTZ2ST77Y4EihpX
wLHYsaEp/Jh/hlv7YCQFPQIpCM8Llt+i2x/ge3DeU97Op5O5v/UjdqvLToLKeJkk
skdXaofwuTpj0kNXbZDZmCgYutMXLRX0Wk+XcJOwyPJEf7JAZiYkjpdvKeKujmvo
eeksq5MeFP56SbaA2IBHbolr12sfa1o54SRcGcs4Fz0eREsl0s1S5lko3wzE6vUz
SSD1S8X5YO/GHQZJ4qlwaCowKu5BeKMy7GFWeg1a5CxMuPJKKcYTiv7N8g7mndtX
phec7Yqa91JZpdG42ExHHcKXIzfF75l0VNjBg7IEunW5ukWN8g7j8aRsIoTfGnYx
WFCIsXECgYEA8QbGR/l9yjDoz4n6Mlo6ZLvkFkZjKQsb4k1m8QTPj8lf3Iy99V+x
iVw02IYtRyu+OzM84dY0SYeikInqHswRoxGrVyVSiF6w7pQCjIpEJDmxQ0eCI+F7
G7nrSjkOiaFi5QmaFsRp5WX7t5CJpGJHYJVAR0Nkq11HRra/6CRqP5UCgYEA2PP6
PXExl0HgBGZC22GDd0SNzZ3dJScN6+TNmvQd0ojrFZqzFg5hE+KmB+72VikJxdlk
KzLMNbWgyjUT7ahqKTR7Bc8KSZ73i3LMiYrq4vT+BYtrG2PcCCdP9iUkx/0/XHhG
V3nl1XDvlsPrca8Ti/XGUuBBJe1mweKe4hkngJ0CgYEAxzufWU1tYl3tg+h87XRS
AoShtJv4SawKH5V1u1MLs8J0wB2CxDqWyYFzmWvIL6WD+PGQqOlkjUdV5H5sDYsI
JTBs3ntWbq0/OecU+FEupHcgBQouFDTFi5SyXsctMi06TzMRsTIoitwzJ3iNnlky
wS5+VKnrpA9V5KkZlu3K+cUCgYAi9gYQWqpUJqBz9Qq3EZq+4IQ9a0AU2ZtLtT5Q
xx/7Kmc/vwM2/bA1JSP+SUrXDZvujx6uO2xfB1rW2wDQHoClDTj58ahFvuFDToeZ
bpJ1amd4+0OSUWBGzBb9onSv6aaJPzSOqi0YXS+uyvmpAz6SIlQITO0SsJQLkHps
EwOjnQKBgC80x0/OjNknJfHy9vu4XeNjhZYzueeqL7TGiN2j+fVvqL8v2kocM/b+
RbaSfstlqqJIE3EC7GtkwdTRI9oeOBN2PbKm/l01/WSjl55EXfGf0CjhBC1yFRsD
sDaTm21WjRHqimh2q6BQfFTkfTo4YSe+v4mxCwav+tQzOflFTOZ7
-----END RSA PRIVATE KEY-----
)EOF";

// ============================================================
// DATA STRUCTURES
// ============================================================

typedef struct {
  char date[16];
  char time[16];
  char mode[16];
  
  // A section (2 fields)
  float startPressureA;
  float maskTypeA;
  
  // B section (9 fields)
  float ipapB;
  float epapB;
  float startEpapB;
  float tminB;
  float tmaxB;
  float sensitivityB;
  float riseTimeB;
  float maskTypeB;
  
  // C section (9 fields)
  float ipapC;
  float epapC;
  float startEpapC;
  float respRateC;
  float tminC;
  float tmaxC;
  float sensitivityC;
  float riseTimeC;
  float maskTypeC;
  
  // D section (9 fields)
  float ipapD;
  float epapD;
  float startEpapD;
  float backupRateD;
  float tminD;
  float tmaxD;
  float sensitivityD;
  float riseTimeD;
  float maskTypeD;
  
  // E section (12 fields)
  float maxIpapE;
  float minIpapE;
  float epapE;
  float respRateE;
  float tminE;
  float tmaxE;
  float sensitivityE;
  float riseTimeE;
  float maskTypeE;
  float heightE;
  float tidalVolumeE;
  
  // F section (9 fields)
  float rampTimeF;
  float humidifierF;
  float tubeTypeF;
  float iModeF;
  float leakAlertF;
  float genderF;
  float sleepModeF;
  char serialNoF[20];
} BipapData;

typedef struct {
  char date[16];
  char time[16];
  char mode[16];
  
  float startPressureG;
  float maskTypeG;
  
  float startPressureH;
  float minPressureH;
  float maxPressureH;
  float maskTypeH;
  
  float rampTimeI;
  float humidifierI;
  float tubeTypeI;
  float iModeI;
  float leakAlertI;
  float genderI;
  float sleepModeI;
  char serialNoI[64];
} CpapData;

// ============================================================
// GLOBAL VARIABLES
// ============================================================

char rxBuffer[RX_BUFFER_SIZE];
int pos = 0;
BipapData bipap;
CpapData cpap;

// WiFi + MQTT clients
WiFiClientSecure net;
PubSubClient mqtt(net);

// WiFi update handling
static String newSSID = "";
static String newPWD = "";
static bool wifiUpdatePending = false;
static String serialBuffer = "";

// Device status (0 = off, 1 = on)
int deviceStatus = 1;  // Change as needed

// ============================================================
// HELPER FUNCTIONS
// ============================================================

void stripCRLFandHash(char *s) {
  int n = strlen(s);
  while (n > 0 && (s[n - 1] == '\r' || s[n - 1] == '\n' || s[n - 1] == '#')) {
    s[n - 1] = '\0';
    n--;
  }
}

void stripLeadingAsterisk(char *s) {
  if (s[0] == '*') {
    memmove(s, s + 1, strlen(s));
  }
}

void propagateSensitivityToAll(int sens) {
  // Note: Section A doesn't have sensitivity, only B, C, D, E sections have it
  bipap.sensitivityB = sens;
  bipap.sensitivityC = sens;
  bipap.sensitivityD = sens;
  bipap.sensitivityE = sens;
}

// ============================================================
// BIPAP PARSER
// ============================================================

void parseBipapFrame(const char *frame) {
  memset(&bipap, 0, sizeof(BipapData));
  char tmp[RX_BUFFER_SIZE];
  strncpy(tmp, frame, sizeof(tmp) - 1);
  tmp[sizeof(tmp) - 1] = 0;
  
  char *tok = strtok(tmp, ",");
  char section = 0;
  int fieldIndex = 0;
  
  while (tok != NULL) {
    stripCRLFandHash(tok);
    if (tok[0] == '*') stripLeadingAsterisk(tok);
    
    if (strcmp(tok, "A") == 0 || strcmp(tok, "B") == 0 || strcmp(tok, "C") == 0 ||
        strcmp(tok, "D") == 0 || strcmp(tok, "E") == 0 || strcmp(tok, "F") == 0) {
      section = tok[0];
      fieldIndex = 0;
      tok = strtok(NULL, ",");
      continue;
    }
    
    switch (section) {
      case 0:
        if (strcmp(tok, "S") == 0) break;
        if (strlen(bipap.date) == 0) {
          strncpy(bipap.date, tok, sizeof(bipap.date) - 1);
        } else if (strlen(bipap.time) == 0) {
          strncpy(bipap.time, tok, sizeof(bipap.time) - 1);
        } else if (strlen(bipap.mode) == 0) {
          strncpy(bipap.mode, tok, sizeof(bipap.mode) - 1);
        }
        break;
        
      case 'A':
        if (fieldIndex == 0) bipap.startPressureA = atof(tok);
        else if (fieldIndex == 1) bipap.maskTypeA = atof(tok);
        fieldIndex++;
        break;
        
      case 'B':
        switch (fieldIndex) {
          case 0: bipap.ipapB = atof(tok); break;
          case 1: bipap.epapB = atof(tok); break;
          case 2: bipap.startEpapB = atof(tok); break;
          case 3: bipap.tminB = atof(tok); break;
          case 4: bipap.tmaxB = atof(tok); break;
          case 5: bipap.sensitivityB = atof(tok); break;
          case 6: bipap.riseTimeB = atof(tok); break;
          case 7: bipap.maskTypeB = atof(tok); break;
        }
        fieldIndex++;
        break;
        
      case 'C':
        switch (fieldIndex) {
          case 0: bipap.ipapC = atof(tok); break;
          case 1: bipap.epapC = atof(tok); break;
          case 2: bipap.startEpapC = atof(tok); break;
          case 3: bipap.respRateC = atof(tok); break;
          case 4: bipap.tminC = atof(tok); break;
          case 5: bipap.tmaxC = atof(tok); break;
          case 6: bipap.sensitivityC = atof(tok); break;
          case 7: bipap.riseTimeC = atof(tok); break;
          case 8: bipap.maskTypeC = atof(tok); break;
        }
        fieldIndex++;
        break;
        
      case 'D':
        switch (fieldIndex) {
          case 0: bipap.ipapD = atof(tok); break;
          case 1: bipap.epapD = atof(tok); break;
          case 2: bipap.startEpapD = atof(tok); break;
          case 3: bipap.backupRateD = atof(tok); break;
          case 4: bipap.tminD = atof(tok); break;
          case 5: bipap.tmaxD = atof(tok); break;
          case 6: bipap.sensitivityD = atof(tok); break;
          case 7: bipap.riseTimeD = atof(tok); break;
          case 8: bipap.maskTypeD = atof(tok); break;
        }
        fieldIndex++;
        break;
        
      case 'E':
        switch (fieldIndex) {
          case 0: bipap.maxIpapE = atof(tok); break;
          case 1: bipap.minIpapE = atof(tok); break;
          case 2: bipap.epapE = atof(tok); break;
          case 3: bipap.respRateE = atof(tok); break;
          case 4: bipap.tminE = atof(tok); break;
          case 5: bipap.tmaxE = atof(tok); break;
          case 6: bipap.sensitivityE = atof(tok); break;
          case 7: bipap.riseTimeE = atof(tok); break;
          case 8: bipap.maskTypeE = atof(tok); break;
          case 9: bipap.heightE = atof(tok); break;
          case 10: bipap.tidalVolumeE = atof(tok); break;
        }
        fieldIndex++;
        break;
        
      case 'F':
        switch (fieldIndex) {
          case 0: bipap.rampTimeF = atof(tok); break;
          case 1: bipap.humidifierF = atof(tok); break;
          case 2: bipap.tubeTypeF = atof(tok); break;
          case 3: bipap.iModeF = atof(tok); break;
          case 4: bipap.leakAlertF = atof(tok); break;
          case 5: bipap.genderF = atof(tok); break;
          case 6: bipap.sleepModeF = atof(tok); break;
          case 7: strncpy(bipap.serialNoF, tok, sizeof(bipap.serialNoF) - 1); break;
        }
        fieldIndex++;
        break;
    }
    
    tok = strtok(NULL, ",");
  }
}

// ============================================================
// CPAP PARSER
// ============================================================

void parseCpapFrame(const char *frame) {
  memset(&cpap, 0, sizeof(CpapData));
  char tmp[RX_BUFFER_SIZE];
  strncpy(tmp, frame, sizeof(tmp) - 1);
  tmp[sizeof(tmp) - 1] = 0;
  
  char *tok = strtok(tmp, ",");
  char section = 0;
  int fieldIndex = 0;
  int hdr = 0;
  
  while (tok != NULL) {
    stripCRLFandHash(tok);
    if (tok[0] == '*') stripLeadingAsterisk(tok);
    
    if (strlen(tok) == 0 || strcmp(tok, "#") == 0) {
      tok = strtok(NULL, ",");
      continue;
    }
    
    if (strcmp(tok, "G") == 0 || strcmp(tok, "H") == 0 || strcmp(tok, "I") == 0) {
      section = tok[0];
      fieldIndex = 0;
      tok = strtok(NULL, ",");
      continue;
    }
    
    if (section == 0) {
      if (strcmp(tok, "S") == 0) {
        tok = strtok(NULL, ",");
        continue;
      }
      if (hdr == 0) strncpy(cpap.date, tok, sizeof(cpap.date) - 1);
      else if (hdr == 1) strncpy(cpap.time, tok, sizeof(cpap.time) - 1);
      else if (hdr == 2) strncpy(cpap.mode, tok, sizeof(cpap.mode) - 1);
      hdr++;
      tok = strtok(NULL, ",");
      continue;
    }
    
    if (section == 'G') {
      if (fieldIndex == 0) cpap.startPressureG = atof(tok);
      else if (fieldIndex == 1) cpap.maskTypeG = atof(tok);
      fieldIndex++;
    } else if (section == 'H') {
      switch (fieldIndex) {
        case 0: cpap.startPressureH = atof(tok); break;
        case 1: cpap.minPressureH = atof(tok); break;
        case 2: cpap.maxPressureH = atof(tok); break;
        case 3: cpap.maskTypeH = atof(tok); break;
      }
      fieldIndex++;
    } else if (section == 'I') {
      switch (fieldIndex) {
        case 0: cpap.rampTimeI = atof(tok); break;
        case 1: cpap.humidifierI = atof(tok); break;
        case 2: cpap.tubeTypeI = atof(tok); break;
        case 3: cpap.iModeI = atof(tok); break;
        case 4: cpap.leakAlertI = atof(tok); break;
        case 5: cpap.genderI = atof(tok); break;
        case 6: cpap.sleepModeI = atof(tok); break;
        case 7: strncpy(cpap.serialNoI, tok, sizeof(cpap.serialNoI) - 1); break;
      }
      fieldIndex++;
    }
    
    tok = strtok(NULL, ",");
  }
  
  // Print parsed values for debugging
  Serial.println("\n=========== CPAP PARSED OUTPUT ===========");
  Serial.printf("DATE: %s\n", cpap.date);
  Serial.printf("TIME: %s\n", cpap.time);
  Serial.printf("MODE: %s\n\n", cpap.mode);
  Serial.println("--- SECTION G ---");
  Serial.printf("StartPressureG : %.2f\n", cpap.startPressureG);
  Serial.printf("MaskTypeG      : %.2f\n\n", cpap.maskTypeG);
  Serial.println("--- SECTION H ---");
  Serial.printf("StartPressureH : %.2f\n", cpap.startPressureH);
  Serial.printf("MinPressureH   : %.2f\n", cpap.minPressureH);
  Serial.printf("MaxPressureH   : %.2f\n", cpap.maxPressureH);
  Serial.printf("MaskTypeH      : %.2f\n\n", cpap.maskTypeH);
  Serial.println("--- SECTION I ---");
  Serial.printf("RampTimeI      : %.2f\n", cpap.rampTimeI);
  Serial.printf("HumidifierI    : %.2f\n", cpap.humidifierI);
  Serial.printf("TubeTypeI      : %.2f\n", cpap.tubeTypeI);
  Serial.printf("IModeI         : %.2f\n", cpap.iModeI);
  Serial.printf("LeakAlertI     : %.2f\n", cpap.leakAlertI);
  Serial.printf("GenderI        : %.2f\n", cpap.genderI);
  Serial.printf("SleepModeI     : %.2f\n", cpap.sleepModeI);
  Serial.printf("SerialNoI      : %s\n", cpap.serialNoI);
  Serial.println("==========================================\n");
}

// ============================================================
// MQTT PUBLISH FUNCTIONS (FIXED VERSION)
// ============================================================

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
           bipap.date, bipap.time, bipap.mode,
           bipap.startPressureA, bipap.maskTypeA,
           bipap.ipapB, bipap.epapB, bipap.startEpapB,
           bipap.tminB, bipap.tmaxB, bipap.sensitivityB,
           bipap.riseTimeB, bipap.maskTypeB,
           bipap.ipapC, bipap.epapC, bipap.startEpapC,
           bipap.respRateC, bipap.tminC, bipap.tmaxC,
           bipap.sensitivityC, bipap.riseTimeC, bipap.maskTypeC,
           bipap.ipapD, bipap.epapD, bipap.startEpapD,
           bipap.backupRateD, bipap.tminD, bipap.tmaxD,
           bipap.sensitivityD, bipap.riseTimeD, bipap.maskTypeD,
           bipap.maxIpapE, bipap.minIpapE, bipap.epapE, bipap.respRateE,
           bipap.tminE, bipap.tmaxE, bipap.sensitivityE, bipap.riseTimeE,
           bipap.maskTypeE, bipap.heightE, bipap.tidalVolumeE,
           bipap.rampTimeF, bipap.humidifierF, bipap.tubeTypeF,
           bipap.iModeF, bipap.leakAlertF, bipap.genderF,
           bipap.sleepModeF, bipap.serialNoF
  );

  Serial.print("Device Data String: ");
  Serial.println(dataString);

  // ✅ FIXED: Create JSON with all required fields using ArduinoJson
  DynamicJsonDocument doc(1024);
  doc["device_status"] = deviceStatus;  // 0 or 1
  doc["device_data"] = dataString;
  doc["device_type"] = "BIPAP";
  doc["device_id"] = DEVICE_ID;
  
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

void publishCpapJson() {
  char dataString[256];
  snprintf(dataString, sizeof(dataString),
           "*,R,%s,%s,%s,"
           "G,%.1f,%.1f,"
           "H,%.1f,%.1f,%.1f,%.1f,"
           "I,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,%s,#",
           cpap.date, cpap.time, cpap.mode,
           cpap.startPressureG, cpap.maskTypeG,
           cpap.startPressureH, cpap.minPressureH,
           cpap.maxPressureH, cpap.maskTypeH,
           cpap.rampTimeI, cpap.humidifierI,
           cpap.tubeTypeI, cpap.iModeI,
           cpap.leakAlertI, cpap.genderI,
           cpap.sleepModeI, cpap.serialNoI
  );

  Serial.print("Device Data String: ");
  Serial.println(dataString);

  // ✅ FIXED: Create JSON with all required fields using ArduinoJson
  DynamicJsonDocument doc(512);
  doc["device_status"] = deviceStatus;  // 0 or 1
  doc["device_data"] = dataString;
  doc["device_type"] = "CPAP";
  doc["device_id"] = DEVICE_ID;
  
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

// ============================================================
// MQTT MESSAGE HANDLER (For Config Updates)
// ============================================================

void messageHandler(char* topic, byte* payload, unsigned int length) {
  String msg;
  
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️ No internet connection");
    return;
  }
  
  for (int i = 0; i < length; i++) {
    msg += (char)payload[i];
  }
  
  Serial.print("📨 Message from cloud: ");
  Serial.println(msg);
  
  String topicStr = String(topic);
  
  // Handle config updates from esp32/config24
  if (topicStr.indexOf("/config") > 0) {
    Serial.println("🔧 Config update received");
    
    // Parse JSON config
    DynamicJsonDocument doc(512);
    DeserializationError error = deserializeJson(doc, msg);
    
    if (error) {
      Serial.print("❌ JSON parse error: ");
      Serial.println(error.c_str());
      return;
    }
    
    // Extract config values
    if (doc.containsKey("config")) {
      JsonObject config = doc["config"];
      Serial.println("📋 Applying new configuration:");
      
      // Apply config to device (example - adjust based on your device)
      if (config.containsKey("pressure")) {
        float pressure = config["pressure"];
        Serial.printf("  → Pressure: %.1f\n", pressure);
        // Apply to device hardware here
      }
      
      if (config.containsKey("humidity")) {
        float humidity = config["humidity"];
        Serial.printf("  → Humidity: %.1f\n", humidity);
        // Apply to device hardware here
      }
      
      Serial.println("✅ Configuration applied");
    }
  }
}

// ============================================================
// WIFI CONNECTION
// ============================================================

void connectWiFi() {
  Serial.print("🔌 Connecting WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int tries = 0;
  
  while (WiFi.status() != WL_CONNECTED && tries < 60) {
    delay(500);
    Serial.print(".");
    tries++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi connected: " + WiFi.localIP().toString());
  } else {
    Serial.println("\n❌ WiFi connect failed");
  }
}

// ============================================================
// MQTT CONNECTION
// ============================================================

void connectMQTT() {
  net.setCACert(AWS_CERT_CA);
  net.setCertificate(AWS_CERT_CRT);
  net.setPrivateKey(AWS_CERT_PRIVATE);
  mqtt.setServer(AWS_ENDPOINT, AWS_PORT);
  mqtt.setCallback(messageHandler);
  mqtt.setBufferSize(1024);
  
  Serial.print("🔌 Connecting to AWS MQTT");
  
  while (!mqtt.connected()) {
    if (mqtt.connect("ESP32Device")) {
      Serial.println("\n✅ Connected to AWS MQTT");
      // Subscribe to config topic for receiving updates
      if (mqtt.subscribe(AWS_IOT_CONFIG_TOPIC)) {
        Serial.println("📡 Subscribed to config topic: " + String(AWS_IOT_CONFIG_TOPIC));
      }
    } else {
      Serial.print(".");
      delay(100);
    }
  }
}

// ============================================================
// SETUP
// ============================================================

void setup() {
  Serial.begin(115200);
  Serial2.begin(BAUDRATE, SERIAL_8N1, RXD2, TXD2);
  
  Serial.println("\n========================================");
  Serial.println("ESP32 BiPAP/CPAP Data Logger");
  Serial.println("========================================");
  
  #if CPAP_MACHINE
    Serial.println("Mode: CPAP");
  #elif BIPAP_MACHINE
    Serial.println("Mode: BIPAP");
  #endif
  
  Serial.println("Device ID: " + String(DEVICE_ID));
  Serial.println("Topic: " + String(AWS_IOT_TOPIC));
  Serial.println("========================================\n");
  
  connectWiFi();
  connectMQTT();
  
  Serial.println("\n✅ Setup complete. Ready to receive data!");
}

// ============================================================
// MAIN LOOP
// ============================================================

void loop() {
  // Keep MQTT alive
  mqtt.loop();
  
  // ============================================================
  // WiFi / MQTT Reconnection Check
  // ============================================================
  
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️ WiFi disconnected. Reconnecting...");
    connectWiFi();
  } else if (!mqtt.connected()) {
    Serial.println("⚠️ MQTT disconnected. Reconnecting...");
    connectMQTT();
  }
  
  // ============================================================
  // Read from Serial2 (STM32 -> ESP32)
  // ============================================================
  
  while (Serial2.available()) {
    char c = Serial2.read();
    
    if (c == '\r') continue;
    
    if (c == '\n' || c == '#') {
      if (pos > 0) {
        rxBuffer[pos] = '\0';
        
        Serial.println("\n--- Frame Received from STM32 ---");
        Serial.println(rxBuffer);
        
        // Parse and publish based on machine type
        #if BIPAP_MACHINE
          parseBipapFrame(rxBuffer);
          publishBipapJson();
        #elif CPAP_MACHINE
          parseCpapFrame(rxBuffer);
          publishCpapJson();
        #endif
        
        pos = 0;
        memset(rxBuffer, 0, sizeof(rxBuffer));
      }
    } else if (pos < RX_BUFFER_SIZE - 1) {
      rxBuffer[pos++] = c;
    }
  }
  
  // ============================================================
  // Read from Serial (USB) - For WiFi updates and manual input
  // ============================================================
  
  while (Serial.available()) {
    char c = Serial.read();
    
    if (c == '\r') continue;
    
    if (c == '\n') {
      if (serialBuffer.length() == 0) continue;
      
      // Handle WiFi credential update
      if (serialBuffer.startsWith("SSID:")) {
        int commaIndex = serialBuffer.indexOf(',');
        if (commaIndex != -1) {
          String ssidPart = serialBuffer.substring(5, commaIndex);
          String pwdPart = serialBuffer.substring(commaIndex + 1);
          if (pwdPart.startsWith("PWD:")) pwdPart.remove(0, 4);
          
          newSSID = ssidPart;
          newPWD = pwdPart;
          wifiUpdatePending = true;
          
          Serial.println("📡 WiFi credentials received. Applying soon...");
        } else {
          Serial.println("⚠️ Invalid format! Use: SSID:YourSSID,PWD:YourPassword");
        }
      }
      // Handle manual frame input (for testing)
      else if (serialBuffer.startsWith("*")) {
        Serial.println("\n--- Manual Frame Input ---");
        Serial.println(serialBuffer);
        
        #if BIPAP_MACHINE
          parseBipapFrame(serialBuffer.c_str());
          publishBipapJson();
        #elif CPAP_MACHINE
          parseCpapFrame(serialBuffer.c_str());
          publishCpapJson();
        #endif
      }
      
      serialBuffer = "";
    } else {
      serialBuffer += c;
    }
  }
  
  // ============================================================
  // Apply WiFi Credential Update
  // ============================================================
  
  if (wifiUpdatePending) {
    wifiUpdatePending = false;
    Serial.println("\n🔁 Reconnecting WiFi with new credentials...");
    Serial.print("New SSID: ");
    Serial.println(newSSID);
    Serial.print("New PASSWORD: ");
    Serial.println(newPWD);
    
    WiFi.disconnect(true, true);
    delay(200);
    WiFi.begin(newSSID.c_str(), newPWD.c_str());
    
    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < 10000) {
      delay(500);
      Serial.print(".");
    }
    
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("\n✅ WiFi reconnected successfully!");
      // Reconnect MQTT with new WiFi
      connectMQTT();
    } else {
      Serial.println("\n❌ Failed to reconnect WiFi. Check credentials.");
    }
  }
  
  // Small delay to prevent watchdog issues
  delay(10);
}

/*
 * ============================================================
 * COMPLETE CODE SUMMARY
 * ============================================================
 * 
 * This code:
 * 1. ✅ Connects to WiFi
 * 2. ✅ Connects to AWS IoT Core via MQTT
 * 3. ✅ Reads data from STM32 via Serial2
 * 4. ✅ Parses CPAP/BiPAP data strings
 * 5. ✅ Publishes JSON to AWS IoT with correct format:
 *      {
 *        "device_status": 0,
 *        "device_data": "*,R,...",
 *        "device_type": "CPAP" or "BIPAP",
 *        "device_id": "24"
 *      }
 * 6. ✅ Receives config updates from cloud
 * 7. ✅ Handles reconnection automatically
 * 8. ✅ Allows WiFi credential update via Serial
 * 
 * Data Flow:
 * STM32 -> Serial2 -> ESP32 -> Parse -> MQTT Publish -> AWS IoT -> API -> MongoDB
 * 
 * ============================================================
 */

