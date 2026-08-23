local open = false

local function show()
    local p=PlayerPedId()
    local c=GetEntityCoords(p)
    open=true
    SetNuiFocus(true,true)
    SendNUIMessage({type='open',caller=GetPlayerName(PlayerId()) or 'Unknown Caller',x=c.x,y=c.y,z=c.z})
end

RegisterCommand(Config.Command, show, false)

RegisterNUICallback('submitCall', function(data, cb)
    local p=PlayerPedId()
    local c=GetEntityCoords(p)
    TriggerServerEvent('guardian_999:submitCall',{
        caller=tostring(data.caller or GetPlayerName(PlayerId()) or 'Unknown Caller'),
        location=tostring(data.location or ''),
        description=tostring(data.description or ''),
        x=c.x,y=c.y,z=c.z
    })
    open=false
    SetNuiFocus(false,false)
    SendNUIMessage({type='close'})
    cb('ok')
end)

RegisterNUICallback('close', function(_,cb)
    open=false
    SetNuiFocus(false,false)
    SendNUIMessage({type='close'})
    cb('ok')
end)
