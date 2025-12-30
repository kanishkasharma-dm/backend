# 📍 Where to Set POST Method in AWS IoT Rule

## Current Status
✅ **SQL Statement is correct:** `SELECT *, topic() as topic, timestamp() as timestamp FROM 'esp32/+'`

## Next Step: Configure Actions Section

### 🔍 How to Find the Actions Section

1. **Scroll down** on the same page (below the SQL statement)

2. **Look for a section titled:**
   - **"Actions"** or
   - **"Set one or more actions"** or
   - **"Choose an action"**

3. **Click "Add action"** (if no action is configured yet)
   - Or click on existing action to edit it

---

## ⚙️ Configure HTTPS Action

### Step 1: Select Action Type
- **Action:** Select **"HTTPS"** from the dropdown
- Click **"Configure action"** or **"Next"**

### Step 2: Configure HTTPS Settings

#### **Endpoint URL:**
```
https://backend-production-9c17.up.railway.app/api/iot/webhook
```

#### **HTTP Method:**
- Select **"POST"** from the dropdown ✅
- (This is where you set the POST method!)

#### **Headers:**
- Click **"Add header"**
- **Key:** `Content-Type`
- **Value:** `application/json`

#### **Message Payload Template:**
Click on **"Use message content"** or **"Custom"** and paste:

```json
{
  "device_status": ${device_status},
  "device_data": "${device_data}",
  "device_type": "${device_type}",
  "device_id": "${device_id}",
  "topic": "${topic()}"
}
```

**OR** if using `SELECT *` (which you are), you can use:

```json
{
  "device_status": ${device_status},
  "device_data": "${device_data}",
  "device_type": "${device_type}",
  "device_id": "${device_id}",
  "topic": "${topic()}",
  "timestamp": "${timestamp()}"
}
```

### Step 3: Save the Action
- Click **"Add action"** or **"Save"** or **"Update"**
- Then click **"Save"** at the bottom of the page to save the entire rule

---

## 📝 Visual Guide

```
┌─────────────────────────────────────────┐
│ Edit rule: ForwardESP32DataToBackend   │
├─────────────────────────────────────────┤
│ Rule properties                         │
│ ┌─────────────────────────────────────┐ │
│ │ Rule description - optional         │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ SQL statement                           │
│ ┌─────────────────────────────────────┐ │
│ │ SELECT *, topic() as topic...       │ │
│ │ FROM 'esp32/+'                      │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │  ⬇️ SCROLL DOWN HERE ⬇️             │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Actions ⬅️ LOOK FOR THIS SECTION       │
│ ┌─────────────────────────────────────┐ │
│ │ [Add action] button                 │ │
│ │                                     │ │
│ │ OR existing action:                 │ │
│ │ HTTPS: https://backend...           │ │
│ │ [Edit] [Remove]                     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [Cancel] [Save rule]                   │
└─────────────────────────────────────────┘
```

---

## ✅ Complete Configuration Checklist

### SQL Statement (✅ Already correct):
- [x] SQL: `SELECT *, topic() as topic, timestamp() as timestamp FROM 'esp32/+'`

### Actions Section (⬅️ Do this now):
- [ ] Action Type: **HTTPS**
- [ ] Endpoint URL: `https://backend-production-9c17.up.railway.app/api/iot/webhook`
- [ ] **HTTP Method: POST** ⬅️ This is what you're looking for!
- [ ] Header: `Content-Type: application/json`
- [ ] Message Payload Template: JSON with all fields

---

## 🔧 If You Don't See Actions Section

1. **Check if you're on the right page:**
   - URL should end with `/edit`
   - Page title should say "Edit rule: ForwardESP32DataToBackend"

2. **Scroll down further:**
   - Actions section is usually below the SQL statement
   - Sometimes there's a lot of whitespace

3. **Look for buttons:**
   - "Add action" button
   - "Set one or more actions" section
   - "Choose an action" dropdown

4. **If action already exists:**
   - You'll see the configured action listed
   - Click "Edit" or the action itself to modify it

---

## 📸 What It Should Look Like

When you find the Actions section and configure HTTPS, you should see:

```
Actions
┌─────────────────────────────────────────────┐
│ HTTPS                                       │
│ Endpoint URL: https://backend...webhook    │
│ HTTP method: POST ⬅️ (Dropdown: POST)      │
│ Headers: Content-Type: application/json    │
│ Message payload: { ... }                   │
│ [Edit] [Remove]                            │
└─────────────────────────────────────────────┘

[Add action]  [Save rule]
```

---

## ⚠️ Important Notes

1. **HTTP Method:** Must be set to **POST** (not GET)
2. **Endpoint URL:** Must be exact (no trailing slash)
3. **Headers:** Must include `Content-Type: application/json`
4. **Message Payload:** Must match API expectations

---

## ✅ After Configuration

1. **Save the rule**
2. **Verify rule is enabled** (toggle should be ON/green)
3. **Test by publishing a message** to `esp32/data24` from MQTT test client
4. **Check Railway logs** for incoming requests
5. **Check MongoDB** for saved data

---

**Summary:** Scroll down below the SQL statement, find the "Actions" section, click "Add action" or edit existing action, select "HTTPS", set HTTP Method to "POST", enter the endpoint URL, and save!

