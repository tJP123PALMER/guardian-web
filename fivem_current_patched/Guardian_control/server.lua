
-- Use the exact nearest-postal dataset supplied with this server.
local guardianPostals = {}
do
    local raw = LoadResourceFile('postals', 'new-postals.json')
    if raw then
        local ok, data = pcall(json.decode, raw)
        if ok and type(data) == 'table' then
            for _, p in ipairs(data) do
                if p.code and p.x and p.y then
                    guardianPostals[string.upper(tostring(p.code)):gsub('%s+', '')] = {
                        x = tonumber(p.x), y = tonumber(p.y), z = tonumber(p.z) or 0.0
                    }
                end
            end
        end
    end
end
local function guardianPostalCoords(postal)
    return guardianPostals[string.upper(tostring(postal or '')):gsub('%s+', '')]
end


local incidentHistory={}
local activeUnits={}
local pending999Calls = {}
local webMessageHistory = {}


Config = Config or {}
Config.Callsigns = Config.Callsigns or {}

local function BuildCallsignSkills()
    local out = {}
    local configured = Config.CallSignSkills or {}

    local function add(cs)
        local clean = tostring(cs or ''):gsub('%s+', '')
        if clean == '' then return end

        local key = string.upper(clean)
        local skill = configured[clean] or configured[key]

        -- Support config keys with different capitalisation.
        if not skill then
            for k, v in pairs(configured) do
                if string.upper(tostring(k):gsub('%s+', '')) == key then
                    skill = v
                    break
                end
            end
        end

        out[key] = tostring(skill or 'General Appliance')
    end

    for _, cs in ipairs(Config.Callsigns or {}) do add(cs) end
    for cs, _ in pairs(Config.CallSignStations or {}) do add(cs) end
    for cs, _ in pairs(activeUnits or {}) do add(cs) end

    return out
end

local function BuildStationMap()
    local out = {}
    for k, v in pairs(Config.CallSignStations or {}) do
        out[string.upper(tostring(k)):gsub('%s+', '')] = v
    end
    return out
end


