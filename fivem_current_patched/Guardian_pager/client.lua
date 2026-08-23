local pagerOpen = false

RegisterNetEvent("guardian_pager:receivePage")
AddEventHandler("guardian_pager:receivePage", function(data)

    print("CLIENT RECEIVED PAGE")

    pagerOpen = true
    SetNuiFocus(true, true)
    SetNuiFocusKeepInput(false)

    SendNUIMessage({
        action = "show",
        type = data.type or "FIRE CALL",
        address = data.address or "",
        priority = data.priority or ""
    })
end)

RegisterNUICallback("closePager", function(_, cb)
    pagerOpen = false
    SendNUIMessage({ action = "hide" })
    SetNuiFocus(false, false)
    SetNuiFocusKeepInput(false)
    cb("ok")
end)

-- Safety fallback: if the NUI ever stops responding, F6 will release it.
RegisterCommand("closepager", function()
    if pagerOpen then
        pagerOpen = false
        SendNUIMessage({ action = "hide" })
        SetNuiFocus(false, false)
        SetNuiFocusKeepInput(false)
    end
end, false)

RegisterKeyMapping("closepager", "Close Guardian Pager", "keyboard", "F6")
