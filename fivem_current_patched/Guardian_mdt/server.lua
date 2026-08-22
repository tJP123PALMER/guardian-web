
local units = {}

-- Config is loaded by fxmanifest as a shared script.
-- Keep a safe fallback so the server cannot crash if the config is unavailable.
Config = Config or {}
Config.Callsigns = Config.Callsigns or {}

local function IsValidCallsign(callsign)
    for _, cs in ipairs(Config.Callsigns) do
        if string.upper(cs) == string.upper(callsign) then
            return true
        end
    end
    return false
end

RegisterNetEvent('dispatch:setCallsign')
AddEventHandler('dispatch:setCallsign', function(callsign)
    if not callsign then return end
    callsign = string.upper(callsign)
    if not IsValidCallsign(callsign) then return end
    units[callsign] = {source = source, status='AVAILABLE'}
    TriggerClientEvent('control:unitBoard', -1, {
    units = units,
    callsigns = Config.Callsigns
})
end)

RegisterNetEvent('dispatch:statusUpdate')
AddEventHandler('dispatch:statusUpdate', function(status, callsign)

    if not callsign then return end

    -- If the unit isn't in the table yet, add it
    if not units[callsign] then
        units[callsign] = {
            source = source,
            status = status
        }
    end

    -- Update the unit status
    units[callsign].status = status

    -- If they go Off Run, remove them from the active units table
    if status == "OFF RUN" then
        units[callsign] = nil
    end

    TriggerClientEvent('control:statusUpdate', -1, {
        unit = callsign,
        status = status,
        time = os.date('%H:%M:%S')
    })

    TriggerClientEvent('control:unitBoard', -1, {
        units = units,
        callsigns = Config.Callsigns
    })

end)

RegisterNetEvent('dispatch:crewMessage')
AddEventHandler('dispatch:crewMessage', function(message, callsign)
    local src = source
    local item = {
        sender = string.upper(callsign or 'UNIT'),
        text = tostring(message or ''),
        time = os.date('%H:%M:%S'),
        direction = 'mdt_to_control',
        conversation = 'CONTROL'
    }

    -- Echo the sent message back to the sending MDT so it appears
    -- in the same conversation thread, not as a separate local-only item.
    TriggerClientEvent('dispatch:message', src, item)

    -- Send the same message to every Control console.
    TriggerClientEvent('control:crewMessage', -1, item)
end)

RegisterNetEvent('dispatch:ackIncident')
AddEventHandler('dispatch:ackIncident', function(id, callsign)
    TriggerClientEvent('control:ack', -1, {unit=callsign,id=id,time=os.date('%H:%M:%S')})
end)

AddEventHandler('playerDropped', function()
    local src=source
    for cs,data in pairs(units) do
        if data.source==src then units[cs]=nil end
    end
    TriggerClientEvent('control:unitBoard', -1, {
    units = units,
    callsigns = Config.Callsigns
})
end)
