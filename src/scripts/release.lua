-- release.lua
-- Atomically releases a reservation and returns stock.
-- KEYS[1] = product stock key  e.g. "product:{id}:stock"
-- KEYS[2] = reservation key    e.g. "reservation:{userId}:{productId}"
--
-- Returns:
--   qty released (> 0)  → success
--   0                   → reservation did not exist (already expired or cancelled)

local stockKey       = KEYS[1]
local reservationKey = KEYS[2]

-- Read and delete the reservation atomically
local payload = redis.call("GET", reservationKey)

if payload == false then
  return 0
end

-- Parse qty from the JSON payload (simple extraction)
local qty = tonumber(string.match(payload, '"qty":(%d+)'))
if qty == nil or qty <= 0 then
  return 0
end

-- Delete reservation
redis.call("DEL", reservationKey)

-- Return stock
redis.call("INCRBY", stockKey, qty)

return qty
