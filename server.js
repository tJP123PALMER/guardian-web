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
const suppressed999 = new Map();
const recentCommandKeys = new Map();

function cleanText(v){
  return String(v ?? "").trim().replace(/\s+/g," ").toUpperCase();
}

function call999Key(call={}){
  const explicit = cleanText(call.id || call.callId || call.uuid || "");
  if(explicit) return `ID:${explicit}`;

  // Exact-content fallback for malformed/legacy calls that arrive without IDs.
  // Deliberately includes as much call metadata as possible to avoid merging
  // unrelated calls that merely share a location.
  return "FP:" + [
    cleanText(call.type),
    cleanText(call.priority),
    cleanText(call.location || call.address),
    cleanText(call.postal || call.postcode),
    cleanText(call.caller || call.name),
    cleanText(call.phone || call.telephone),
    cleanText(call.description || call.details || call.message),
    cleanText(call.time || call.createdAt || call.timestamp)
  ].join("|");
}

function dedupe999Calls(list){
  const result=[];
  const seen=new Set();

  for(const raw of Array.isArray(list) ? list : []){
    if(!raw || typeof raw !== "object") continue;
    const key=call999Key(raw);
    if(seen.has(key)) continue;
    seen.add(key);

    const explicit=cleanText(raw.id || raw.callId || raw.uuid || "");
    if(explicit){
      const until=suppressed999.get(explicit);
      if(until && until>Date.now()) continue;
      if(until && until<=Date.now()) suppressed999.delete(explicit);
    }

    result.push(raw);
  }

  return result;
}

function suppress999(callId, ttlMs=30000){
  const key=cleanText(callId);
  if(key) suppressed999.set(key, Date.now()+ttlMs);
}

function commandFingerprint(action,data={}){
  // Prevent accidental browser double-clicks/retries while still allowing
  // legitimate repeated operational actions after a short window.
  return `${action}:${JSON.stringify(data)}`;
}

function recentlyQueued(action,data,windowMs=1200){
  const key=commandFingerprint(action,data);
  const last=recentCommandKeys.get(key) || 0;
  recentCommandKeys.set(key,Date.now());

  // opportunistic cleanup
  if(recentCommandKeys.size>250){
    const cutoff=Date.now()-10000;
    for(const [k,t] of recentCommandKeys) if(t<cutoff) recentCommandKeys.delete(k);
  }

  return Date.now()-last < windowMs;
}

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
  eventLog: [],
  standbyMoves: []
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
  const cutoff=Date.now()-10*60*1000;
  for(const [commandId,c] of commands){
    const created=Date.parse(c.createdAt||0);
    if(c.acknowledged && created && created<cutoff) commands.delete(commandId);
  }

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

