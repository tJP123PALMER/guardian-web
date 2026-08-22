# Callsign skills

Edit only `Config.CallSignSkills` in `config.lua`.

The Control UI reads this table directly.

Example:
```lua
Config.CallSignSkills = {
    ["K07A1"] = "Turntable Ladder",
    ["J02G1"] = "Wildfire Unit",
    ["N14W1"] = "Swift Water Rescue"
}
```

Restart `Guardian_control` after changing the config.
