local incidentCache = {}
local nuiOpen = false
local playerCallsign = 'UNSET'
local ALERT_HEARING_DISTANCE = 10.0

local function GetNearbyAlertVehicle(distance)
    local ped = PlayerPedId()
    local pos = GetEntityCoords(ped)

    for _, vehicle in ipairs(GetGamePool('CVehicle')) do
        local model = GetEntityModel(vehicle)

        if Config.AlertVehicles and Config.AlertVehicles[model] then
            local vehPos = GetEntityCoords(vehicle)

            if #(pos - vehPos) <= distance then
                return vehicle
            end
        end
    end

    return nil
end

local function IsInFrontPassengerSeat()
    local ped = PlayerPedId()
    if not IsPedInAnyVehicle(ped, false) then return false end
    local veh = GetVehiclePedIsIn(ped, false)
    return GetPedInVehicleSeat(veh, 0) == ped
end


RegisterCommand('getec', function()

    local ped = PlayerPedId()

    if not IsPedInAnyVehicle(ped, false) then
        print("^1You must be inside an appliance.^7")
        return
    end

    local veh = GetVehiclePedIsIn(ped, false)
    local model = GetEntityModel(veh)

    if not Config.AlertVehicles[model] then
        print("^1This vehicle has no MDT.^7")
        return
    end

    nuiOpen = true
    SetNuiFocus(true, true)

    SendNUIMessage({
        type = "open"
    })

    SendNUIMessage({
        type = "setCallsign",
        callsign = playerCallsign
    })

    SendNUIMessage({
        type = "loadIncidents",
        incidents = incidentCache
    })

end)

RegisterNUICallback('sendMessage', function(data, cb)

    TriggerServerEvent(
        'dispatch:crewMessage',
        data.message,
        playerCallsign
    )

    cb('ok')

end)

RegisterNetEvent('dispatch:newIncident', function(inc)

    -- Always cache the incident
    table.insert(incidentCache, inc)

    local ped = PlayerPedId()
    local shouldPlayAlert = false
    local shouldOpenPopup = false
    local playAlertFromControl = inc.playAlert ~= false

    -- Only alert/open if already inside an alert vehicle
    if IsPedInAnyVehicle(ped, false) then

        local veh = GetVehiclePedIsIn(ped, false)

        if veh ~= 0 then

            local model = GetEntityModel(veh)

            if Config.AlertVehicles and Config.AlertVehicles[model] then

                shouldPlayAlert = playAlertFromControl

                if GetPedInVehicleSeat(veh, 0) == ped then
    shouldOpenPopup = true
end

            end

        end

    end

    -- Always send incident to the MDT cache/UI
    SendNUIMessage({
        type = "incident",
        item = inc
    })

    if shouldPlayAlert then
        SendNUIMessage({
            type = "alert"
        })
    end

    if shouldOpenPopup then

        print("^3SENDING OPEN^7")

        nuiOpen = true
        SetNuiFocus(true, true)

        SendNUIMessage({
            type = "open"
        })

        SendNUIMessage({
            type = "setCallsign",
            callsign = playerCallsign
        })

        SendNUIMessage({
            type = "mobilising"
        })

    end

end)
RegisterNetEvent('dispatch:message', function(msg)
    print(('^2[Guardian MDT]^7 Message received from %s: %s'):format(
        tostring(msg and msg.sender or 'CONTROL'),
        tostring(msg and msg.text or '')
    ))

    SendNUIMessage({
        type = 'message',
        item = msg
    })
end)

RegisterCommand('callsign', function(_, args)
    local cs = string.upper(table.concat(args, ' '))

    if cs == '' then
        return
    end

    playerCallsign = cs
print("^2CALLSIGN SET TO:^7 " .. playerCallsign)
print("^3SENDING CALLSIGN TO NUI^7")
    SendNUIMessage({
        type = 'setCallsign',
        callsign = playerCallsign
    })

    TriggerServerEvent('dispatch:setCallsign', playerCallsign)
end)

RegisterNUICallback('setIncidentWaypoint', function(data, cb)
    local x = tonumber(data and data.x)
    local y = tonumber(data and data.y)
    if x and y then
        SetNewWaypoint(x, y)
        cb({ok = true})
        return
    end
    cb({ok = false})
end)

RegisterNUICallback('ackIncident', function(data, cb)

    print("^2ACK SENT TO SERVER:^7", data.id, playerCallsign)

    TriggerServerEvent(
        'dispatch:ackIncident',
        data.id,
        playerCallsign
    )

    cb('ok')

end)

RegisterNUICallback('close', function(_, cb)

    nuiOpen = false

    SetNuiFocus(false, false)

    SendNUIMessage({
        type = "close"
    })

    cb("ok")

end)

RegisterNUICallback('sendStatus', function(data, cb)

    print("^2STATUS SENT:^7", data.status, playerCallsign)

    TriggerServerEvent(
        'dispatch:statusUpdate',
        data.status,
        playerCallsign
    )

    cb('ok')

end)

RegisterCommand("offrun", function()

    if playerCallsign == "UNSET" then
        print("^1You are not signed on.^7")
        return
    end

    TriggerServerEvent("dispatch:statusUpdate", "OFF RUN", playerCallsign)

    playerCallsign = "UNSET"

    SendNUIMessage({
        type = "setCallsign",
        callsign = "UNSET"
    })

    print("^2Booked off successfully.^7")

end)
-- Keyboard shortcut: F4 opens MDT. /getec remains available.
RegisterKeyMapping('getec', 'Open Guardian MDT', 'keyboard', 'F4')

CreateThread(function()
    while true do
        Wait(250)
        if nuiOpen then
            local ped = PlayerPedId()
            local c = GetEntityCoords(ped)
            local heading = GetEntityHeading(ped)
            SendNUIMessage({
                type = 'gpsPosition',
                x = c.x,
                y = c.y,
                z = c.z,
                heading = heading,
                speed = GetEntitySpeed(ped),
                satellites = 8,
                easting = math.floor((c.x + 500000) % 1000000),
                northing = math.floor((c.y + 500000) % 1000000),
                screenX = 50,
                screenY = 50
            })
        end
    end
end)


-- Keep the physical in-game MDT synchronized when the same appliance
-- sends a status from the browser Player MDT.
RegisterNetEvent('guardian_web:mdtStatusSync', function(status)
    SendNUIMessage({
        type = 'setStatus',
        status = status
    })
end)
