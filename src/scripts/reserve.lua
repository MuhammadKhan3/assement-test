-- reserve.lua
-- Atomically reserves stock for a user.
-- KEYS[1] = product stock key  e.g. "product:{id}:stock"
-- KEYS[2] = reservation key    e.g. "reservation:{userId}:{productId}"
-- ARGV[1] = quantity to reserve
-- ARGV[2] = TTL in seconds
-- ARGV[3] = reservation JSON payload
--
-- Returns:
--   1  → success
--  -1  → insufficient stock
--  -2  → reservation already exists for this user/product

local stockKey       = KEYS[1]
local reservationKey = KEYS[2]
local qty            = tonumber(ARGV[1])
local ttl            = tonumber(ARGV[2])
local payload        = ARGV[3]

-- Check if reservation already exists
if redis.call("EXISTS", reservationKey) == 1 then
  return -2
end

-- Read current available stock
local available = tonumber(redis.call("GET", stockKey))
if available == nil then
  return -1
end

-- Check there is enough stock
if available < qty then
  return -1
end

-- Decrement available stock
redis.call("DECRBY", stockKey, qty)

-- Set reservation key with TTL
redis.call("SET", reservationKey, payload, "EX", ttl)

return 1
