# 📤 ESP32 Code Upload Guide

## ⚠️ Important: Arduino Code Cannot Run on Computer

Arduino `.ino` files must be **compiled and uploaded to ESP32 hardware**. They cannot run directly on your Mac/PC.

---

## 📋 Prerequisites

### 1. **Hardware Required:**
   - ESP32 development board (ESP32-WROOM-32 or compatible)
   - USB cable (USB-A to Micro-USB or USB-C)
   - STM32 device (for sending data via Serial2)

### 2. **Software Required:**
   - **Arduino IDE** (v1.8.19 or newer, or Arduino IDE 2.x)
   - **ESP32 Board Support** (installed via Board Manager)
   - **Required Libraries** (installed via Library Manager)

---

## 🔧 Step 1: Install Arduino IDE

### Download:
- **Arduino IDE 2.x**: https://www.arduino.cc/en/software
- **Arduino IDE 1.8.x**: https://www.arduino.cc/en/software/legacy

### Install:
1. Download for macOS
2. Open `.dmg` file
3. Drag Arduino to Applications
4. Open Arduino IDE

---

## 🔧 Step 2: Install ESP32 Board Support

### Arduino IDE 2.x or 1.8.x:

1. Open Arduino IDE
2. Go to **File → Preferences**
3. In "Additional Board Manager URLs", add:
   ```
   https://espressif.github.io/arduino-esp32/package_esp32_index.json
   ```
4. Click **OK**
5. Go to **Tools → Board → Boards Manager**
6. Search for **"esp32"**
7. Install **"esp32 by Espressif Systems"** (version 2.0.x or newer)
8. Wait for installation to complete

---

## 🔧 Step 3: Install Required Libraries

Go to **Tools → Manage Libraries** and install:

1. **WiFi** (usually pre-installed)
2. **WiFiClientSecure** (usually pre-installed)
3. **PubSubClient** by Nick O'Leary
   - Search: "PubSubClient"
   - Install: "PubSubClient by Nick O'Leary"
4. **ArduinoJson** by Benoit Blanchon
   - Search: "ArduinoJson"
   - Install: "ArduinoJson by Benoit Blanchon" (v6.x or v7.x)

---

## 🔧 Step 4: Prepare the Code

### Option A: Copy from File

1. Open `ESP32_COMPLETE_CODE.ino` in Arduino IDE:
   - **File → Open** → Select `ESP32_COMPLETE_CODE.ino`

### Option B: Create New Sketch

1. **File → New**
2. Copy all code from `ESP32_COMPLETE_CODE.ino`
3. Paste into the new sketch
4. Save as `ESP32_COMPLETE_CODE`

---

## 🔧 Step 5: Configure Board Settings

