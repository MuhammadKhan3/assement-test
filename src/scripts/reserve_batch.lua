-- reserve_batch.lua
-- Atomically reserves stock for multiple items for a user.
-- KEYS[2i-1] = product stock key  e.g. "product:{id}:stock"
-- KEYS[2i]   = reservation key    e.g. "reservation:{userId}:{productId}"
-- ARGV[1]    = TTL in seconds
-- ARGV[2i]   = quantity to reserve for item i
-- ARGV[2i+1] = reservation JSON payload for item i
--
-- Returns:
--   1  → success (all items reserved)
--  -1  → insufficient stock (for at least one item)
--  -2  → reservation already exists for this user (for at least one item)

local ttl = tonumber(ARGV[1])
local numItems = #KEYS / 2

-- Step 1: Validate all items (lock-check + stock-check)
for i = 1, numItems do
  local stockKey = KEYS[i * 2 - 1]
  local resKey   = KEYS[i * 2]
  local qty      = tonumber(ARGV[i * 2])
  
  -- Check if reservation already exists
  if redis.call("EXISTS", resKey) == 1 then
    return -2
  end
  
  -- Read current available stock
  local available = tonumber(redis.call("GET", stockKey))
  if available == nil or available < qty then
    return -1
  end
end

-- Step 2: Perform decrements and set reservations
for i = 1, numItems do
  local stockKey = KEYS[i * 2 - 1]
  local resKey   = KEYS[i * 2]
  local qty      = tonumber(ARGV[i * 2])
  local payload  = ARGV[i * 2 + 1]
  
  redis.call("DECRBY", stockKey, qty)
  redis.call("SET", resKey, payload, "EX", ttl)
end

return 1
