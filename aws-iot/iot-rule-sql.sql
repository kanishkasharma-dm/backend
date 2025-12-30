-- AWS IoT Core Rule SQL Statement
-- This SQL query selects messages from devices and forwards them to backend

-- Example 1: Forward all device data messages
SELECT 
    *,
    topic() as topic,
    timestamp() as timestamp,
    messageId() as messageId
FROM 
    'devices/+/data'

-- Example 2: Forward specific device types
SELECT 
    *,
    topic() as topic,
    timestamp() as timestamp,
    device_type,
    device_id,
    device_status,
    device_data
FROM 
    'devices/+/data'
WHERE 
    device_type IN ('CPAP', 'BIPAP')

-- Example 3: Transform message format
SELECT 
    device_id as thingName,
    device_type,
    device_status,
    device_data,
    topic() as topic,
    timestamp() as timestamp,
    messageId() as messageId
FROM 
    'devices/+/data'

