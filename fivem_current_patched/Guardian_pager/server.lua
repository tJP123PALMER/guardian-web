RegisterNetEvent("guardian_pager:newIncident")
AddEventHandler("guardian_pager:newIncident", function(data)

    print("^2Guardian Pager received incident^7")

    for _, callsign in ipairs(data.assignedUnits or {}) do

        callsign = string.upper(tostring(callsign))
        local target = exports["Guardian_control"]:GetPlayerFromCallsign(callsign)

        if target then

            print(("Paging %s (%s)"):format(callsign, target))

            TriggerClientEvent("guardian_pager:receivePage", target, data)

        else

            print(("No player found for %s"):format(callsign))

        end

    end

end)