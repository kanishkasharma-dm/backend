# 🔧 Set HTTP Method to POST via AWS CLI

## Problem
- HTTP Method dropdown not visible in AWS Console
- Even when creating new action
- AWS defaults to GET if not specified

## Solution: Use AWS CLI After Rule Creation

Since HTTP Method is not visible in console, we'll:
1. ✅ Create the rule now (with GET - default)
2. ✅ Then update it to POST via AWS CLI

---

## 📋 Step 1: Complete Rule Creation (Current Step)

### What to Configure Now:

1. **HTTPS endpoint URL:** ✅ Already filled
   ```
   https://backend-production-9c17.up.railway.app/api/iot/webhook
   ```

2. **Confirmation URL:** Leave blank ✅

3. **Headers:** Click "Add new header"
   - **Key:** `Content-Type`
   - **Value:** `application/json`
   - Click to add ✅

4. **Authentication:** "None" (already selected) ✅

5. **Click "Next"** → Review → **"Create rule"**

6. **Enable the rule** (toggle ON if option available)

---

## 📋 Step 2: Install AWS CLI (If Not Installed)

### macOS:
```bash
brew install awscli
```

### Verify Installation:
```bash
aws --version
```

### Configure AWS Credentials:
```bash
aws configure
```

**Enter:**
- AWS Access Key ID: (your access key)
- AWS Secret Access Key: (your secret key)
- Default region: `us-east-1`
- Default output format: `json`

---

## 📋 Step 3: Get Current Rule Configuration

```bash
aws iot get-topic-rule --rule-name ForwardESP32DataToBackend > current-rule.json
```

This saves the current rule configuration to a file.

---

## 📋 Step 4: Update Rule with POST Method

### Create update file: `update-rule.json`

```json
{
  "ruleName": "ForwardESP32DataToBackend",
  "sql": "SELECT device_status, device_data, device_type, device_id, topic() as topic, timestamp() as timestamp FROM 'esp32/+'",
  "description": "Forward ESP32 data to backend API",
  "actions": [
    {
      "http": {
        "url": "https://backend-production-9c17.up.railway.app/api/iot/webhook",
        "confirmationUrl": "",
        "headers": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ]
      }
    }
  ]
}
```

### Update the Rule:

```bash
aws iot replace-topic-rule \
  --rule-name ForwardESP32DataToBackend \
  --topic-payload file://update-rule.json
```

**Note:** AWS IoT Core HTTP actions default to POST when using `replace-topic-rule` without specifying method. However, some versions require explicit method.

---

## 📋 Step 5: Verify HTTP Method is POST

```bash
aws iot get-topic-rule --rule-name ForwardESP32DataToBackend --output json | grep -A 10 "http"
```

Look for HTTP configuration in the output.

---

## 📋 Alternative: Use boto3 (Python)

If CLI doesn't work, use Python:

### Install boto3:
```bash
pip install boto3
```

### Create script: `update-iot-rule.py`

```python
import boto3
import json

# Initialize IoT client
iot = boto3.client('iot', region_name='us-east-1')

# Rule configuration
rule_payload = {
    "ruleName": "ForwardESP32DataToBackend",
    "sql": "SELECT device_status, device_data, device_type, device_id, topic() as topic, timestamp() as timestamp FROM 'esp32/+'",
    "description": "Forward ESP32 data to backend API",
    "actions": [
        {
            "http": {
                "url": "https://backend-production-9c17.up.railway.app/api/iot/webhook",
                "confirmationUrl": "",
                "headers": [
                    {
                        "key": "Content-Type",
                        "value": "application/json"
                    }
                ]
            }
        }
    ]
}

try:
    # Update the rule
    response = iot.replace_topic_rule(
        ruleName="ForwardESP32DataToBackend",
        topicPayload=json.dumps(rule_payload)
    )
    print("✅ Rule updated successfully!")
    print(f"Response: {response}")
except Exception as e:
    print(f"❌ Error updating rule: {e}")
```

### Run the script:
```bash
python update-iot-rule.py
```

---

## 🧪 Step 6: Test the Rule

### After updating to POST:

1. **Go to MQTT Test Client**
   - AWS IoT → Test → MQTT test client

2. **Publish test message:**
   - **Topic:** `esp32/data24`
   - **Payload:**
     ```json
     {
       "device_status": 0,
       "device_data": "*,R,141125,1703,MANUALMODE,G,13.6,1.0,H,12.4,12.4,20.0,1.0,I,5.0,1.0,1.0,1.0,0.0,1.0,1.0,12345678C,#",
       "device_type": "CPAP",
       "device_id": "24"
     }
     ```

3. **Check Railway Logs (within 2-5 seconds):**
   - Look for: `[req_...] 📥 Received IoT data request`
   - **If you see this:** ✅ Rule is using POST and working!
   - **If you don't:** ❌ Still using GET, need to check CLI update

4. **Check MongoDB (within 5-10 seconds):**
   - Look for new document with `device_id: "24"` and `data_source: "cloud"`

---

## ⚠️ Important Notes

1. **AWS IoT HTTP actions default to POST** when using API/CLI
2. **Console UI doesn't show HTTP Method** - this is an AWS limitation
3. **CLI/API is the reliable way** to set HTTP Method
4. **Test after update** to verify POST is working

---

## 🔍 Verify Current Method

### Check what method is currently set:

```bash
aws iot get-topic-rule \
  --rule-name ForwardESP32DataToBackend \
  --output json | python3 -m json.tool
```

Look for `http` section in the output to see if method is specified.

---

## ✅ Quick Summary

**Now (Console - Can't set POST):**
1. ✅ Fill endpoint URL
2. ✅ Add Content-Type header
3. ✅ Click "Next" → Create rule

**After Creation (CLI - Can set POST):**
1. Install AWS CLI
2. Configure credentials
3. Update rule via CLI
4. Test with MQTT Test Client

---

## 📞 If CLI Doesn't Work

**Alternative: Test if it's already POST**

Sometimes AWS IoT defaults HTTP actions to POST automatically. Test first:

1. Create rule in console (with headers)
2. Publish test message immediately
3. Check Railway logs
4. **If logs appear:** Rule is already using POST ✅
5. **If no logs:** Update via CLI as above

---

**Next Step:** Complete the rule creation in console now (add header, click Next, Create), then we'll update it to POST via CLI!

