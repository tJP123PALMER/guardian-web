import express from "express";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 10000);
const API_KEY = process.env.GUARDIAN_API_KEY || "";

app.disable("x-powered-by");
app.use(express.json({ limit: "4mb" }));

const clients = new Set();
const commands = new Map();

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();

let state = {
  connected: false,
  lastHeartbeat: null,
  updatedAt: now(),
  units: {},
  incidents: [],
  calls999: [],
  messages: [],
  callsigns: [],
  callSignStations: {},
  applianceSkills: {},
  stations: {},
  bookings: {},
  tracking: {},
  eventLog: []
};

function auth(req,res,next){
  if(!API_KEY) return res.status(503).json({ok:false,error:"GUARDIAN_API_KEY not configured"});
  const supplied = String(req.header("x-guardian-key") || "");
  const a = Buffer.from(supplied);
  const b = Buffer.from(String(API_KEY));
  if(!supplied || a.length !== b.length || !crypto.timingSafeEqual(a,b)){
    return res.status(401).json({ok:false,error:"Unauthorized"});
  }
  next();
}

function broadcast(type,payload){
  const packet = `data: ${JSON.stringify({type,payload})}\n\n`;
  for(const res of [...clients]){
    try { res.write(packet); }
    catch { clients.delete(res); }
  }
}

function pushEvent(kind,payload={}){
  const event = {id:id(),kind,payload,at:now()};
  state.eventLog.unshift(event);
  state.eventLog = state.eventLog.slice(0,500);
  broadcast("event", event);
  return event;
}

function touch(){
  state.updatedAt = now();
  broadcast("state", state);
}

function normalizeUnits(units){
  if(Array.isArray(units)){
    const map = {};
    for(const u of units){
      if(u?.callsign) map[u.callsign] = u;
    }
    return map;
  }
  return units && typeof units === "object" ? units : {};
}

function rebuildStations(){
  const grouped = {};
  const calls = new Set([
    ...(state.callsigns || []),
    ...Object.keys(state.units || {}),
    ...Object.keys(state.callSignStations || {})
  ]);
  for(const cs of calls){
    const station = state.callSignStations?.[cs] || state.units?.[cs]?.station || "Unassigned";
    grouped[station] ||= [];
    grouped[station].push(cs);
  }
  for(const list of Object.values(grouped)) list.sort();
  state.stations = grouped;
}

setInterval(()=>{
  const hb = state.lastHeartbeat ? Date.parse(state.lastHeartbeat) : 0;
  const shouldBeConnected = hb && (Date.now() - hb < 15000);
  if(state.connected !== !!shouldBeConnected){
    state.connected = !!shouldBeConnected;
    touch();
  }
  for(const res of [...clients]){
    try { res.write(`: keepalive ${Date.now()}\n\n`); }
    catch { clients.delete(res); }
  }
},5000).unref?.();

app.get("/guardian-version",(_req,res)=>res.type("text/plain").send("Guardian Live Operations v2"));
app.get("/healthz",(_req,res)=>res.json({
  ok:true,
  version:"Guardian Live Operations v2",
  fivemConnected:state.connected,
  browserClients:clients.size,
  units:Object.keys(state.units).length,
  incidents:state.incidents.length,
  calls999:state.calls999.length,
  pendingCommands:[...commands.values()].filter(c=>!c.acknowledged).length,
  updatedAt:state.updatedAt
}));

app.get("/api/state",(_req,res)=>{
  res.setHeader("Cache-Control","no-store");
  res.json({ok:true,state});
});

app.get("/api/events",(req,res)=>{
  res.setHeader("Content-Type","text/event-stream");
  res.setHeader("Cache-Control","no-cache, no-transform");
  res.setHeader("Connection","keep-alive");
  res.setHeader("X-Accel-Buffering","no");
  res.flushHeaders?.();
  clients.add(res);
  res.write("retry: 2500\n");
  res.write(`data: ${JSON.stringify({type:"state",payload:state})}\n\n`);
  const cleanup=()=>clients.delete(res);
  req.on("close",cleanup); req.on("aborted",cleanup); res.on("error",cleanup);
});

