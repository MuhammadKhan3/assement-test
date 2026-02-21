-- checkout.lua
-- Atomically removes a reservation WITHOUT returning stock
-- (stock was already decremented at reservation time; checkout makes it permanent)
-- KEYS[1] = reservation key  e.g. "reservation:{userId}:{productId}"
--
-- Returns:
--   qty (> 0)  → success
--   0          → reservation not found (expired or already checked out)

local reservationKey = KEYS[1]

local payload = redis.call("GET", reservationKey)

if payload == false then
  return 0
end

local qty = tonumber(string.match(payload, '"qty":(%d+)'))
if qty == nil or qty <= 0 then
  return 0
end

-- Delete reservation key (stock is NOT returned - purchase is finalized)
redis.call("DEL", reservationKey)

return qty
