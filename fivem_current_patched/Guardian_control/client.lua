
RegisterCommand('control', function()
 SetNuiFocus(true,true)
 SendNUIMessage({type='open'})
 TriggerServerEvent('control:requestUnitBoard')
 TriggerServerEvent('control:requestOngoingIncidents')
 TriggerServerEvent('control:request999Calls')
end)


RegisterNUICallback('requestUnitBoard', function(_, cb)
    TriggerServerEvent('control:requestUnitBoard')
    cb('ok')
end)

RegisterNUICallback('requestOngoingIncidents', function(_, cb)
    TriggerServerEvent('control:requestOngoingIncidents')
    cb('ok')
end)


RegisterNUICallback('request999Calls', function(_, cb)
    TriggerServerEvent('control:request999Calls')
    cb('ok')
end)

RegisterNUICallback('dismiss999Call', function(data, cb)
    TriggerServerEvent('control:dismiss999Call', data and data.id)
    cb('ok')
end)

RegisterNUICallback('updateIncidentDetails', function(data, cb)
    TriggerServerEvent('control:updateIncidentDetails', data or {})
    cb('ok')
end)

RegisterNUICallback('setApplianceCrew', function(data, cb)
    TriggerServerEvent('control:setApplianceCrew', data or {})
    cb('ok')
end)

RegisterNUICallback('assignAppliance', function(data, cb)
    TriggerServerEvent('control:assignAppliance', data or {})
    cb('ok')
end)

RegisterNUICallback('setCrewMember', function(data, cb)
    TriggerServerEvent('control:setCrewMember', data or {})
    cb('ok')
end)

RegisterNUICallback('setIncidentRole', function(data, cb)
    TriggerServerEvent('control:setIncidentRole', data or {})
    cb('ok')
end)

RegisterNUICallback('createIncidentFrom999', function(data, cb)
    TriggerServerEvent('control:createIncidentFrom999', data or {})
    cb('ok')
end)

RegisterNUICallback('closeIncident', function(data, cb)
    TriggerServerEvent('control:closeIncident', data or {})
    cb('ok')
end)

RegisterNetEvent('control:ongoingIncidents')
AddEventHandler('control:ongoingIncidents', function(list)
    SendNUIMessage({type='ongoingIncidents', incidents=list or {}})
end)

RegisterNUICallback('submitIncident', function(data, cb)
 TriggerServerEvent('control:createIncident', data)
 cb('ok')
end)
RegisterNetEvent('control:unitBoard')
AddEventHandler('control:unitBoard', function(data)
    SendNUIMessage({
        type = 'unitBoard',
        units = data.units or {},
        callsigns = data.callsigns or {},
        callSignStations = data.callSignStations or {},
        applianceSkills = data.applianceSkills or {}
    })
end)
RegisterNUICallback('sendMessage', function(data, cb)

    TriggerServerEvent(
        'control:sendMessage',
        data
    )

    cb('ok')

end)

RegisterNetEvent('control:999Call', function(call)
    SendNUIMessage({type='999Call', call=call})
end)

RegisterNetEvent('control:999Calls', function(calls)
    SendNUIMessage({type='999Calls', calls=calls or {}})
end)

RegisterNetEvent('control:999CallDismissed', function(id)
    SendNUIMessage({type='999CallDismissed', id=id})
end)

RegisterNetEvent('control:statusUpdate', function(item) SendNUIMessage({type='status',item=item}) end)
RegisterNetEvent('control:crewMessage', function(item) SendNUIMessage({type='message',item=item}) end)
RegisterNetEvent('control:ack', function(item) SendNUIMessage({type='ack',item=item}) end)

RegisterNUICallback('close', function(_, cb)
    SetNuiFocus(false, false)
    SendNUIMessage({type='close'})
    cb('ok')
end)


RegisterCommand('offrun', function(_, args)
    local callsign = string.upper(table.concat(args, ' '))
    if callsign == '' then return end

    TriggerServerEvent('dispatch:setCallsign', callsign)
    TriggerServerEvent('dispatch:statusUpdate', 'OFF RUN', callsign)
end)

-- Keyboard shortcut: F6 opens Control. /control remains available.
RegisterKeyMapping('control', 'Open Guardian Control', 'keyboard', 'F6')
