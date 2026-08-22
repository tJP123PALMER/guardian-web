Config = Config or {}

Config.WebApi = "https://guardian-web-qmnz.onrender.com"
Config.ApiKey = "5ec59984d9a85b8635573d72144e8323"

Config.PollMs = 1000
Config.HeartbeatMs = 2000


-- v2.6.1 fleet fallback: keeps Control stations/callsigns populated even if
-- Guardian_control snapshot export is temporarily unavailable during restart.
Config.Callsigns = {
  "K02P1","K02P2","K02A1","K02H1","K07A1","K06R1","K06P1","K06P2",
  "J01C1","J02G1","J02G2","J02P1","K01P1","K01P2","K01T1","J22Z6",
  "oge07","oge26","ose04","ose26","J27P6","N14P1","N14W1","N14P6","N04A1"
}
Config.CallSignStations = {
  J01C1="Dalkeith Fire Station", J02G1="Musselburgh Fire Station", J02G2="Musselburgh Fire Station", J02P1="Musselburgh Fire Station",
  J22Z6="North Berwick Fire Station", J27P6="Coldstream Fire Station", K01P1="Crewe Toll Fire Station", K01P2="Crewe Toll Fire Station", K01T1="Crewe Toll Fire Station",
  K02A1="McDonald Road Fire Station", K02H1="McDonald Road Fire Station", K02P1="McDonald Road Fire Station", K02P2="McDonald Road Fire Station",
  K06P1="Sighthill Fire Station", K06P2="Sighthill Fire Station", K06R1="Sighthill Fire Station", K07A1="Tollcross Fire Station", N04A1="Pegswood Fire Station",
  N14P1="Berwick Fire Station", N14P6="Berwick Fire Station", N14W1="Berwick Fire Station", ose26="Area Commander", ose04="Area Commander",
  oge26="station Commander", oge07="station Commander"
}
Config.ApplianceSkills = {
  K02P1="Pump", K02P2="Pump", K02A1="Aerial Appliance", K02H1="Specialist Appliance", K07A1="Turntable Ladder",
  K06R1="Rescue Appliance", K06P1="Pump", K06P2="Pump", J01C1="Command Unit", J02G1="Wildfire Unit", J02G2="Wildfire Unit", J02P1="Pump",
  K01P1="Pump", K01P2="Pump", K01T1="Water Carrier", J22Z6="Specialist Appliance", oge07="Station Commander", oge26="Station Commander",
  ose04="Area Commander", ose26="Area Commander", J27P6="Pump", N14P1="Pump", N14W1="Swift Water Rescue", N14P6="Wildfire Unit", N04A1="Aerial Appliance"
}
