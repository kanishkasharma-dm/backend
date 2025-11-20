# 🔐 IAM Permissions for AWS IoT Rules Configuration

## Problem
IAM user cannot see or edit HTTP Method (POST) in AWS IoT Core rules.

## Solution: Add IAM Permissions

As the **root account owner**, you need to add specific IAM permissions to your IAM user.

---

## 📋 Step-by-Step: Add Permissions to IAM User

### Step 1: Go to IAM Console

1. **Login to AWS Console as root account**
2. **Go to IAM:**
   - https://console.aws.amazon.com/iam/
   - Or: Services → IAM

3. **Click "Users"** in the left sidebar

4. **Find your IAM user** (e.g., `sanju-cpapbipap-demo`)

5. **Click on the user name**

### Step 2: Add IoT Permissions

**Option A: Attach AWS Managed Policy (Easiest)**

1. **Click "Add permissions"** button
2. **Select "Attach policies directly"**
3. **Search for:** `AWSIoTFullAccess`
4. **Check the box** next to `AWSIoTFullAccess`
5. **Click "Next"** → **"Add permissions"**

✅ **This gives full access to IoT Core (including rules)**

---

**Option B: Attach Specific IoT Rule Permissions (More Secure)**

1. **Click "Add permissions"** button
2. **Select "Create inline policy"**
3. **Click "JSON" tab**
4. **Paste this policy:**

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "iot:DescribeTopicRule",
                "iot:GetTopicRule",
                "iot:CreateTopicRule",
                "iot:ReplaceTopicRule",
                "iot:UpdateTopicRule",
                "iot:DeleteTopicRule",
                "iot:ListTopicRules",
                "iot:EnableTopicRule",
                "iot:DisableTopicRule",
                "iot:GetTopicRuleDestination",
                "iot:CreateTopicRuleDestination",
                "iot:UpdateTopicRuleDestination",
                "iot:DeleteTopicRuleDestination",
                "iot:ListTopicRuleDestinations",
                "iot:TestAuthorization",
                "iot:Connect",
                "iot:Publish",
                "iot:Subscribe",
                "iot:Receive"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "iot:DescribeEndpoint",
                "iot:DescribeAccountAuditConfiguration",
                "iot:DescribeDefaultAuthorizer"
            ],
            "Resource": "*"
        }
    ]
}
```

5. **Click "Next"**
6. **Policy name:** `IoTRulesFullAccess`
7. **Click "Create policy"**

---

**Option C: Minimum Permissions (Most Secure)**

For just editing the existing rule `ForwardESP32DataToBackend`:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "iot:DescribeTopicRule",
                "iot:GetTopicRule",
                "iot:ReplaceTopicRule",
                "iot:UpdateTopicRule",
                "iot:EnableTopicRule",
                "iot:DisableTopicRule"
            ],
            "Resource": "arn:aws:iot:us-east-1:242039786808:rule/ForwardESP32DataToBackend"
        },
        {
            "Effect": "Allow",
            "Action": [
                "iot:ListTopicRules"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "iot:DescribeEndpoint"
            ],
            "Resource": "*"
        }
    ]
}
```

---

## ✅ Recommended: Use AWS Managed Policy

**For fastest setup, use Option A:**

1. IAM → Users → Your User
2. Add permissions → Attach policies directly
3. Search: `AWSIoTFullAccess`
4. Select and attach

This gives all necessary permissions including:
- ✅ View IoT rules
- ✅ Edit IoT rules
- ✅ Configure HTTPS actions
- ✅ Set HTTP Method (POST/GET)
- ✅ Update rule actions
- ✅ Enable/disable rules

---

## 🔍 Verify Permissions Work

After adding permissions:

1. **Have the IAM user log out and log back in** (or refresh AWS console)

2. **Go to IoT Core Rules:**
   - https://us-east-1.console.aws.amazon.com/iot/home?region=us-east-1#/rulehub

3. **Click on rule:** `ForwardESP32DataToBackend`

4. **Click "Edit"**

5. **Scroll to Actions section**

6. **Click on HTTPS action** (or Edit button)

7. **HTTP Method dropdown should now be visible!** ⬅️ This is what you need

---

## 📋 What Permissions Are Needed

### Required Actions:
- `iot:GetTopicRule` - View rule details
- `iot:ReplaceTopicRule` - Update entire rule
- `iot:UpdateTopicRule` - Update rule configuration
- `iot:DescribeTopicRule` - Describe rule settings
- `iot:EnableTopicRule` - Enable/activate rule
- `iot:DisableTopicRule` - Disable rule

### Resource:
- Specific rule ARN: `arn:aws:iot:us-east-1:242039786808:rule/ForwardESP32DataToBackend`
- Or all rules: `*` (for `ListTopicRules`)

---

## 🔒 Security Best Practices

### Option 1: Full Access (Easiest but Less Secure)
- Use: `AWSIoTFullAccess`
- Good for: Development, testing
- Bad for: Production (too broad)

### Option 2: Specific Permissions (Recommended for Production)
- Use: Custom inline policy with only needed actions
- Good for: Production environments
- Bad for: More maintenance

### Option 3: Rule-Specific (Most Secure)
- Use: Permissions only for specific rule ARN
- Good for: Very restricted access
- Bad for: Can't create new rules

---

## 📝 Policy Names to Attach

**Easiest (Full Access):**
```
AWSIoTFullAccess
```

**Custom Policy Name (if creating inline):**
```
IoTRulesFullAccess
```

---

## ⚠️ Important Notes

1. **IAM changes take effect immediately** (but user may need to refresh)

2. **User must log out and log back in** for permissions to fully apply

3. **If using root account:** You already have full permissions - no changes needed

4. **If policy doesn't work:** Check if there are **deny policies** overriding permissions

5. **Multiple policies:** Permissions are additive (unless deny overrides)

---

## 🆘 Troubleshooting

### Issue 1: Permissions added but still can't see HTTP Method
- **Solution:** User must log out and log back in to AWS Console
- Clear browser cache
- Try incognito/private window

### Issue 2: "Access Denied" errors
- **Solution:** Check if there are deny policies attached
- Verify policy was attached correctly
- Check CloudTrail logs for specific permission errors

### Issue 3: Can see rules but can't edit
- **Solution:** Need `iot:ReplaceTopicRule` or `iot:UpdateTopicRule` permission
- Attach `AWSIoTFullAccess` policy for full access

---

## ✅ Quick Checklist for Root Account

1. [ ] Go to IAM Console → Users
2. [ ] Select the IAM user (`sanju-cpapbipap-demo`)
3. [ ] Click "Add permissions"
4. [ ] Select "Attach policies directly"
5. [ ] Search and select: `AWSIoTFullAccess`
6. [ ] Click "Add permissions"
7. [ ] Tell IAM user to log out and log back in
8. [ ] IAM user should now see HTTP Method dropdown

---

## 📞 Summary for Root Account Owner

**What to do:**
1. IAM → Users → Select user
2. Add permissions → Attach `AWSIoTFullAccess` policy
3. Done!

**What this enables:**
- ✅ View IoT rules
- ✅ Edit IoT rules (including HTTP Method)
- ✅ Configure HTTPS actions
- ✅ Set HTTP Method to POST
- ✅ Enable/disable rules

**Time:** 2 minutes

---

**After adding permissions, the IAM user will be able to see and configure the HTTP Method dropdown in IoT Core rules!**

