-- AWS IoT Core Rule SQL Statement for ESP32 Devices
-- This rule forwards messages from esp32/* topics to the backend

-- Rule SQL for ESP32 devices
SELECT 
    *,
    topic() as topic,
    timestamp() as timestamp,
    messageId() as messageId
FROM 
    'esp32/+'

-- Alternative: More specific pattern for esp32/data* topics
-- SELECT 
--     *,
--     topic() as topic,
--     timestamp() as timestamp,
--     messageId() as messageId
-- FROM 
--     'esp32/data+'

-- Alternative: Include both esp32/24 and esp32/data24 patterns
-- SELECT 
--     *,
--     topic() as topic,
--     timestamp() as timestamp,
--     messageId() as messageId
-- FROM 
--     'esp32/+'

