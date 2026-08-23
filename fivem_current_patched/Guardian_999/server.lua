local function sendControl(call)
    if GetResourceState(Config.ControlResource) ~= 'started' then
        print('[Guardian_999] Guardian_control is not started.')
        return false
    end
    local ok,result=pcall(function()
        return exports[Config.ControlResource]:Receive999Call(call)
    end)
    if not ok then
        print(('[Guardian_999] Control handoff failed: %s'):format(tostring(result)))
        return false
    end
    return result ~= false
end

RegisterNetEvent('guardian_999:submitCall',function(data)
    data=data or {}
    local src=source
    local caller=tostring(data.caller or GetPlayerName(src) or 'Unknown Caller')
    local location=tostring(data.location or '')
    local description=tostring(data.description or '')

    caller=caller:sub(1,Config.MaxCallerLength)
    location=location:sub(1,Config.MaxLocationLength)
    description=description:sub(1,Config.MaxDescriptionLength)

    if description:gsub('%s+','')=='' then return end

    local call={
        id=math.random(100000,999999),
        caller=caller,
        location=location,
        description=description,
        x=tonumber(data.x),y=tonumber(data.y),z=tonumber(data.z) or 0.0,
        time=os.date('%H:%M:%S'),
        source=src,
        status='WAITING'
    }

    local ok=sendControl(call)
    TriggerClientEvent('chat:addMessage',src,{args={'Guardian 999',ok and 'Emergency report sent to Fire Control.' or 'Fire Control is unavailable.'}})
end)