1. **Tools → Board → ESP32 Arduino → ESP32 Dev Module** (or your ESP32 board)
2. **Tools → Port → Select your ESP32 port** (e.g., `/dev/cu.usbserial-xxxx` or `/dev/cu.SLAB_USBtoUART`)
3. **Tools → Upload Speed → 115200** (or higher if supported)
4. **Tools → Flash Size → 4MB (32Mb)** (or your board's flash size)
5. **Tools → Partition Scheme → Default 4MB with spiffs** (or default)
6. **Tools → CPU Frequency → 240MHz (WiFi/BT)** (recommended)

---

## 🔧 Step 6: Update Configuration in Code

### **Before uploading, update these values:**

```cpp
// Line 37: Device ID
#define DEVICE_ID "24"  // Change if needed

// Line 40-41: WiFi credentials
const char* WIFI_SSID = "DECKMOUNTH";  // Your WiFi network
const char* WIFI_PASSWORD = "deckmount";  // Your WiFi password

// Line 33-34: Machine type
#define CPAP_MACHINE true   // Set to true for CPAP
#define BIPAP_MACHINE false // Set to false for CPAP

// Line 59-133: Replace with YOUR actual AWS certificates
static const char AWS_CERT_CA[] PROGMEM = R"EOF(
-----BEGIN CERTIFICATE-----
[YOUR ROOT CA CERTIFICATE]
-----END CERTIFICATE-----
)EOF";

static const char AWS_CERT_CRT[] PROGMEM = R"EOF(
-----BEGIN CERTIFICATE-----
[YOUR DEVICE CERTIFICATE]
-----END CERTIFICATE-----
)EOF";

static const char AWS_CERT_PRIVATE[] PROGMEM = R"EOF(
-----BEGIN RSA PRIVATE KEY-----
[YOUR PRIVATE KEY]
-----END RSA PRIVATE KEY-----
)EOF";
```

⚠️ **IMPORTANT**: You MUST replace the placeholder certificates with your actual AWS IoT certificates!

---

## 🔧 Step 7: Verify Code

1. Click **✓ Verify** button (or **Sketch → Verify/Compile**)
2. Wait for compilation
3. If successful, you'll see:
   ```
   Sketch uses XXXXX bytes (XX%) of program storage space.
   ```

4. **If errors occur:**
   - Check all libraries are installed
   - Check ESP32 board is selected
   - Check certificate format (must include `-----BEGIN` and `-----END` lines)

---

## 🔧 Step 8: Upload to ESP32

1. **Connect ESP32** to your Mac via USB cable
2. **Select correct port** (Tools → Port)
3. **Press and hold BOOT button** on ESP32 (if required for upload)
4. Click **→ Upload** button (or **Sketch → Upload**)
5. **Release BOOT button** when you see "Connecting..."
6. Wait for upload to complete:
   ```
   Hard resetting via RTS pin...
   ```

---

## 🔧 Step 9: Monitor Serial Output

1. After upload, open **Tools → Serial Monitor**
2. Set baud rate to **115200**
3. Press **RESET** button on ESP32
4. You should see:
   ```
   ========================================
   ESP32 BiPAP/CPAP Data Logger
   ========================================
   Mode: CPAP
   Device ID: 24
   Topic: esp32/data24
   ========================================

   🔌 Connecting WiFi..........
   ✅ WiFi connected: 192.168.1.100
   🔌 Connecting to AWS MQTT
   ✅ Connected to AWS MQTT
   📡 Subscribed to config topic: esp32/config24

   ✅ Setup complete. Ready to receive data!
   ```

---

## 🧪 Step 10: Test the Code

### Test 1: Manual Data Input via Serial Monitor

1. In Serial Monitor, type:
   ```
   *,R,141125,1703,MANUALMODE,G,13.6,1.0,H,12.4,12.4,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,12345678C,#
   ```
2. Press **Enter**
3. You should see:
   ```
   --- Manual Frame Input ---
   [Your frame]
   Device Data String: ...
   Publishing JSON: {"device_status":0,"device_data":"...","device_type":"CPAP","device_id":"24"}
   ✅ Published CPAP data to AWS IoT
   ```

### Test 2: Data from STM32

1. Connect STM32 to ESP32:
   - STM32 TX → ESP32 GPIO16 (RXD2)
   - STM32 RX → ESP32 GPIO17 (TXD2)
   - GND → GND
2. Power on STM32
3. STM32 should send data frames automatically
4. ESP32 will parse and publish to AWS IoT

### Test 3: Verify Data in Cloud

1. **AWS IoT Console** → MQTT Test Client → Subscribe to `esp32/data24`
2. You should see messages appearing

3. **Railway Logs** → Check for incoming webhook requests

4. **MongoDB Atlas** → Check your database for saved data with `data_source: "cloud"`

---

## ❌ Troubleshooting

### Error: "Failed to connect to ESP32"

**Solutions:**
- Check USB cable (data cable, not charge-only)
- Press and hold BOOT button during upload
- Try different USB port
- Install USB drivers (CH340 or CP2102)

### Error: "Compilation error: library not found"

**Solutions:**
- Install missing library via Library Manager
- Check library names match exactly

### Error: "WiFi connect failed"

**Solutions:**
- Check WiFi SSID and password are correct
- Check WiFi is 2.4GHz (ESP32 doesn't support 5GHz)
- Move ESP32 closer to router
- Check router allows new devices

### Error: "MQTT connect failed"

**Solutions:**
- Check AWS certificates are correct (no extra spaces/newlines)
- Check AWS endpoint is correct
- Check AWS IoT policy allows connect/publish
- Verify device certificate is active in AWS IoT

### No Serial Output

**Solutions:**
- Press RESET button on ESP32
- Check Serial Monitor baud rate is 115200
- Check correct port is selected
- Try closing and reopening Serial Monitor

### Data Not Appearing in MongoDB

**Solutions:**
- Check Railway logs for errors
- Verify AWS IoT Rule is configured correctly
- Check Rule action URL includes `/api/iot/webhook`
- Verify Rule HTTP method is POST
- Check MongoDB connection string in Railway

---

## 📝 Quick Command Reference

### Arduino IDE Keyboard Shortcuts:

- **Verify**: `Cmd + R` (Mac) / `Ctrl + R` (Windows)
- **Upload**: `Cmd + U` (Mac) / `Ctrl + U` (Windows)
- **Serial Monitor**: `Cmd + Shift + M` (Mac) / `Ctrl + Shift + M` (Windows)

---

## ✅ Success Checklist

- [ ] Arduino IDE installed
- [ ] ESP32 board support installed
- [ ] All libraries installed (WiFi, PubSubClient, ArduinoJson)
- [ ] Code opened in Arduino IDE
- [ ] Board and port selected correctly
- [ ] WiFi credentials updated
- [ ] AWS certificates replaced with actual certificates
- [ ] Device ID configured
- [ ] Machine type selected (CPAP/BiPAP)
- [ ] Code verified successfully
- [ ] Code uploaded to ESP32
- [ ] Serial Monitor showing startup messages
- [ ] WiFi connected
- [ ] AWS IoT connected
- [ ] Test data published successfully
- [ ] Data visible in AWS IoT Console
- [ ] Data saved in MongoDB

---

## 🎯 Next Steps

Once the code is uploaded and working:

1. **Connect STM32** to ESP32 via Serial2
2. **Monitor Serial output** for incoming data
3. **Check AWS IoT Console** for published messages
4. **Verify MongoDB** has saved data
5. **Test config updates** by publishing to `esp32/config24` topic

---

## 📚 Additional Resources

- **ESP32 Arduino Documentation**: https://docs.espressif.com/projects/arduino-esp32/
- **ArduinoJson Documentation**: https://arduinojson.org/
- **PubSubClient Documentation**: https://github.com/knolleary/pubsubclient
- **AWS IoT Core Guide**: See your project's `README.md`

---

**Your code is ready to upload! Follow these steps and your ESP32 will start sending data to the cloud! 🚀**