app.get("/guardian-version",(_req,res)=>res.type("text/plain").send("Guardian Operations v2.4.1 Standby + Book Off Fix"));
app.get("/healthz",(_req,res)=>res.json({
  ok:true,
  version:"Guardian Operations v2.4.1 Standby + Book Off Fix",
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
  if(Array.isArray(body.calls999)) state.calls999 = dedupe999Calls(body.calls999);
  if(Array.isArray(body.messages)) state.messages = body.messages;
  if(Array.isArray(body.callsigns)) state.callsigns = body.callsigns;
  if(body.callSignStations && typeof body.callSignStations === "object") state.callSignStations = body.callSignStations;
  if(body.applianceSkills && typeof body.applianceSkills === "object") state.applianceSkills = body.applianceSkills;
  if(body.bookings && typeof body.bookings === "object") state.bookings = body.bookings;

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


const aliases = {
  updateIncidentDetails: "updateIncident",
  mobiliseAppliance: "assignAppliance"
};

const allowed = new Set([
  "createIncident","createIncidentFrom999","updateIncident","closeIncident","reopenIncident",
  "assignAppliance","unassignAppliance","sendMessage","dismiss999Call",
  "setApplianceCrew","setCrewMember","setIncidentRole","createResourceRequest",
  "webBookOn","webBookOff","webMdtStatus","webMdtAck","webMdtMessage",
  "requestStatus","setSceneStatus","standbyMove","createStandbyMove","cancelStandbyMove","returnStandbyMove","ackStandbyMove"
]);

function queueCommand(action,data={}){
  const command={id:id(),action,data,createdAt:now(),acknowledged:false};
  commands.set(command.id,command);
  pushEvent("commandQueued",{id:command.id,action,data});
  return command;
}

function find999(callId){
  return (state.calls999||[]).find(c=>String(c.id)===String(callId));
}

app.post("/api/command",(req,res)=>{
  let action=String(req.body?.action||"");
  const data=req.body?.data||{};
  action=aliases[action]||action;

  if(action==="createIncidentFrom999"){
    const call=find999(data.callId);
    if(!call) return res.status(404).json({ok:false,error:"999 call no longer exists"});

    const sourceId=String(call.id ?? data.callId ?? "");
    const existing=(state.incidents||[]).find(i=>String(i.source999Id||"")===sourceId);
    if(existing){
      suppress999(sourceId);
      state.calls999=state.calls999.filter(c=>String(c.id)!==sourceId);
      touch();
      return res.json({ok:true,alreadyConverted:true,incident:existing});
    }

    if(recentlyQueued("createIncidentFrom999",{callId:sourceId},5000)){
      return res.status(409).json({ok:false,error:"This 999 call is already being converted"});
    }

    const incidentData={
      source999Id:sourceId,
      type:call.type||"999 EMERGENCY",
      priority:call.priority||"Immediate",
      address:call.address||call.location||"",
      location:call.location||call.address||"",
      postal:call.postal||call.postcode||"",
      caller:call.caller||call.name||"",
      phone:call.phone||call.telephone||"",
      notes:call.description||call.details||call.message||"",
      details:call.description||call.details||call.message||"",
      enableMDT:true,
      enableTurnout:false,
      enablePager:false
    };

    // Remove immediately so browser rerenders cannot offer the same call twice.
    suppress999(sourceId);
    state.calls999=state.calls999.filter(c=>String(c.id)!==sourceId);
    touch();

    const create=queueCommand("createIncident",incidentData);
    const dismiss=queueCommand("dismiss999Call",{id:sourceId,callId:sourceId,reason:"Converted to incident"});
    pushEvent("999Converted",{callId:sourceId,createCommandId:create.id});
    return res.json({ok:true,command:create,dismissCommand:dismiss,converted:incidentData});
  }


  state.standbyMoves ||= [];
  const activeStandby=(cs)=>state.standbyMoves.find(m=>String(m.callsign||"").toUpperCase()===String(cs||"").toUpperCase() && !["cancelled","completed","superseded"].includes(m.state));

  if(action==="createStandbyMove" || action==="standbyMove"){
    const callsign=String(data.callsign||"").trim().toUpperCase();
    const destination=String(data.destination||data.station||"").trim();
    if(!callsign||!destination) return res.status(400).json({ok:false,error:"Callsign and destination station are required"});
    const u=state.units?.[callsign]||{};
    const st=String(u.status||"").toLowerCase();
    if(u.incidentId || /off run|unavailable|mobile to incident|in attendance|on scene|committed/.test(st))
      return res.status(409).json({ok:false,error:`${callsign} is committed or unavailable`});
    if(activeStandby(callsign)) return res.status(409).json({ok:false,error:`${callsign} already has an active standby move`});

    const move={id:id(),type:"standby_move",callsign,
      sourceStation:state.callSignStations?.[callsign]||u.station||"Unknown",
      destination,note:String(data.note||data.reason||""),state:"sent",
      status:"Standby Move Sent",sentAt:now()};
    state.standbyMoves.unshift(move);
    pushEvent("standbyMoveCreated",move); touch();
    const command=queueCommand("standbyMove",move);
    return res.json({ok:true,move,command});
  }

  if(action==="cancelStandbyMove" || action==="returnStandbyMove"){
    const move=state.standbyMoves.find(m=>String(m.id)===String(data.id||data.moveId));
    if(!move) return res.status(404).json({ok:false,error:"Standby move not found"});
    move.state=action==="returnStandbyMove"?"returning":"cancelled";
    move.status=action==="returnStandbyMove"?"Return to Home Station":"Standby Cancelled";
    move.updatedAt=now(); pushEvent(action,move); touch();
    return res.json({ok:true,move,command:queueCommand(action,{id:move.id,callsign:move.callsign})});
  }

  if(action==="ackStandbyMove"){
    const move=state.standbyMoves.find(m=>String(m.id)===String(data.id||data.moveId));
    if(!move) return res.status(404).json({ok:false,error:"Standby move not found"});
    move.state="acknowledged"; move.status="Mobile to Standby Station"; move.acknowledgedAt=now();
    if(state.units?.[move.callsign]) state.units[move.callsign]={...state.units[move.callsign],status:"Mobile to Standby Station"};
    pushEvent("standbyMoveAcknowledged",move); touch();
    return res.json({ok:true,move,command:queueCommand("ackStandbyMove",{id:move.id,callsign:move.callsign})});
  }

  // Emergency incident mobilisation automatically supersedes standby.
  if(action==="assignAppliance"){
    const cs=String(data.callsign||data.appliance||"").trim().toUpperCase();
    const move=activeStandby(cs);
    if(move){
      move.state="superseded"; move.status="Superseded by Incident";
      move.supersededAt=now(); move.supersededByIncident=data.incidentId||data.id||null;
      pushEvent("standbyMoveSuperseded",move); touch();
    }
  }

  if(!allowed.has(action)) return res.status(400).json({ok:false,error:`Unsupported action: ${action}`});

  if(action==="dismiss999Call"){
    const callId=String(data.id ?? data.callId ?? "");
    if(callId){
      suppress999(callId);
      state.calls999=state.calls999.filter(c=>String(c.id)!==callId);
      pushEvent("999Dismissed",{callId,reason:data.reason||"Dismissed"});
      touch();
    }
  }

  if(!["webBookOn","webBookOff","webMdtStatus","dismiss999Call"].includes(action)
     && recentlyQueued(action,data)){
    return res.status(409).json({ok:false,error:"Duplicate command ignored"});
  }

  // Web MDT session actions are mirrored immediately so the browser does not
  // have to wait for the next FiveM poll/heartbeat. The FiveM bridge also
  // persists/merges these bookings into subsequent snapshots.
  if(action==="webBookOn"){
    const cs=String(data.callsign||"").trim().toUpperCase();
    if(!cs) return res.status(400).json({ok:false,error:"Callsign required"});
    state.bookings ||= {};
    state.units ||= {};
    state.bookings[cs]={
      callsign:cs,
      webBooked:true,
      bookedAt:now(),
      status:String(data.status||"Home Station")
    };
    state.units[cs]={
      ...(state.units[cs]||{}),
      callsign:cs,
      status:String(data.status||state.units[cs]?.status||"Home Station"),
      webBooked:true,
      webOnly:!state.units[cs]?.source
    };
    rebuildStations();
    pushEvent("webBookOn",{callsign:cs,status:state.units[cs].status});
    touch();
  }else if(action==="webBookOff"){
    const cs=String(data.callsign||"").trim().toUpperCase();
    state.bookings ||= {};
    state.units ||= {};
    delete state.bookings[cs];
    const unit=state.units[cs];
    if(unit?.webOnly || !unit?.source) delete state.units[cs];
    else if(unit){ unit.webBooked=false; unit.webOnly=false; }
    rebuildStations();
    pushEvent("webBookOff",{callsign:cs});
    touch();
  }else if(action==="webMdtStatus"){
    const cs=String(data.callsign||"").trim().toUpperCase();
    if(cs && state.units?.[cs]){
      state.units[cs]={...state.units[cs],status:String(data.status||state.units[cs].status||"Home Station")};
      if(state.bookings?.[cs]) state.bookings[cs]={...state.bookings[cs],status:state.units[cs].status};
      pushEvent("webMdtStatus",{callsign:cs,status:state.units[cs].status});
      touch();
    }
  }

  const command=queueCommand(action,data);
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
app.get("/api/operational/999",(_req,res)=>res.json({ok:true,calls999:dedupe999Calls(state.calls999)}));
app.get("/api/operational/events",(_req,res)=>res.json({ok:true,events:state.eventLog}));
app.get("/api/operational/standby",(_req,res)=>res.json({ok:true,standbyMoves:state.standbyMoves||[]}));
app.get("/api/operational/cover",(_req,res)=>{
  const stations={};
  for(const [station,callsigns] of Object.entries(state.stations||{})){
    const rows=(callsigns||[]).map(cs=>({callsign:cs,status:state.units?.[cs]?.status||"OFF RUN",live:!!state.units?.[cs]}));
    const available=rows.filter(r=>/AVAILABLE|HOME STATION/i.test(r.status)).length;
    const committed=rows.filter(r=>/MOBILE|ATTENDANCE|INCIDENT/i.test(r.status)).length;
    stations[station]={configured:rows.length,live:rows.filter(r=>r.live).length,available,committed,level:available===0?"RED":available===1?"AMBER":"GREEN",units:rows};
  }
  res.json({ok:true,stations});
});

const controlFile = path.join(__dirname,"public","control","index.html");
const mdtFile = path.join(__dirname,"public","mdt","index.html");
app.get("/",(_q,r)=>r.sendFile(controlFile));
app.get("/control",(_q,r)=>r.sendFile(controlFile));
app.get("/control/",(_q,r)=>r.sendFile(controlFile));
app.get("/mdt",(_q,r)=>r.sendFile(mdtFile));
app.get("/mdt/",(_q,r)=>r.sendFile(mdtFile));

app.use(express.static(path.join(__dirname,"public")));

app.listen(PORT,"0.0.0.0",()=>console.log(`Guardian Operations v2.4.1 Standby + Book Off Fix running on port ${PORT}`));