local function BuildAllCallsigns()
    local found = {}
    local ordered = {}

    local function add(cs)
        cs = tostring(cs or '')
        local clean = cs:gsub('%s+', '')
        if clean == '' then return end
        local key = string.upper(clean)
        if not found[key] then
            found[key] = true
            ordered[#ordered + 1] = clean
        end
    end

    for _, cs in ipairs(Config.Callsigns or {}) do add(cs) end
    for cs, _ in pairs(Config.CallSignStations or {}) do add(cs) end
    for cs, _ in pairs(Config.ApplianceResources or {}) do add(cs) end
    for cs, _ in pairs(activeUnits or {}) do add(cs) end

    table.sort(ordered, function(a,b) return string.upper(a) < string.upper(b) end)
    return ordered
end

local function BroadcastUnitBoard(target)
    TriggerEvent('guardian_web:stateDirty')
    TriggerClientEvent('control:unitBoard', target or -1, {
        units = activeUnits,
        callsigns = BuildAllCallsigns(),
        callSignStations = BuildStationMap(),
        applianceSkills = BuildCallsignSkills()
    })
end

RegisterNetEvent('dispatch:setCallsign', function(callsign)
    if not callsign or callsign == '' then return end
    callsign = string.upper(callsign)

    -- A player can only be signed onto one callsign at a time. Clear any
    -- previous callsign owned by this source so incidents cannot keep
    -- targeting the same player through an old callsign.
    for oldCallsign, data in pairs(activeUnits) do
        if type(data) == 'table' and data.source == source and oldCallsign ~= callsign then
            activeUnits[oldCallsign] = nil
        end
    end

    activeUnits[callsign] = {
        source = source,
        status = 'AVAILABLE'
    }

    BroadcastUnitBoard()
end)

RegisterNetEvent('dispatch:statusUpdate', function(status, callsign)
    if not callsign or callsign == '' then return end
    callsign = string.upper(callsign)

    activeUnits[callsign] = activeUnits[callsign] or {
        source = source
    }

    activeUnits[callsign].source = source
    activeUnits[callsign].status = status or 'AVAILABLE'

    -- Keep the MDT's real operational status even while the appliance is
    -- committed to an incident.  Availability for dispatch is tracked
    -- separately from the radio/MDT status.
    if string.upper(status or '') == 'OFF RUN' then
        for _, inc in ipairs(incidentHistory) do
            if inc.status ~= 'CLOSED' then
                for _, assigned in ipairs(inc.assignedUnits or {}) do
                    if string.upper(tostring(assigned)) == callsign then
                        inc.applianceStatuses = inc.applianceStatuses or {}
                        inc.applianceStatuses[callsign] = 'OFF RUN'
                    end
                end
            end
        end
        activeUnits[callsign] = nil
    else
        for _, inc in ipairs(incidentHistory) do
            if inc.status ~= 'CLOSED' then
                for _, assigned in ipairs(inc.assignedUnits or {}) do
                    if string.upper(tostring(assigned)) == callsign then
                        inc.applianceStatuses = inc.applianceStatuses or {}
                        inc.applianceStatuses[callsign] = status or 'AVAILABLE'
                    end
                end
            end
        end
    end

    BroadcastUnitBoard()
    BroadcastOngoingIncidents()
end)

RegisterNetEvent('control:requestUnitBoard', function()
    BroadcastUnitBoard(source)
end)

AddEventHandler('playerDropped', function()
    local src = source
    local changed = false

    for callsign, unit in pairs(activeUnits) do
        if type(unit) == 'table' and unit.source == src then
            activeUnits[callsign] = nil
            changed = true
        elseif unit == src then
            activeUnits[callsign] = nil
            changed = true
        end
    end

    if changed then
        BroadcastUnitBoard()
    end
end)


local function IsApplianceAssignedToOpenIncident(callsign, exceptIncidentId)
    callsign = string.upper(tostring(callsign or ''))
    for _, other in ipairs(incidentHistory) do
        if other.status ~= 'CLOSED' and tonumber(other.id) ~= tonumber(exceptIncidentId) then
            for _, assigned in ipairs(other.assignedUnits or {}) do
                if string.upper(tostring(assigned)) == callsign then
                    return true, other.id
                end
            end
        end
    end
    return false, nil
end

local function RefreshApplianceAvailability(callsign)
    callsign = string.upper(tostring(callsign or ''))
    local unit = activeUnits[callsign]
    if not unit then return end

    local busy = IsApplianceAssignedToOpenIncident(callsign)
    if busy then
        unit.status = 'MOBILISED'
    elseif string.upper(tostring(unit.status or '')) == 'MOBILISED' or string.upper(tostring(unit.status or '')) == 'BUSY' then
        unit.status = 'AVAILABLE'
    end
end

local function RefreshIncidentApplianceStatuses(inc)
    inc.applianceStatuses = inc.applianceStatuses or {}
    for _, callsign in ipairs(inc.assignedUnits or {}) do
        local cs = string.upper(tostring(callsign or ''))
        local unit = activeUnits[cs]
        if unit and unit.status and unit.status ~= '' then
            inc.applianceStatuses[cs] = unit.status
        elseif not inc.applianceStatuses[cs] or inc.applianceStatuses[cs] == '' then
            inc.applianceStatuses[cs] = 'MOBILISED TO THIS INCIDENT'
        end
    end
end

local function AddIncidentTimeline(inc, text, callsign)
    inc.timeline = inc.timeline or {}
    inc.timeline[#inc.timeline + 1] = {
        time = os.date('%H:%M:%S'),
        text = tostring(text or ''),
        callsign = callsign and string.upper(tostring(callsign)) or nil
    }
    if #inc.timeline > 150 then
        table.remove(inc.timeline, 1)
    end
end

local function BroadcastOngoingIncidents(target)
    TriggerEvent('guardian_web:stateDirty')
    local list = {}
    for _, inc in ipairs(incidentHistory) do
        if inc.status ~= 'CLOSED' then
            RefreshIncidentApplianceStatuses(inc)
            list[#list+1] = inc
        end
    end
    TriggerClientEvent('control:ongoingIncidents', target or -1, list)
end

RegisterNetEvent('control:requestOngoingIncidents', function()
    BroadcastOngoingIncidents(source)
end)


RegisterNetEvent('control:assignAppliance', function(data)
    data = data or {}
    local incidentId = tonumber(data.incidentId)
    local callsign = string.upper(tostring(data.callsign or ''))
    local assign = data.assign ~= false
    if not incidentId or callsign == '' then return end

    for _, inc in ipairs(incidentHistory) do
        if tonumber(inc.id) == incidentId and inc.status ~= 'CLOSED' then
            inc.assignedUnits = inc.assignedUnits or {}

            -- Mobilisation options are controlled from the Ongoing Incidents
            -- screen.  Keep the selected options on the incident so every
            -- pump subsequently mobilised follows the same dispatch choice.
            if assign then
                if data.enableMDT ~= nil then inc.sendMDT = data.enableMDT == true end
                if data.enablePager ~= nil then inc.sendPager = data.enablePager == true end
                if data.enableTurnout ~= nil then inc.sendTurnout = data.enableTurnout == true end
            end

            local exists = false
            for _, cs in ipairs(inc.assignedUnits) do
                if string.upper(tostring(cs)) == callsign then exists = true break end
            end
            local newlyAssigned = false

            if assign and not exists then
                -- A pump can only belong to one open incident at a time.
                -- The UI filters these out, but enforce it server-side too.
                local alreadyBusy, busyIncident = IsApplianceAssignedToOpenIncident(callsign, inc.id)
                if alreadyBusy then
                    print(('[Guardian Control] Refused %s: already mobilised to incident #%s'):format(callsign, tostring(busyIncident)))
                    BroadcastOngoingIncidents(source)
                    BroadcastUnitBoard(source)
                    return
                end
                inc.assignedUnits[#inc.assignedUnits+1] = callsign
                inc.applianceStatuses = inc.applianceStatuses or {}
                inc.applianceStatuses[callsign] = 'MOBILISED TO THIS INCIDENT'
                AddIncidentTimeline(inc, callsign .. ' mobilised to incident', callsign)
                newlyAssigned = true
                -- Do not overwrite the MDT's actual radio status.  The
                -- appliance is unavailable for dispatch because it is in
                -- assignedUnits, while its live status remains separate.
            elseif not assign and exists then
                for n = #inc.assignedUnits, 1, -1 do
                    if string.upper(tostring(inc.assignedUnits[n])) == callsign then
                        table.remove(inc.assignedUnits, n)
                    end
                end
                if inc.applianceStatuses then
                    inc.applianceStatuses[callsign] = nil
                end
                AddIncidentTimeline(inc, callsign .. ' released from incident', callsign)
                RefreshApplianceAvailability(callsign)
            end

            -- When a pump is assigned after dispatch, mobilise it to the incident.
            -- IMPORTANT: `exists` is calculated before the new assignment is
            -- inserted, so on the first mobilisation it is false.  Use the
            -- post-assignment state instead; otherwise MDT/Turnout/Pager never
            -- fire for a newly mobilised appliance.
            if assign and newlyAssigned then
                local unit = activeUnits[callsign]
                local target = type(unit) == 'table' and unit.source or unit
                if target then
                    TriggerClientEvent('dispatch:newIncident', target, {
                        id = inc.id,
                        type = inc.type,
                        address = inc.address,
                        postal = inc.postal,
                        priority = inc.priority,
                        caller = inc.caller,
                        description = inc.notes,
                        x = inc.x,
                        y = inc.y,
                        z = inc.z,
                        -- The target callsign is deliberately included so the
                        -- receiving MDT can independently reject any incident
                        -- not addressed to the signed-on appliance.
                        targetCallsign = callsign,
                        playAlert = inc.sendMDT ~= false
                    })

                    TriggerClientEvent('zf_mdt:newIncident', target, {
                        id = inc.id,
                        type = inc.type,
                        location = inc.address,
                        description = inc.notes
                    })
                end

                if inc.sendTurnout == true then
                    TriggerEvent("MPS-TurnoutSystem:Server:TurnoutCallsigns", {callsign}, string.format(
                        "%s\n%s\n%s", inc.type or '', inc.address or '', inc.notes or ''
                    ))
                end

                if inc.sendPager == true then
                    TriggerEvent('guardian_pager:newIncident', {
                        id = inc.id,
                        type = inc.type,
                        address = inc.address,
                        postal = inc.postal,
                        priority = inc.priority,
                        caller = inc.caller,
                        notes = inc.notes,
                        assignedUnits = {callsign},
                        time = inc.time
                    })
                end
            end

            BroadcastOngoingIncidents()
            BroadcastUnitBoard()
            return
        end
    end
end)

RegisterNetEvent('control:updateIncidentDetails', function(data)
    data = data or {}
    local incidentId = tonumber(data.incidentId)
    if not incidentId then return end

    for _, inc in ipairs(incidentHistory) do
        if tonumber(inc.id) == incidentId and inc.status ~= 'CLOSED' then
            local oldType = inc.type
            local oldPriority = inc.priority
            local oldAddress = inc.address
            local oldPostal = inc.postal
            local oldCaller = inc.caller

            inc.type = tostring(data.type or inc.type or '999 EMERGENCY')
            inc.priority = tostring(data.priority or inc.priority or 'Immediate')
            inc.address = tostring(data.address or inc.address or '')
            inc.postal = tostring(data.postal or inc.postal or '')
            inc.caller = tostring(data.caller or inc.caller or '')
            inc.details = tostring(data.details or '')
            inc.hazards = tostring(data.hazards or '')
            inc.resources = tostring(data.resources or '')
            inc.sceneStatus = tostring(data.sceneStatus or '')
            inc.casualties = tonumber(data.casualties) or 0

            local postalPos = guardianPostalCoords(inc.postal)
            if postalPos then
                inc.x, inc.y, inc.z = postalPos.x, postalPos.y, postalPos.z
            end

            if oldType ~= inc.type then
                AddIncidentTimeline(inc, 'Incident type changed to ' .. inc.type)
            end
            if oldPriority ~= inc.priority then
                AddIncidentTimeline(inc, 'Priority changed to ' .. inc.priority)
            end
            if oldAddress ~= inc.address or oldPostal ~= inc.postal then
                AddIncidentTimeline(inc, 'Incident location updated')
            end
            if oldCaller ~= inc.caller then
                AddIncidentTimeline(inc, 'Caller updated')
            end
            AddIncidentTimeline(inc, 'Incident details updated')
            BroadcastOngoingIncidents()
            return
        end
    end
end)

RegisterNetEvent('control:setIncidentRole', function(data)
    data = data or {}
    local incidentId = tonumber(data.incidentId)
    local callsign = string.upper(tostring(data.callsign or ''))
    local role = tostring(data.role or 'Crew')
    if not incidentId or callsign == '' then return end

    for _, inc in ipairs(incidentHistory) do
        if tonumber(inc.id) == incidentId and inc.status ~= 'CLOSED' then
            inc.assignedRoles = inc.assignedRoles or {}
            inc.applianceCrew = inc.applianceCrew or {}
            inc.assignedRoles[callsign] = role
            inc.applianceCrew[callsign] = inc.applianceCrew[callsign] or {count=0, members={}}
            AddIncidentTimeline(inc, callsign .. ' role set to ' .. role, callsign)
            BroadcastOngoingIncidents()
            return
        end
    end
end)

RegisterNetEvent('control:setApplianceCrew', function(data)
    data = data or {}
    local incidentId = tonumber(data.incidentId)
    local callsign = string.upper(tostring(data.callsign or ''))
    local count = math.max(0, math.floor(tonumber(data.count) or 0))
    if not incidentId or callsign == '' then return end

    for _, inc in ipairs(incidentHistory) do
        if tonumber(inc.id) == incidentId and inc.status ~= 'CLOSED' then
            inc.applianceCrew = inc.applianceCrew or {}
            inc.applianceCrew[callsign] = inc.applianceCrew[callsign] or {}
            inc.applianceCrew[callsign].count = count
            inc.applianceCrew[callsign].members = inc.applianceCrew[callsign].members or {}
            AddIncidentTimeline(inc, callsign .. ' crew count set to ' .. tostring(count), callsign)
            BroadcastOngoingIncidents()
            return
        end
    end
end)


RegisterNetEvent('control:setCrewMember', function(data)
    data = data or {}
    local incidentId = tonumber(data.incidentId)
    local callsign = string.upper(tostring(data.callsign or ''))
    local slot = math.max(1, math.floor(tonumber(data.slot) or 1))
    local name = tostring(data.name or ''):sub(1, 80)
    local rank = tostring(data.rank or ''):sub(1, 50)
    local role = tostring(data.role or 'Crew'):sub(1, 60)
    if not incidentId or callsign == '' then return end

    for _, inc in ipairs(incidentHistory) do
        if tonumber(inc.id) == incidentId and inc.status ~= 'CLOSED' then
            inc.crewMembers = inc.crewMembers or {}
            inc.crewMembers[callsign] = inc.crewMembers[callsign] or {}
            inc.crewMembers[callsign][slot] = {
                name = name,
                rank = rank,
                role = role
            }

            -- Keep the appliance's lead role in sync with the selected person's role.
            inc.assignedRoles = inc.assignedRoles or {}
            if role ~= '' and role ~= 'Crew' then
                inc.assignedRoles[callsign] = role
            end

            AddIncidentTimeline(inc, name ~= '' and (callsign .. ' crew member updated: ' .. name) or (callsign .. ' crew roster updated'), callsign)
            BroadcastOngoingIncidents()
            return
        end
    end
end)

exports('GetCrewRadioIdentity', function(callsign)
    callsign = string.upper(tostring(callsign or ''))
    -- Prefer the most recently assigned named role for this appliance.
    for i = #incidentHistory, 1, -1 do
        local inc = incidentHistory[i]
        if inc.status ~= 'CLOSED' and inc.crewMembers and inc.crewMembers[callsign] then
            local members = inc.crewMembers[callsign]
            local best
            for _, member in pairs(members) do
                if member and member.name and member.name ~= '' then
                    if member.role and member.role ~= '' and member.role ~= 'Crew' then
                        best = member
                        break
                    end
                    best = best or member
                end
            end
            if best then
                return {
                    callsign = callsign,
                    name = best.name,
                    rank = best.rank or '',
                    role = best.role or 'Crew'
                }
            end
        end
    end
    return nil
end)

RegisterNetEvent('control:mobiliseResourceRequest', function(data)
    data = data or {}
    local incidentId = tonumber(data.incidentId)
    local callsign = string.upper(tostring(data.callsign or ''))
    local requestId = tonumber(data.requestId)

    if not incidentId or callsign == '' then return end

    local meta = (Config.ApplianceResources or {})[callsign] or (Config.ApplianceResources or {})[string.lower(callsign)]
    if not meta then return end

    local requestedType = tostring(data.resourceType or meta.type or 'Other')
    if tostring(meta.type or 'Other') ~= requestedType then return end

    for _, inc in ipairs(incidentHistory) do
        if tonumber(inc.id) == incidentId and inc.status ~= 'CLOSED' then
            local exists = false
            for _, assigned in ipairs(inc.assignedUnits or {}) do
                if string.upper(tostring(assigned)) == callsign then exists = true break end
            end
            if exists then return end

            local busy = IsApplianceAssignedToOpenIncident(callsign, incidentId)
            local unit = activeUnits[callsign]
            local target = type(unit) == 'table' and unit.source or unit
            local status = type(unit) == 'table' and tostring(unit.status or ''):upper() or ''

            if busy or not target or status == 'OFF RUN' then
                return
            end

            -- Route through the existing mobilisation logic.
            TriggerEvent('control:assignAppliance', {
                incidentId = incidentId,
                callsign = callsign,
                assign = true,
                enableMDT = inc.sendMDT,
                enableTurnout = inc.sendTurnout,
                enablePager = inc.sendPager
            })

            for _, req in ipairs(inc.resourceRequests or {}) do
                if (not requestId or tonumber(req.id) == requestId) and req.status == 'OPEN' then
                    req.status = 'MOBILISED'
                    req.assignedCallsign = callsign
                    break
                end
            end

            AddIncidentTimeline(inc, callsign .. ' mobilised against ' .. requestedType .. ' resource request', callsign)
            BroadcastOngoingIncidents()
            TriggerClientEvent('control:resourceRequest', -1, {
                incidentId = inc.id,
                request = { id=requestId, type=requestedType, assignedCallsign=callsign, status='MOBILISED' }
            })
            return
        end
    end
end)

RegisterNetEvent('control:createResourceRequest', function(data)
    data = data or {}
    local incidentId = tonumber(data.incidentId)
    if not incidentId then return end

    for _, inc in ipairs(incidentHistory) do
        if tonumber(inc.id) == incidentId and inc.status ~= 'CLOSED' then
            inc.resourceRequests = inc.resourceRequests or {}

            local request = {
                id = math.random(100000, 999999),
                type = tostring(data.type or 'Other'),
                priority = tostring(data.priority or 'Normal'),
                notes = tostring(data.notes or ''),
                status = 'OPEN',
                time = os.date('%H:%M:%S'),
                resourceType = tostring(data.resourceType or data.type or 'Other'),
                assignedCallsign = nil
            }

            inc.resourceRequests[#inc.resourceRequests + 1] = request
            AddIncidentTimeline(inc, 'Resource requested: ' .. request.type .. ' (' .. request.priority .. ')')

            BroadcastOngoingIncidents()
            TriggerClientEvent('control:resourceRequest', -1, {
                incidentId = inc.id,
                request = request
            })
            return
        end
    end
end)

RegisterNetEvent('control:closeIncident', function(data)
    data = data or {}
    local incidentId = tonumber(data.incidentId)
    if not incidentId then return end

    for _, inc in ipairs(incidentHistory) do
        if tonumber(inc.id) == incidentId then
            inc.status = 'CLOSED'
            inc.closedTime = os.date('%H:%M:%S')
            AddIncidentTimeline(inc, 'Incident closed')
            -- Closing an incident releases every appliance assigned to it.
            for _, callsign in ipairs(inc.assignedUnits or {}) do
                RefreshApplianceAvailability(callsign)
            end
            BroadcastOngoingIncidents()
            BroadcastUnitBoard()
            return
        end
    end

    -- Always refresh the requesting Control console, even if the incident
    -- was already closed by another console.
    BroadcastOngoingIncidents(source)
end)


-- =========================================================
-- Guardian_999 integration
-- Receives emergency reports from the separate Guardian_999
-- resource without coupling 999 code into the MDT.
-- =========================================================
local function Receive999Call(call)
    call = call or {}
    call.id = tonumber(call.id) or math.random(100000, 999999)
    call.time = call.time or os.date('%H:%M:%S')
    call.status = 'WAITING'

    -- Resolve nearest postal using Guardian Control's configured postal
    -- coordinates when available.
    if call.x and call.y and type(guardianPostals) == 'table' then
        local bestCode, bestDist
        for code, p in pairs(guardianPostals) do
            local px, py = tonumber(p.x), tonumber(p.y)
            if px and py then
                local dx = (tonumber(call.x) or 0) - px
                local dy = (tonumber(call.y) or 0) - py
                local dist = (dx * dx) + (dy * dy)

                if not bestDist or dist < bestDist then
                    bestDist = dist
                    bestCode = code
                end
            end
        end

        if bestCode then
            call.postal = bestCode
        end
    end

    pending999Calls[#pending999Calls + 1] = call
    TriggerEvent('guardian_web:stateDirty')
    if #pending999Calls > 50 then
        table.remove(pending999Calls, 1)
    end

    TriggerClientEvent('control:999Call', -1, call)

    print(('[Guardian Control] 999 report received: %s / %s'):format(
        tostring(call.caller or 'Unknown Caller'),
        tostring(call.postal or 'No postal')
    ))

    return true
end

exports('Receive999Call', Receive999Call)

RegisterNetEvent('control:request999Calls', function()
    TriggerClientEvent('control:999Calls', source, pending999Calls)
end)

RegisterNetEvent('control:dismiss999Call', function(callId)
    callId = tonumber(callId)
    if not callId then return end

    for i = #pending999Calls, 1, -1 do
        if tonumber(pending999Calls[i].id) == callId then
            table.remove(pending999Calls, i)
            break
        end
    end

    TriggerClientEvent('control:999CallDismissed', -1, callId)
end)

local function CreateIncidentFromData(data, source999CallId)
    data = data or {}

    local sendMDT = data.enableMDT == true
    local sendPager = data.enablePager == true
    local sendTurnout = data.enableTurnout == true

    local inc = {
        id = math.random(1000,9999),
        type = data.type or '999 EMERGENCY',
        address = data.address or '',
        postal = data.postal or '',
        priority = data.priority or 'Immediate',
        caller = data.caller or '',
        notes = data.notes or '',
        time = os.date('%H:%M:%S'),
        status = 'ONGOING',
        assignedUnits = {},
        assignedRoles = {},
        sendMDT = sendMDT,
        sendPager = sendPager,
        sendTurnout = sendTurnout,
        timeline = {},
        source999CallId = tonumber(source999CallId) or nil
    }

    local postalPos = guardianPostalCoords(inc.postal)
    if postalPos then
        inc.x, inc.y, inc.z = postalPos.x, postalPos.y, postalPos.z
    end

    AddIncidentTimeline(inc, 'Incident created')
    table.insert(incidentHistory, inc)

    if inc.source999CallId then
        for i = #pending999Calls, 1, -1 do
            if tonumber(pending999Calls[i].id) == inc.source999CallId then
                table.remove(pending999Calls, i)
                break
            end
        end
        TriggerClientEvent('control:999CallDismissed', -1, inc.source999CallId)
    end

    BroadcastOngoingIncidents()
    BroadcastUnitBoard()
    TriggerClientEvent('control:incidentCreated', -1, inc)

    return inc
end

RegisterNetEvent('control:createIncidentFrom999', function(data)
    data = data or {}
    local callId = tonumber(data.callId)
    if not callId then return end

    for _, call in ipairs(pending999Calls) do
        if tonumber(call.id) == callId then
            local inc = CreateIncidentFromData({
                type = '999 EMERGENCY',
                address = call.location or '',
                postal = call.postal or '',
                priority = 'Immediate',
                caller = call.caller or '',
                notes = call.description or '',
                enableMDT = true,
                enableTurnout = true,
                enablePager = false
            }, call.id)

            TriggerClientEvent('control:999IncidentCreated', source, inc)
            return
        end
    end
end)

RegisterNetEvent('control:createIncident', function(data)

    data = data or {}
    local sendMDT = data.enableMDT == true
    local sendPager = data.enablePager == true
    local sendTurnout = data.enableTurnout == true

    print(('[Guardian Control] Toggles MDT=%s Pager=%s Turnout=%s'):format(
        tostring(sendMDT), tostring(sendPager), tostring(sendTurnout)
    ))

    local inc = {
        id = math.random(1000,9999),
        type = data.type,
        address = data.address,
        postal = data.postal,
        priority = data.priority,
        caller = data.caller,
        notes = data.notes,
        time = os.date('%H:%M:%S'),
        status = 'ONGOING',
        assignedUnits = {},
        assignedRoles = {},
        -- Persist the dispatch toggles for later appliance mobilisation.
        sendMDT = sendMDT,
        sendPager = sendPager,
        sendTurnout = sendTurnout,
        resourceRequests = {},
        timeline = {}
    }

    local postalPos = guardianPostalCoords(inc.postal)
    if postalPos then
        inc.x, inc.y, inc.z = postalPos.x, postalPos.y, postalPos.z
    end

    AddIncidentTimeline(inc, 'Incident created')
    table.insert(incidentHistory, inc)
    BroadcastOngoingIncidents()

    -- Pumps are assigned from the Ongoing Incidents screen after creation.
    -- This mirrors real dispatch: create the incident first, then mobilise the required appliances.

    -- Turnout is triggered when an appliance is assigned from Ongoing Incidents.

-- Pager is intentionally sent when an appliance is mobilised below.

TriggerClientEvent('control:incidentCreated', -1, inc)

end)

RegisterNetEvent('control:sendMessage')
AddEventHandler('control:sendMessage', function(data)

    local target = data.target or "ALL"

    local item = {
        sender = "CONTROL",
        text = tostring(data.message or ""),
        time = os.date("%H:%M:%S"),
        direction = "control_to_mdt",
        conversation = "CONTROL"
    }

    if target == "ALL" then

        TriggerClientEvent("dispatch:message",-1,item)

    else

        local unit = activeUnits[string.upper(target)]
        local src = type(unit) == 'table' and unit.source or unit

        if src then
            TriggerClientEvent("dispatch:message", src, item)
        else
            print(('^1[Guardian Control]^7 No active player found for callsign %s'):format(tostring(target)))
        end

    end

    webMessageHistory[#webMessageHistory + 1] = item
    if #webMessageHistory > 100 then
        table.remove(webMessageHistory, 1)
    end

    TriggerClientEvent("control:crewMessage",-1,item)

end)

exports("GetPlayerFromCallsign", function(callsign)
    local unit = activeUnits[string.upper(callsign or '')]
    if type(unit) == 'table' then
        return unit.source
    end
    return unit
end)

-- =========================================================
-- Guardian Web integration
-- Exposes Guardian Control's authoritative live state to the
-- separate guardian_web bridge. This keeps the browser in sync
-- even if the bridge starts after incidents/units already exist.
-- =========================================================
exports('GetGuardianWebSnapshot', function()
    local openIncidents = {}
    for _, inc in ipairs(incidentHistory or {}) do
        if tostring(inc.status or '') ~= 'CLOSED' then
            RefreshIncidentApplianceStatuses(inc)
            openIncidents[#openIncidents + 1] = inc
        end
    end

    return {
        units = activeUnits or {},
        incidents = openIncidents,
        calls999 = pending999Calls or {},
        messages = webMessageHistory or {},
        callsigns = BuildAllCallsigns(),
        callSignStations = BuildStationMap(),
        applianceSkills = BuildCallsignSkills(),
        generatedAt = os.time()
    }
end)



-- Guardian Web Player MDT support
exports('GuardianWebSetUnitStatus', function(callsign,status)
    callsign=string.upper(tostring(callsign or '')):gsub('%s+','')
    status=tostring(status or '')
    if callsign=='' or status=='' then return false end

    local unit=activeUnits[callsign]
    if type(unit)~='table' then
        -- A browser status is valid only for a booked-on unit.
        return false
    end

    unit.status=status

    for _, inc in ipairs(incidentHistory or {}) do
        if inc.status ~= 'CLOSED' then
            for _, assigned in ipairs(inc.assignedUnits or {}) do
                if string.upper(tostring(assigned)) == callsign then
                    inc.applianceStatuses = inc.applianceStatuses or {}
                    inc.applianceStatuses[callsign] = status
                end
            end
        end
    end

    TriggerClientEvent('control:statusUpdate',-1,{
        unit=callsign,status=status,time=os.date('%H:%M:%S')
    })

    local target=tonumber(unit.source)
    if target then
        TriggerClientEvent('guardian_web:mdtStatusSync',target,status)
    end

    if string.upper(status)=='OFF RUN' then
        -- OFF RUN books the browser session off. A real in-game source
        -- remains authoritative until that player signs off themselves.
        unit.webBooked=nil
        if not unit.source or unit.webOnly==true then
            activeUnits[callsign]=nil
        else
            unit.webOnly=false
        end
    end

    BroadcastUnitBoard()
    BroadcastOngoingIncidents()
    TriggerEvent('guardian_web:stateDirty')
    return true
end)

exports('GuardianWebAckIncident', function(callsign,incidentId)
    callsign=string.upper(tostring(callsign or '')); if callsign=='' then return false end
    TriggerClientEvent('control:ack',-1,{unit=callsign,id=tonumber(incidentId) or incidentId,time=os.date('%H:%M:%S')})
    return true
end)

exports('GuardianWebMdtMessage', function(callsign,message)
    callsign=string.upper(tostring(callsign or 'UNIT')); message=tostring(message or '')
    if message=='' then return false end
    local item={sender=callsign,text=message,time=os.date('%H:%M:%S'),direction='mdt_to_control',conversation='CONTROL'}
    webMessageHistory[#webMessageHistory+1]=item
    if #webMessageHistory>100 then table.remove(webMessageHistory,1) end
    TriggerClientEvent('control:crewMessage',-1,item)
    return true
end)


-- Guardian Web history capture for in-game MDT messages.
-- Guardian_mdt/server.lua still performs the actual in-game delivery.
RegisterNetEvent('dispatch:crewMessage', function(message, callsign)
    local item = {
        sender = string.upper(tostring(callsign or 'UNIT')),
        text = tostring(message or ''),
        time = os.date('%H:%M:%S'),
        direction = 'mdt_to_control',
        conversation = 'CONTROL'
    }
    webMessageHistory[#webMessageHistory + 1] = item
    if #webMessageHistory > 100 then table.remove(webMessageHistory, 1) end
    TriggerEvent('guardian_web:stateDirty')
end)


-- =========================================================
-- Guardian Web: browser MDT Book On / Book Off
-- A browser-only booking is visible in the authoritative
-- appliance board but never invents a FiveM player source.
-- If the same callsign is already signed on in-game, the
-- real source is preserved and webBooked is only a session flag.
-- =========================================================
exports('GuardianWebBookOn', function(callsign, status)
    callsign = string.upper(tostring(callsign or '')):gsub('%s+', '')
    if callsign == '' then return false end

    local unit = activeUnits[callsign]
    if type(unit) ~= 'table' then
        unit = {
            source = nil,
            status = tostring(status or 'Home Station'),
            webOnly = true,
            webBooked = true
        }
        activeUnits[callsign] = unit
    else
        unit.webBooked = true
        unit.webOnly = unit.source == nil
        if not unit.status or unit.status == '' then
            unit.status = tostring(status or 'Home Station')
        end
    end

    BroadcastUnitBoard()
    BroadcastOngoingIncidents()
    TriggerEvent('guardian_web:stateDirty')
    return true
end)

exports('GuardianWebBookOff', function(callsign)
    callsign = string.upper(tostring(callsign or '')):gsub('%s+', '')
    if callsign == '' then return false end

    local unit = activeUnits[callsign]
    if type(unit) ~= 'table' then return true end

    unit.webBooked = nil

    -- Do not sign a real FiveM player off merely because they closed
    -- the browser MDT. Remove only a browser-only booking.
    if not unit.source or unit.webOnly == true then
        activeUnits[callsign] = nil
    else
        unit.webOnly = false
    end

    BroadcastUnitBoard()
    BroadcastOngoingIncidents()
    TriggerEvent('guardian_web:stateDirty')
    return true
end)
