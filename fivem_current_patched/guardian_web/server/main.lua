local commandCursor = {}
local webBookings = {}

local function upper(v)
    return string.upper(tostring(v or "")):gsub("%s+", "")
end

local function mergeWebBookings(snapshot)
    snapshot = snapshot or {}
    snapshot.units = snapshot.units or {}
    snapshot.callsigns = snapshot.callsigns or {}
    snapshot.bookings = snapshot.bookings or {}

    local seen = {}
    for _, cs in ipairs(snapshot.callsigns) do seen[upper(cs)] = true end

    for cs, booking in pairs(webBookings) do
        local key = upper(cs)
        if key ~= "" then
            local existing = snapshot.units[key]
            if type(existing) ~= "table" then
                existing = {}
                snapshot.units[key] = existing
            end

            existing.callsign = key
            existing.status = booking.status or existing.status or "Home Station"
            existing.webBooked = true
            existing.webOnly = existing.source == nil

            snapshot.bookings[key] = {
                callsign = key,
                status = existing.status,
                webBooked = true,
                bookedAt = booking.bookedAt
            }

            if not seen[key] then
                snapshot.callsigns[#snapshot.callsigns + 1] = key
                seen[key] = true
            end
        end
    end

    return snapshot
end

local function api(path, method, body, cb)
    PerformHttpRequest(Config.WebApi .. path, function(status, response, headers, err)
        if status < 200 or status >= 300 then
            print(("^1[Guardian Web] HTTP %s^7 %s %s"):format(status or -1, method or "GET", path))
            if response then print(("^3[Guardian Web] %s^7"):format(response)) end
        end
        if cb then cb(status, response, headers, err) end
    end, method or "GET", body and json.encode(body) or "", {
        ["Content-Type"] = "application/json",
        ["x-guardian-key"] = Config.ApiKey
    })
end

local function getSnapshot()
    local ok, snapshot = pcall(function()
        return exports["Guardian_control"]:GetGuardianWebSnapshot()
    end)

    if ok and snapshot then
        snapshot.tracking = snapshot.tracking or {}
        snapshot.bookings = snapshot.bookings or {}
        return mergeWebBookings(snapshot)
    end

    return mergeWebBookings({
        units = {},
        incidents = {},
        calls999 = {},
        messages = {},
        callsigns = {},
        callSignStations = {},
        applianceSkills = {},
        tracking = {},
        bookings = {}
    })
end

local function publish()
    api("/api/fivem/state", "POST", getSnapshot())
end

CreateThread(function()
    Wait(2000)
    publish()

    while true do
        Wait(Config.HeartbeatMs)
        publish()
    end
end)

CreateThread(function()
    while true do
        Wait(Config.PollMs)
        api("/api/fivem/commands", "GET", nil, function(status, response)
            if status ~= 200 or not response then return end

            local ok, decoded = pcall(json.decode, response)
            if not ok or not decoded or not decoded.commands then return end

            for _, cmd in ipairs(decoded.commands) do
                if not commandCursor[cmd.id] then
                    commandCursor[cmd.id] = true
                    local data = cmd.data or {}

                    if cmd.action == "createStandbyIncident" then
                        TriggerEvent("control:createStandbyIncident", data)
                    elseif cmd.action == "createIncident" then
                        TriggerEvent("control:createIncident", data)
                    elseif cmd.action == "updateIncident" or cmd.action == "updateIncidentDetails" then
                        TriggerEvent("control:updateIncidentDetails", data)
                    elseif cmd.action == "closeIncident" then
                        TriggerEvent("control:closeIncident", data)
                    elseif cmd.action == "reopenIncident" then
                        TriggerEvent("control:reopenIncident", data)
                    elseif cmd.action == "assignAppliance" or cmd.action == "mobiliseAppliance" then
                        TriggerEvent("control:assignAppliance", data)
                    elseif cmd.action == "unassignAppliance" then
                        TriggerEvent("control:unassignAppliance", data)
                    elseif cmd.action == "sendMessage" or cmd.action == "webMdtMessage" then
                        TriggerEvent("control:sendMessage", data)
                    elseif cmd.action == "createResourceRequest" then
                        TriggerEvent("control:createResourceRequest", data)
                    elseif cmd.action == "standbyMove" then
                        TriggerEvent("control:standbyMove", data)
                    elseif cmd.action == "dismiss999Call" then
                        TriggerEvent("control:dismiss999Call", data.id)
                    elseif cmd.action == "setApplianceCrew" then
                        TriggerEvent("control:setApplianceCrew", data)
                    elseif cmd.action == "setCrewMember" then
                        TriggerEvent("control:setCrewMember", data)
                    elseif cmd.action == "setIncidentRole" then
                        TriggerEvent("control:setIncidentRole", data)
                    elseif cmd.action == "webBookOn" then
                        local cs = upper(data.callsign)
                        if cs ~= "" then
                            webBookings[cs] = {
                                callsign = cs,
                                status = tostring(data.status or "Home Station"),
                                bookedAt = os.time()
                            }
                            -- Optional integration with newer Guardian_control builds.
                            TriggerEvent("control:webBookOn", {
                                callsign = cs,
                                status = webBookings[cs].status
                            })
                            SetTimeout(50, publish)
                        end
                    elseif cmd.action == "webBookOff" then
                        local cs = upper(data.callsign)
                        if cs ~= "" then
                            webBookings[cs] = nil
                            TriggerEvent("control:webBookOff", { callsign = cs })
                            SetTimeout(50, publish)
                        end
                    elseif cmd.action == "webMdtStatus" then
                        local cs = upper(data.callsign)
                        if cs ~= "" then
                            if webBookings[cs] then
                                webBookings[cs].status = tostring(data.status or webBookings[cs].status or "Home Station")
                            end
                            TriggerEvent("control:webMdtStatus", {
                                callsign = cs,
                                status = tostring(data.status or "Home Station")
                            })
                            -- Also publish a status event for older Control builds that
                            -- already listen to dispatch:statusUpdate.
                            TriggerEvent("dispatch:statusUpdate", tostring(data.status or "Home Station"), cs)
                            SetTimeout(50, publish)
                        end
                    elseif cmd.action == "webMdtAck" then
                        TriggerEvent("control:webMdtAck", data)
                    elseif cmd.action == "returnStandbyMove" then
                        TriggerEvent("control:returnStandbyMove", data)
                    elseif cmd.action == "cancelStandbyMove" then
                        TriggerEvent("control:cancelStandbyMove", data)
                    elseif cmd.action == "ackStandbyMove" then
                        TriggerEvent("control:ackStandbyMove", data)
                    elseif cmd.action == "requestStatus" then
                        TriggerEvent("control:requestStatus", data)
                    elseif cmd.action == "setSceneStatus" then
                        TriggerEvent("control:setSceneStatus", data)
                    end

                    api("/api/fivem/commands/" .. cmd.id .. "/ack", "POST", {})
                end
            end
        end)
    end
end)

print("^2[Guardian Web]^7 Live Operations v2.3.1 bridge started (web booking enabled).")