app.post("/api/fivem/state",auth,(req,res)=>{
  const body = req.body || {};
  const hadIncidents = new Map((state.incidents||[]).map(i=>[String(i.id), i]));
  const hadCalls = new Set((state.calls999||[]).map(c=>String(c.id)));

  state.units = normalizeUnits(body.units ?? state.units);
  if(Array.isArray(body.incidents)) state.incidents = body.incidents;
  if(Array.isArray(body.calls999)) state.calls999 = body.calls999;
  if(Array.isArray(body.messages)) state.messages = body.messages;
  if(Array.isArray(body.callsigns)) state.callsigns = body.callsigns;
  if(body.callSignStations && typeof body.callSignStations === "object") state.callSignStations = body.callSignStations;
  if(body.applianceSkills && typeof body.applianceSkills === "object") state.applianceSkills = body.applianceSkills;
  if(body.bookings && typeof body.bookings === "object") state.bookings = body.bookings;
  if(body.tracking && typeof body.tracking === "object") state.tracking = body.tracking;

  state.connected = true;
  state.lastHeartbeat = now();
  rebuildStations();

  for(const inc of state.incidents){
    const key = String(inc.id);
    if(!hadIncidents.has(key)) pushEvent("incidentCreated", inc);
    else if(JSON.stringify(hadIncidents.get(key)) !== JSON.stringify(inc)) pushEvent("incidentUpdated", inc);
  }
  for(const call of state.calls999){
    if(!hadCalls.has(String(call.id))) pushEvent("999Call", call);
  }

  touch();
  res.json({ok:true});
});

app.post("/api/fivem/event",auth,(req,res)=>{
  const e = pushEvent(String(req.body?.kind || "event"), req.body?.payload || {});
  res.json({ok:true,event:e});
});

app.post("/api/fivem/tracking",auth,(req,res)=>{
  const t = req.body || {};
  const cs = String(t.callsign || "").trim();
  if(!cs) return res.status(400).json({ok:false,error:"callsign required"});
  state.tracking[cs] = {
    callsign:cs,
    x:Number(t.x||0),
    y:Number(t.y||0),
    z:Number(t.z||0),
    heading:Number(t.heading||0),
    speed:Number(t.speed||0),
    status:t.status || state.units?.[cs]?.status || "Unknown",
    incidentId:t.incidentId || state.units?.[cs]?.incidentId || null,
    updatedAt:now()
  };
  if(state.units[cs]){
    state.units[cs] = {...state.units[cs], lastSeen:now()};
  }
  broadcast("tracking", state.tracking[cs]);
  res.json({ok:true});
});

const allowed = new Set([
  "createIncident","updateIncident","closeIncident","reopenIncident",
  "assignAppliance","unassignAppliance","sendMessage","dismiss999Call",
  "setApplianceCrew","setCrewMember","setIncidentRole",
  "webBookOn","webBookOff","webMdtStatus","webMdtAck","webMdtMessage",
  "requestStatus","mobiliseAppliance","setSceneStatus"
]);

app.post("/api/command",(req,res)=>{
  const action = String(req.body?.action || "");
  const data = req.body?.data || {};
  if(!allowed.has(action)) return res.status(400).json({ok:false,error:"Unsupported action"});
  const command = {id:id(),action,data,createdAt:now(),acknowledged:false};
  commands.set(command.id, command);
  pushEvent("commandQueued",{id:command.id,action,data});
  res.json({ok:true,command});
});

app.get("/api/fivem/commands",auth,(_req,res)=>{
  res.json({ok:true,commands:[...commands.values()].filter(c=>!c.acknowledged)});
});

app.post("/api/fivem/commands/:id/ack",auth,(req,res)=>{
  const c = commands.get(req.params.id);
  if(c){ c.acknowledged = true; c.acknowledgedAt = now(); pushEvent("commandAcknowledged",{id:c.id,action:c.action}); }
  res.json({ok:true});
});

app.get("/api/operational/units",(_req,res)=>res.json({ok:true,units:state.units,tracking:state.tracking,bookings:state.bookings}));
app.get("/api/operational/stations",(_req,res)=>res.json({ok:true,stations:state.stations,callSignStations:state.callSignStations,applianceSkills:state.applianceSkills}));
app.get("/api/operational/incidents",(_req,res)=>res.json({ok:true,incidents:state.incidents}));
app.get("/api/operational/999",(_req,res)=>res.json({ok:true,calls999:state.calls999}));
app.get("/api/operational/events",(_req,res)=>res.json({ok:true,events:state.eventLog}));

const controlFile = path.join(__dirname,"public","control","index.html");
const mdtFile = path.join(__dirname,"public","mdt","index.html");
app.get("/",(_q,r)=>r.sendFile(controlFile));
app.get("/control",(_q,r)=>r.sendFile(controlFile));
app.get("/control/",(_q,r)=>r.sendFile(controlFile));
app.get("/mdt",(_q,r)=>r.sendFile(mdtFile));
app.get("/mdt/",(_q,r)=>r.sendFile(mdtFile));

app.use(express.static(path.join(__dirname,"public")));

app.listen(PORT,"0.0.0.0",()=>console.log(`Guardian Live Operations v2 running on port ${PORT}`));
