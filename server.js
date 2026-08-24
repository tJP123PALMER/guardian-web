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
  standbyMoves: [],
  standbyIncidents: []
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


function normaliseIncidentLive(inc){
  if(!inc || typeof inc!=="object") return inc;
  inc.assignedUnits = Array.isArray(inc.assignedUnits)
    ? inc.assignedUnits
    : Array.isArray(inc.assignedAppliances) ? inc.assignedAppliances
    : Array.isArray(inc.appliances) ? inc.appliances : [];
  inc.applianceStatuses = inc.applianceStatuses && typeof inc.applianceStatuses==="object" ? inc.applianceStatuses : {};
  inc.acknowledgedBy = inc.acknowledgedBy && typeof inc.acknowledgedBy==="object" ? inc.acknowledgedBy : {};
  inc.acknowledgedAt = inc.acknowledgedAt && typeof inc.acknowledgedAt==="object" ? inc.acknowledgedAt : {};
  inc.timeline = Array.isArray(inc.timeline) ? inc.timeline : [];
  return inc;
}
function sameIncidentIdentity(a,b){
  if(!a||!b)return false;
  if(String(a.id||"") && String(a.id||"")===String(b.id||"")) return true;
  if(a.standbyMoveId && b.standbyMoveId && String(a.standbyMoveId)===String(b.standbyMoveId)) return true;
  return false;
}
function timelineHas(inc,text){
  return (inc.timeline||[]).some(e=>String(e?.text||"")===String(text||""));
}
function mergeIncidentLive(previous,incoming){
  const old=normaliseIncidentLive(previous?{...previous}: {});
  const fresh=normaliseIncidentLive(incoming?{...incoming}: {});
  const next=normaliseIncidentLive({...old,...fresh});

  // Merge maps without allowing an empty server snapshot to wipe richer local state.
  next.acknowledgedBy={...(old.acknowledgedBy||{}),...(fresh.acknowledgedBy||{})};
  next.acknowledgedAt={...(old.acknowledgedAt||{}),...(fresh.acknowledgedAt||{})};
  next.applianceStatuses={...(old.applianceStatuses||{}),...(fresh.applianceStatuses||{})};

  // Merge timelines by event identity instead of replacing the old timeline.
  const mergedTimeline=[];
  const seen=new Set();
  for(const e of [...(old.timeline||[]),...(fresh.timeline||[])]){
    if(!e)continue;
    const eventText=String(e.text||"");
    const eventUnit=String(e.callsign||e.unit||"");
    const isMirrorAudit=/ acknowledged incident$| status changed to /i.test(eventText);
    const key=isMirrorAudit
      ? ["mirror",eventText,eventUnit].join("|")
      : [String(e.time||""),eventText,eventUnit].join("|");
    if(seen.has(key))continue;
    seen.add(key);
    mergedTimeline.push(e);
  }
  next.timeline=mergedTimeline;

  // Safety net: derive ACK/status audit events from state changes.
  const assigned=next.assignedUnits||[];
  for(const rawCs of assigned){
    const cs=String(typeof rawCs==="string"?rawCs:(rawCs?.callsign||rawCs?.unit||"")).toUpperCase();
    if(!cs)continue;

    const wasAck=!!old.acknowledgedBy?.[cs];
    const isAck=!!next.acknowledgedBy?.[cs];
    if(isAck&&!wasAck){
      const text=`${cs} acknowledged incident`;
      if(!timelineHas(next,text)){
        next.timeline.push({
          time:next.acknowledgedAt?.[cs]||new Date().toLocaleTimeString("en-GB",{hour12:false}),
          text,
          callsign:cs
        });
      }
    }

    const oldStatus=String(old.applianceStatuses?.[cs]||"");
    const newStatus=String(next.applianceStatuses?.[cs]||"");
    if(newStatus && oldStatus && oldStatus.toUpperCase()!==newStatus.toUpperCase()){
      const text=`${cs} status changed to ${newStatus}`;
      if(!timelineHas(next,text)){
        next.timeline.push({
          time:new Date().toLocaleTimeString("en-GB",{hour12:false}),
          text,
          callsign:cs
        });
      }
    }
  }

  // Sort oldest -> newest so Control's renderer remains predictable.
  next.timeline.sort((a,b)=>String(a.time||"").localeCompare(String(b.time||"")));
  return next;
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

app.get("/guardian-version",(_req,res)=>res.type("text/plain").send("Guardian Operations v2.5.1.1 Turnout + Incident Fix"));
app.get("/healthz",(_req,res)=>res.json({
  ok:true,
  version:"Guardian Operations v2.5.1.1 Turnout + Incident Fix",
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
  if(Array.isArray(body.incidents)){
    const previous=state.incidents||[];
    const liveIncidents=body.incidents.map(raw=>{
      const incoming=normaliseIncidentLive(raw);
      const old=previous.find(x=>sameIncidentIdentity(x,incoming));
      return mergeIncidentLive(old,incoming);
    });

    // Browser-created standby placeholder exists immediately in Control.
    // The authoritative FiveM standby (same standbyMoveId) replaces it.
    const activeStandbys=(state.standbyIncidents||[])
      .filter(i=>String(i.status||"").toUpperCase()!=="CLOSED")
      .map(raw=>{
        const standby=normaliseIncidentLive(raw);
        const old=previous.find(x=>sameIncidentIdentity(x,standby));
        return mergeIncidentLive(old,standby);
      });

    const merged=[...liveIncidents];
    for(const standby of activeStandbys){
      const idx=merged.findIndex(i=>sameIncidentIdentity(i,standby));
      if(idx>=0) merged[idx]=mergeIncidentLive(merged[idx],standby);
      else merged.push(standby);
    }
    state.incidents=merged;
  }
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
  "requestStatus","setSceneStatus","standbyMove","createStandbyMove","createStandbyIncident","cancelStandbyMove","returnStandbyMove","returnStandbyIncident","ackStandbyMove"
]);

function queueCommand(action,data={}){
  const command={id:id(),action,data,createdAt:now(),acknowledged:false};
  commands.set(command.id,command);
  pushEvent("commandQueued",{id:command.id,action,data});
  return command;
}


function activeStandbyIncident(moveId){
  return (state.standbyIncidents||[]).find(i=>String(i.standbyMoveId||"")===String(moveId||"") && String(i.status||"ONGOING").toUpperCase()!=="CLOSED");
}

function makeStandbyIncident(move){
  const short=String(move.id||"").split("-")[0].toUpperCase();
  return {
    id:`STBY-${short}`,
    type:"STANDBY COVER",
    title:`Standby - ${move.destination}`,
    category:"standby",
    isStandby:true,
    standbyMoveId:move.id,
    standbySourceStation:move.sourceStation,
    standbyDestination:move.destination,
    priority:"Standby",
    location:move.destination,
    address:move.destination,
    postal:move.postal||"",
    mapRef:move.mapRef||"",
    talkgroup:move.talkgroup||"FLAB-OPS1",
    specialRisk:move.specialRisk||"",
    hazards:move.specialRisk||"",
    role:move.role||"Pump",
    caller:"Control",
    details:move.furtherInfo||move.note||`Proceed to ${move.destination} for standby cover.`,
    notes:move.furtherInfo||move.note||"",
    furtherInfo:move.furtherInfo||"",
    sceneStatus:"Standby Move Sent",
    status:"ONGOING",
    appliances:[move.callsign],
    assignedUnits:[move.callsign],
    assignedAppliances:[move.callsign],
    assignedRoles:{[move.callsign]:move.role||"Pump"},
    applianceStatuses:{[move.callsign]:"Standby Move Sent"},
    enableMDT:true,
    enableTurnout:true,
    enablePager:false,
    createdAt:now()
  };
}

function closeStandbyIncident(move,reason){
  const inc=activeStandbyIncident(move?.id);
  if(!inc) return null;
  inc.status="CLOSED";
  inc.sceneStatus="Closed";
  inc.closedAt=now();
  inc.closeReason=reason||"Standby completed";
  pushEvent("standbyIncidentClosed",{incidentId:inc.id,standbyMoveId:move.id,reason:inc.closeReason});
  return inc;
}

function find999(callId){
  return (state.calls999||[]).find(c=>String(c.id)===String(callId));
}


function resolveIncidentForCommand(incidentId, standbyMoveId){
  const normal=Array.isArray(state.incidents)?state.incidents:[];
  const standby=Array.isArray(state.standbyIncidents)?state.standbyIncidents:[];
  const requested=String(incidentId||"");

  // 1. Real/numeric incident ID always wins.
  let inc=normal.find(i=>String(i?.id||"")===requested);
  if(inc) return inc;

  // 2. Resolve via standbyMoveId into the real incident first.
  const moveId=String(standbyMoveId || (requested.startsWith("STBY-") ? "" : "") || "");
  if(moveId){
    inc=normal.find(i=>i?.standbyMoveId && String(i.standbyMoveId)===moveId);
    if(inc) return inc;
  }

  // 3. Legacy STBY-* records are allowed only as a lookup bridge. If one is
  // found, translate it to the real incident sharing its standbyMoveId.
  if(requested.startsWith("STBY-")){
    const legacy=standby.find(i=>String(i?.id||"")===requested);
    if(legacy?.standbyMoveId){
      inc=normal.find(i=>i?.standbyMoveId && String(i.standbyMoveId)===String(legacy.standbyMoveId));
      if(inc) return inc;
    }
  }

  // 4. Last resort: exact legacy object only for old historical data.
  return standby.find(i=>String(i?.id||"")===requested) || null;
}

function addLocalIncidentTimeline(inc,text,callsign,time){
  if(!inc)return;
  inc.timeline=Array.isArray(inc.timeline)?inc.timeline:[];
  const cs=String(callsign||"").trim().toUpperCase();
  const msg=String(text||"");
  const exists=inc.timeline.some(e=>String(e?.text||"")===msg);
  if(!exists){
    inc.timeline.push({
      time:time||new Date().toLocaleTimeString("en-GB",{hour12:false}),
      text:msg,
      callsign:cs||undefined
    });
  }
}

function persistLocalIncidentAck(inc,callsign){
  if(!inc)return false;
  const cs=String(callsign||"").trim().toUpperCase();
  if(!cs)return false;

  inc.acknowledgedBy=(inc.acknowledgedBy&&typeof inc.acknowledgedBy==="object")
    ? inc.acknowledgedBy : {};
  inc.acknowledgedAt=(inc.acknowledgedAt&&typeof inc.acknowledgedAt==="object")
    ? inc.acknowledgedAt : {};

  if(inc.acknowledgedBy[cs]) return true;

  const ackTime=new Date().toLocaleTimeString("en-GB",{hour12:false});
  inc.acknowledgedBy[cs]=true;
  inc.acknowledgedAt[cs]=ackTime;
  addLocalIncidentTimeline(inc,`${cs} acknowledged incident`,cs,ackTime);
  return true;
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

    const move={
      id:id(),type:"standby_move",callsign,
      sourceStation:state.callSignStations?.[callsign]||u.station||"Unknown",
      destination,note:String(data.note||data.reason||""),
      postal:String(data.postal||""),mapRef:String(data.mapRef||""),talkgroup:String(data.talkgroup||"FLAB-OPS1"),role:String(data.role||"Pump"),
      specialRisk:String(data.specialRisk||""),furtherInfo:String(data.furtherInfo||""),
      state:"sent",status:"Standby Move Sent",sentAt:now()
    };
    state.standbyMoves.unshift(move);

    // Put standby into Control > Incidents immediately. FiveM replaces this
    // placeholder with its authoritative 5-digit incident via standbyMoveId.
    let standbyIncident=activeStandbyIncident(move.id);
    if(!standbyIncident){
      standbyIncident=normaliseIncidentLive(makeStandbyIncident(move));
      standbyIncident.timeline=[
        {time:new Date().toLocaleTimeString("en-GB",{hour12:false}),text:"Incident created"},
        {time:new Date().toLocaleTimeString("en-GB",{hour12:false}),text:`Standby incident sent to ${callsign} · ${destination}`,callsign}
      ];
      standbyIncident.assignedUnits=[callsign];
      standbyIncident.assignedRoles={[callsign]:move.role||"Pump"};
      state.standbyIncidents.unshift(standbyIncident);
    }
    if(!state.incidents.some(i=>sameIncidentIdentity(i,standbyIncident))){
      state.incidents.unshift(standbyIncident);
    }

    pushEvent("standbyMoveCreated",move);
    touch();

    const command=queueCommand("createStandbyIncident",{
      standbyMoveId:move.id,
      callsign,
      sourceStation:move.sourceStation,
      destination,note:move.note,postal:move.postal,mapRef:move.mapRef,talkgroup:move.talkgroup,role:move.role,
      specialRisk:move.specialRisk,furtherInfo:move.furtherInfo,
      enableMDT:true,
      enableTurnout:true,
      enablePager:false
    });

    return res.json({ok:true,move,command});
  }

  if(action==="cancelStandbyMove" || action==="returnStandbyMove"){
    const move=state.standbyMoves.find(m=>String(m.id)===String(data.id||data.moveId));
    if(!move) return res.status(404).json({ok:false,error:"Standby move not found"});
    move.state=action==="returnStandbyMove"?"returning":"cancelled";
    move.status=action==="returnStandbyMove"?"Return to Home Station":"Standby Cancelled";
    move.updatedAt=now();
    const standbyIncident=activeStandbyIncident(move.id);
    if(action==="cancelStandbyMove"){
      closeStandbyIncident(move,"Standby cancelled by Control");
    }else if(standbyIncident){
      standbyIncident.sceneStatus="Return Home";
      standbyIncident.applianceStatuses ||= {};
      standbyIncident.applianceStatuses[move.callsign]="Return to Home Station";
    }
    pushEvent(action,move); touch();
    return res.json({ok:true,move,standbyIncident,command:queueCommand(action,{id:move.id,callsign:move.callsign,incidentId:standbyIncident?.id})});
  }

  if(action==="ackStandbyMove"){
    const move=state.standbyMoves.find(m=>String(m.id)===String(data.id||data.moveId));
    if(!move) return res.status(404).json({ok:false,error:"Standby move not found"});

    move.state="acknowledged";
    move.status="Mobile to Standby Station";
    move.acknowledgedAt=now();

    if(state.units?.[move.callsign]){
      state.units[move.callsign]={...state.units[move.callsign],status:"Mobile to Standby Station"};
    }

    const standbyIncident=resolveIncidentForCommand(null,move.id) || activeStandbyIncident(move.id);
    if(standbyIncident){
      persistLocalIncidentAck(standbyIncident,move.callsign);
      standbyIncident.sceneStatus="Mobile to Standby Station";
      standbyIncident.applianceStatuses ||= {};
      standbyIncident.applianceStatuses[move.callsign]="Mobile to Standby Station";
    }

    pushEvent("standbyMoveAcknowledged",move);
    touch();

    return res.json({
      ok:true,
      move,
      standbyIncident,
      command:queueCommand("ackStandbyMove",{
        id:move.id,
        callsign:move.callsign,
        incidentId:standbyIncident?.id
      })
    });
  }


  if(action==="webMdtAck"){
    const cs=String(data.callsign||"").trim().toUpperCase();
    const requestedId=data.incidentId||data.id;

    let legacyStandbyMoveId=data.standbyMoveId;
    if(!legacyStandbyMoveId && String(requestedId||"").startsWith("STBY-")){
      const legacy=(state.standbyIncidents||[]).find(i=>String(i?.id||"")===String(requestedId));
      legacyStandbyMoveId=legacy?.standbyMoveId;
    }

    const inc=resolveIncidentForCommand(requestedId,legacyStandbyMoveId);

    if(inc){
      persistLocalIncidentAck(inc,cs);

      // ALWAYS send the real authoritative incident ID to FiveM.
      data.incidentId=String(inc.id||requestedId||"");
      if(inc.standbyMoveId) data.standbyMoveId=inc.standbyMoveId;

      pushEvent("incidentAcknowledged",{
        incidentId:inc.id,
        standbyMoveId:inc.standbyMoveId,
        callsign:cs,
        acknowledgedAt:inc.acknowledgedAt?.[cs]
      });
      touch();
    }
  }
  // Emergency incident mobilisation automatically supersedes standby.
  if(action==="assignAppliance" && data.assign !== false && !data.standby){
    const cs=String(data.callsign||data.appliance||"").trim().toUpperCase();
    const move=activeStandby(cs);
    if(move){
      move.state="superseded"; move.status="Superseded by Incident";
      move.supersededAt=now(); move.supersededByIncident=data.incidentId||data.id||null;
      const standbyIncident=closeStandbyIncident(move,`Superseded by incident ${move.supersededByIncident||""}`.trim());
      if(standbyIncident) standbyIncident.supersededByIncident=move.supersededByIncident;
      pushEvent("standbyMoveSuperseded",move); touch();
    }
  }


  if(action==="assignAppliance" && data.assign === false){
    const cs=String(data.callsign||data.appliance||"").trim().toUpperCase();
    const current=resolveIncidentForCommand(data.incidentId,data.standbyMoveId);

    if(current){
      // Prefer the authoritative numeric incident ID for the FiveM command.
      if(/^\d+$/.test(String(current.id||""))){
        data.incidentId=String(current.id);
      }

      current.assignedUnits=Array.isArray(current.assignedUnits)?current.assignedUnits:[];
      current.assignedUnits=current.assignedUnits.filter(x=>
        String(typeof x==="string"?x:(x?.callsign||x?.unit||"")).trim().toUpperCase()!==cs
      );

      if(current.assignedAppliances&&Array.isArray(current.assignedAppliances)){
        current.assignedAppliances=current.assignedAppliances.filter(x=>
          String(typeof x==="string"?x:(x?.callsign||x?.unit||"")).trim().toUpperCase()!==cs
        );
      }

      if(current.applianceStatuses) delete current.applianceStatuses[cs];
      if(current.assignedRoles) delete current.assignedRoles[cs];

      addLocalIncidentTimeline(current,`${cs} released from incident`,cs);
      pushEvent("applianceReleased",{incidentId:current.id,callsign:cs});
      touch();
    }
  }


  if(action==="createIncident"){
    data.dispatchMode=String(data.dispatchMode||"INCIDENT").toUpperCase()==="STANDBY"?"STANDBY":"INCIDENT";
    data.isStandby=data.isStandby===true || data.dispatchMode==="STANDBY";
    data.category=data.isStandby?"standby":String(data.category||"incident");
    if(!String(data.type||"").trim()){
      data.type=data.isStandby?"STANDBY DUTIES":"INCIDENT";
    }
  }

  
  if(action==="updateIncident"){
    if(data.additionalDetails!=null && data.details==null) data.details=data.additionalDetails;
    if(data.details!=null) data.notes=data.details;
    const standbyType=String(data.type||"").trim().toUpperCase()==="STANDBY DUTIES";
    data.isStandby=standbyType;
    data.dispatchMode=standbyType?"STANDBY":"INCIDENT";
    data.category=standbyType?"standby":"incident";
    if(!standbyType) data.standbyDestination="";
  }


  if(action==="returnStandbyIncident"){
    const cs=String(data.callsign||"").trim().toUpperCase();
    const inc=resolveIncidentForCommand(data.incidentId,data.standbyMoveId);
    if(!inc) return res.status(404).json({ok:false,error:"Standby incident not found"});
    if(!(inc.isStandby || String(inc.type||"").toUpperCase()==="STANDBY DUTIES")){
      return res.status(409).json({ok:false,error:"Incident is not a standby duty"});
    }
    data.incidentId=inc.id;
    inc.sceneStatus="RETURN TO HOME STATION";
    inc.applianceStatuses ||= {};
    inc.applianceStatuses[cs]="Return to Home Station";
    addLocalIncidentTimeline(inc,`Control instructed ${cs} to return to home station`,cs);
    if(state.units?.[cs]) state.units[cs]={...state.units[cs],status:"Return to Home Station"};
    if(state.bookings?.[cs]) state.bookings[cs]={...state.bookings[cs],status:"Return to Home Station"};
    pushEvent("standbyReturnHome",{incidentId:inc.id,callsign:cs});
    touch();
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
      const move=activeStandby(cs);
      if(move){
        const st=String(data.status||state.units[cs].status||"");
        move.status=st;
        if(/mobile to standby/i.test(st)) move.state="mobile";
        if(/available standby/i.test(st)) move.state="available";
        const standbyIncident=activeStandbyIncident(move.id);
        if(standbyIncident){
          standbyIncident.sceneStatus=st;
          standbyIncident.applianceStatuses ||= {};
          standbyIncident.applianceStatuses[cs]=st;
        }
      }
      // Apply the status to the live incident immediately. This is important for
      // integrated STANDBY DUTIES, which intentionally has no separate standbyMove.
      for(const inc of state.incidents||[]){
        if(String(inc.status||"").toUpperCase()==="CLOSED") continue;
        const assigned=(inc.assignedUnits||inc.assignedAppliances||[])
          .map(x=>String(typeof x==="string"?x:(x?.callsign||x?.unit||"")).toUpperCase());
        if(!assigned.includes(cs)) continue;
        inc.applianceStatuses ||= {};
        const previous=String(inc.applianceStatuses[cs]||"");
        const nextStatus=String(data.status||state.units[cs].status||"");
        inc.applianceStatuses[cs]=nextStatus;
        if(nextStatus && previous.toUpperCase()!==nextStatus.toUpperCase()){
          addLocalIncidentTimeline(inc,`${cs} status changed to ${nextStatus}`,cs);
        }
        if(inc.isStandby || String(inc.type||"").toUpperCase()==="STANDBY DUTIES"){
          inc.sceneStatus=nextStatus;
        }
      }
      if(state.bookings?.[cs]) state.bookings[cs]={...state.bookings[cs],status:state.units[cs].status};
      const finalStatus=String(state.units[cs].status||"").toLowerCase();
      if(finalStatus==="home station" || finalStatus==="mobile and available"){
        const move=activeStandby(cs);
        if(move){
          move.state="completed";move.status="Standby Completed";move.completedAt=now();
          closeStandbyIncident(move,"Returned from standby");pushEvent("standbyMoveCompleted",move);
        }
        for(const inc of state.incidents||[]){
          if(String(inc.status||"").toUpperCase()==="CLOSED")continue;
          if(!(inc.isStandby || String(inc.type||"").toUpperCase()==="STANDBY DUTIES"))continue;
          if(!(inc.assignedUnits||[]).map(x=>String(x).toUpperCase()).includes(cs))continue;
          inc.assignedUnits=(inc.assignedUnits||[]).filter(x=>String(x).toUpperCase()!==cs);
          if(inc.assignedAppliances) inc.assignedAppliances=inc.assignedAppliances.filter(x=>String(x).toUpperCase()!==cs);
          if(inc.applianceStatuses) delete inc.applianceStatuses[cs];
          if(inc.assignedRoles) delete inc.assignedRoles[cs];
          addLocalIncidentTimeline(inc,`${cs} returned home and cleared standby duties`,cs);
          if((inc.assignedUnits||[]).length===0){
            inc.status="CLOSED";inc.sceneStatus="STANDBY COMPLETED";inc.closedAt=now();
          }
        }
      }
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
app.get("/api/operational/standby-incidents",(_req,res)=>res.json({ok:true,incidents:state.standbyIncidents||[]}));
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

app.listen(PORT,"0.0.0.0",()=>console.log(`Guardian Operations v2.5.1.1 Turnout + Incident Fix running on port ${PORT}`));
