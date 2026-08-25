import express from "express";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 10000);
const API_KEY = process.env.GUARDIAN_API_KEY || "";

app.disable("x-powered-by");
app.use(express.json({ limit: "4mb" }));



// ============================================================
// Guardian Administration v1
// Server-side protected Settings / Users / Audit / Configuration
// ============================================================
const GUARDIAN_ADMIN_SESSION_SECRET=process.env.GUARDIAN_ADMIN_SESSION_SECRET||process.env.GUARDIAN_SESSION_SECRET||"";
const GUARDIAN_OWNER_USERNAME=String(process.env.GUARDIAN_OWNER_USERNAME||"owner").trim();
const GUARDIAN_OWNER_PASSWORD=String(process.env.GUARDIAN_OWNER_PASSWORD||"");

const guardianAdminSessions=new Map();
const guardianAdminAudit=[];
const guardianAdminUsers=new Map();
let guardianConfig={
  stations:[{"name":"Berwick Fire Station","postal":"4011","active":true},{"name":"Coldstream Fire Station","postal":"7287","active":true},{"name":"Crewe Toll Fire Station","postal":"7039","active":true},{"name":"McDonald Road Fire Station","postal":"7326","active":true},{"name":"Musselburgh Fire Station","postal":"9092","active":true},{"name":"Sighthill Fire Station","postal":"7246","active":true},{"name":"Dalkeith Fire Station","postal":"","active":true},{"name":"North Berwick Fire Station","postal":"","active":true},{"name":"Tollcross Fire Station","postal":"","active":true},{"name":"Pegswood Fire Station","postal":"","active":true}],
  appliances:[{"callsign":"J01C1","station":"Dalkeith Fire Station","type":"Command Unit","skills":["Command Unit"],"active":true},{"callsign":"J02G1","station":"Musselburgh Fire Station","type":"Wildfire Unit","skills":["Wildfire Unit"],"active":true},{"callsign":"J02G2","station":"Musselburgh Fire Station","type":"Wildfire Unit","skills":["Wildfire Unit"],"active":true},{"callsign":"J02P1","station":"Musselburgh Fire Station","type":"Pump","skills":["Pump"],"active":true},{"callsign":"J22Z6","station":"North Berwick Fire Station","type":"Specialist Appliance","skills":["Specialist Appliance"],"active":true},{"callsign":"J27P6","station":"Coldstream Fire Station","type":"Pump","skills":["Pump"],"active":true},{"callsign":"K01P1","station":"Crewe Toll Fire Station","type":"Pump","skills":["Pump"],"active":true},{"callsign":"K01P2","station":"Crewe Toll Fire Station","type":"Pump","skills":["Pump"],"active":true},{"callsign":"K01T1","station":"Crewe Toll Fire Station","type":"Water Carrier","skills":["Water Carrier"],"active":true},{"callsign":"K02A1","station":"McDonald Road Fire Station","type":"Aerial Appliance","skills":["Aerial Appliance"],"active":true},{"callsign":"K02H1","station":"McDonald Road Fire Station","type":"Specialist Appliance","skills":["Specialist Appliance"],"active":true},{"callsign":"K02P1","station":"McDonald Road Fire Station","type":"Pump","skills":["Pump"],"active":true},{"callsign":"K02P2","station":"McDonald Road Fire Station","type":"Pump","skills":["Pump"],"active":true},{"callsign":"K06P1","station":"Sighthill Fire Station","type":"Pump","skills":["Pump"],"active":true},{"callsign":"K06P2","station":"Sighthill Fire Station","type":"Pump","skills":["Pump"],"active":true},{"callsign":"K06R1","station":"Sighthill Fire Station","type":"Rescue Appliance","skills":["Rescue Appliance"],"active":true},{"callsign":"K07A1","station":"Tollcross Fire Station","type":"Turntable Ladder","skills":["Turntable Ladder"],"active":true},{"callsign":"N04A1","station":"Pegswood Fire Station","type":"Aerial Appliance","skills":["Aerial Appliance"],"active":true},{"callsign":"N14P1","station":"Berwick Fire Station","type":"Pump","skills":["Pump"],"active":true},{"callsign":"N14P6","station":"Berwick Fire Station","type":"Wildfire Unit","skills":["Wildfire Unit"],"active":true},{"callsign":"N14W1","station":"Berwick Fire Station","type":"Swift Water Rescue","skills":["Swift Water Rescue"],"active":true}],
  applianceTypes:["Pump","Aerial","Rescue","Specialist"],
  skills:[],
  statuses:[
    "Available","Mobilised","Mobile to Incident","In Attendance at Incident",
    "Available At Incident","Mobile And Available","Home Station",
    "Mobile to Standby Station","Available Standby Station","Return to Home Station","Off Run"
  ],
  map:{stations:{}},
  alerts:{},
  general:{}
};

function guardianAdminCookieMap(req){
  const out={};
  for(const part of String(req.headers.cookie||"").split(";")){
    const i=part.indexOf("=");
    if(i>0) out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1).trim());
  }
  return out;
}
function guardianAdminSign(v){
  if(!GUARDIAN_ADMIN_SESSION_SECRET)return "";
  return crypto.createHmac("sha256",GUARDIAN_ADMIN_SESSION_SECRET).update(v).digest("hex");
}
function guardianAdminSetCookie(res,token){
  const signed=`${token}.${guardianAdminSign(token)}`;
  res.setHeader("Set-Cookie",`guardian_admin=${encodeURIComponent(signed)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200; Secure`);
}
function guardianAdminClearCookie(res){
  res.setHeader("Set-Cookie","guardian_admin=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure");
}
function guardianAdminHashPassword(password,saltHex){
  const salt=saltHex?Buffer.from(saltHex,"hex"):crypto.randomBytes(16);
  const hash=crypto.scryptSync(String(password),salt,64);
  return {salt:salt.toString("hex"),hash:hash.toString("hex")};
}
function guardianAdminVerify(password,user){
  if(!user?.salt||!user?.passwordHash)return false;
  const test=guardianAdminHashPassword(password,user.salt).hash;
  try{return crypto.timingSafeEqual(Buffer.from(test,"hex"),Buffer.from(user.passwordHash,"hex"))}catch{return false}
}
function guardianAdminAuditLog(actor,action,details={}){
  guardianAdminAudit.unshift({
    id:crypto.randomUUID(),at:new Date().toISOString(),
    actor:String(actor||"SYSTEM"),action:String(action||"UNKNOWN"),details
  });
  guardianAdminAudit.splice(500);
}
function guardianBootstrapOwner(){
  if(guardianAdminUsers.has(GUARDIAN_OWNER_USERNAME))return;
  if(!GUARDIAN_OWNER_PASSWORD)return;
  const pw=guardianAdminHashPassword(GUARDIAN_OWNER_PASSWORD);
  guardianAdminUsers.set(GUARDIAN_OWNER_USERNAME,{
    username:GUARDIAN_OWNER_USERNAME,
    role:"owner",
    displayName:"Owner / Creator",
    protected:true,
    salt:pw.salt,
    passwordHash:pw.hash,
    createdAt:new Date().toISOString()
  });
  guardianAdminAuditLog("SYSTEM","OWNER_BOOTSTRAPPED",{username:GUARDIAN_OWNER_USERNAME});
}
guardianBootstrapOwner();

function guardianAdminReadSession(req){
  const raw=guardianAdminCookieMap(req).guardian_admin;
  if(!raw)return null;
  const dot=raw.lastIndexOf(".");
  if(dot<1)return null;
  const token=raw.slice(0,dot),sig=raw.slice(dot+1),expected=guardianAdminSign(token);
  if(!expected||sig.length!==expected.length)return null;
  try{if(!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return null}catch{return null}
  const s=guardianAdminSessions.get(token);
  if(!s)return null;
  if(Date.now()-s.createdAt>12*60*60*1000){guardianAdminSessions.delete(token);return null}
  return s;
}
function guardianAdminCan(role,permission){
  if(role==="owner")return true;
  if(role==="admin")return permission!=="owner.manage";
  if(role==="dev")return !["owner.manage","users.delete","security.manage"].includes(permission);
  if(role==="readonly")return permission==="settings.view"||permission==="audit.view";
  return false;
}
function guardianRequireAdmin(permission="settings.view"){
  return (req,res,next)=>{
    const s=guardianAdminReadSession(req);
    if(!s)return res.status(401).json({ok:false,error:"Admin login required"});
    if(!guardianAdminCan(s.role,permission))return res.status(403).json({ok:false,error:"Permission denied"});
    req.guardianAdmin=s;
    next();
  };
}

app.post("/api/admin/login",(req,res)=>{
  guardianBootstrapOwner();
  const username=String(req.body?.username||"").trim();
  const password=String(req.body?.password||"");
  const user=guardianAdminUsers.get(username);
  if(!user||!guardianAdminVerify(password,user)){
    guardianAdminAuditLog(username||"UNKNOWN","LOGIN_FAILED");
    return res.status(401).json({ok:false,error:"Invalid username or password"});
  }
  const token=crypto.randomBytes(32).toString("hex");
  guardianAdminSessions.set(token,{username:user.username,role:user.role,createdAt:Date.now()});
  guardianAdminSetCookie(res,token);
  guardianAdminAuditLog(user.username,"LOGIN");
  res.json({ok:true,user:{username:user.username,displayName:user.displayName,role:user.role}});
});

app.post("/api/admin/logout",(req,res)=>{
  const raw=guardianAdminCookieMap(req).guardian_admin;
  if(raw){const dot=raw.lastIndexOf(".");if(dot>0)guardianAdminSessions.delete(raw.slice(0,dot))}
  guardianAdminClearCookie(res);
  res.json({ok:true});
});

app.get("/api/admin/me",(req,res)=>{
  const s=guardianAdminReadSession(req);
  if(!s)return res.status(401).json({ok:false,authenticated:false});
  const u=guardianAdminUsers.get(s.username);
  res.json({ok:true,authenticated:true,user:{username:s.username,displayName:u?.displayName||s.username,role:s.role}});
});


app.get("/api/admin/baseline",guardianRequireAdmin("settings.view"),(req,res)=>{
  applyGuardianBaselineToState();
  res.json({ok:true,stations:guardianConfig.stations||[],appliances:guardianConfig.appliances||[],callSignStations:state.callSignStations,applianceSkills:state.applianceSkills});
});
app.get("/api/admin/config",guardianRequireAdmin("settings.view"),(req,res)=>{
  res.json({ok:true,config:guardianConfig});
});

app.post("/api/admin/config",guardianRequireAdmin("settings.edit"),(req,res)=>{
  const incoming=req.body?.config;
  if(!incoming||typeof incoming!=="object")return res.status(400).json({ok:false,error:"Invalid configuration"});
  guardianConfig={
    ...guardianConfig,
    ...incoming,
    map:{...(guardianConfig.map||{}),...(incoming.map||{})},
    alerts:{...(guardianConfig.alerts||{}),...(incoming.alerts||{})},
    general:{...(guardianConfig.general||{}),...(incoming.general||{})}
  };
  applyGuardianBaselineToState();
  guardianAdminAuditLog(req.guardianAdmin.username,"CONFIG_UPDATED");
  res.json({ok:true,config:guardianConfig});
});

app.get("/api/admin/users",guardianRequireAdmin("settings.view"),(req,res)=>{
  const users=[...guardianAdminUsers.values()].map(u=>({
    username:u.username,displayName:u.displayName,role:u.role,protected:!!u.protected,createdAt:u.createdAt
  }));
  res.json({ok:true,users});
});

app.post("/api/admin/users",guardianRequireAdmin("settings.edit"),(req,res)=>{
  const username=String(req.body?.username||"").trim();
  const password=String(req.body?.password||"");
  const role=String(req.body?.role||"readonly");
  const displayName=String(req.body?.displayName||username).trim();
  if(!username||password.length<8)return res.status(400).json({ok:false,error:"Username and password (8+ chars) required"});
  if(!["admin","dev","readonly"].includes(role))return res.status(400).json({ok:false,error:"Invalid role"});
  if(guardianAdminUsers.has(username))return res.status(409).json({ok:false,error:"Username already exists"});
  const pw=guardianAdminHashPassword(password);
  guardianAdminUsers.set(username,{username,displayName,role,protected:false,salt:pw.salt,passwordHash:pw.hash,createdAt:new Date().toISOString()});
  guardianAdminAuditLog(req.guardianAdmin.username,"USER_CREATED",{username,role});
  res.json({ok:true});
});

app.post("/api/admin/users/:username/password",guardianRequireAdmin("settings.edit"),(req,res)=>{
  const username=String(req.params.username||"");
  const user=guardianAdminUsers.get(username);
  if(!user)return res.status(404).json({ok:false,error:"User not found"});
  if(user.protected && req.guardianAdmin.role!=="owner")return res.status(403).json({ok:false,error:"Only Owner can change Owner password"});
  const password=String(req.body?.password||"");
  if(password.length<8)return res.status(400).json({ok:false,error:"Password must be at least 8 characters"});
  const pw=guardianAdminHashPassword(password);
  user.salt=pw.salt;user.passwordHash=pw.hash;
  guardianAdminAuditLog(req.guardianAdmin.username,"PASSWORD_RESET",{username});
  res.json({ok:true});
});

app.delete("/api/admin/users/:username",guardianRequireAdmin("users.delete"),(req,res)=>{
  const username=String(req.params.username||"");
  const user=guardianAdminUsers.get(username);
  if(!user)return res.status(404).json({ok:false,error:"User not found"});
  if(user.protected||user.role==="owner")return res.status(403).json({ok:false,error:"Owner / Creator account cannot be deleted"});
  guardianAdminUsers.delete(username);
  guardianAdminAuditLog(req.guardianAdmin.username,"USER_DELETED",{username});
  res.json({ok:true});
});

app.get("/api/admin/audit",guardianRequireAdmin("audit.view"),(req,res)=>{
  res.json({ok:true,audit:guardianAdminAudit});
});

app.get("/api/admin/export",guardianRequireAdmin("settings.view"),(req,res)=>{
  const payload={version:1,exportedAt:new Date().toISOString(),config:guardianConfig};
  guardianAdminAuditLog(req.guardianAdmin.username,"CONFIG_EXPORTED");
  res.setHeader("Content-Disposition",'attachment; filename="guardian-config-backup.json"');
  res.type("application/json").send(JSON.stringify(payload,null,2));
});

app.post("/api/admin/import",guardianRequireAdmin("settings.edit"),(req,res)=>{
  const payload=req.body;
  if(!payload?.config||typeof payload.config!=="object")return res.status(400).json({ok:false,error:"Invalid backup"});
  guardianConfig=payload.config;
  guardianAdminAuditLog(req.guardianAdmin.username,"CONFIG_IMPORTED");
  res.json({ok:true,config:guardianConfig});
});

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


function canOverrideIncidentAssignment(callsign){
  const cs=String(callsign||"").trim().toUpperCase();
  const st=String(state.units?.[cs]?.status||"").trim().toUpperCase();
  return st==="AVAILABLE AT INCIDENT" || st==="MOBILE TO INCIDENT";
}

function removeUnitFromOtherIncidents(callsign,newIncidentId){
  const cs=String(callsign||"").trim().toUpperCase();

  for(const inc of state.incidents||[]){
    if(String(inc.id||"")===String(newIncidentId||""))continue;
    if(String(inc.status||"").toUpperCase()==="CLOSED")continue;

    const assigned=(inc.assignedUnits||[]).map(x=>String(x).trim().toUpperCase());
    if(!assigned.includes(cs))continue;

    inc.assignedUnits=(inc.assignedUnits||[]).filter(x=>String(x).trim().toUpperCase()!==cs);
    if(inc.assignedAppliances){
      inc.assignedAppliances=inc.assignedAppliances.filter(x=>String(typeof x==="string"?x:(x?.callsign||x?.unit||"")).trim().toUpperCase()!==cs);
    }
    if(inc.applianceStatuses) delete inc.applianceStatuses[cs];
    if(inc.assignedRoles) delete inc.assignedRoles[cs];

    addLocalIncidentTimeline(inc,`${cs} remobilised to incident #${newIncidentId}`,cs);

    if(inc.isStandby && (inc.assignedUnits||[]).length===0){
      inc.status="CLOSED";
      inc.sceneStatus="SUPERSEDED BY INCIDENT";
      inc.closedAt=now();
      inc.supersededByIncident=newIncidentId;
    }
  }
}

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();


const guardianDataDir=process.env.GUARDIAN_DATA_DIR||path.join(__dirname,"data");
try{fs.mkdirSync(guardianDataDir,{recursive:true});}catch(_){}
const stationMapPositionsFile=path.join(guardianDataDir,"station-map-positions.json");
const stationMapLockFile=path.join(guardianDataDir,"station-map-lock.json");
let stationMapLocked=false;
try{
  if(fs.existsSync(stationMapLockFile)){
    const lockData=JSON.parse(fs.readFileSync(stationMapLockFile,"utf8"))||{};
    stationMapLocked=lockData.locked===true;
  }
}catch(e){
  console.warn("[Guardian Web] station map lock load failed:",e.message);
}
function saveStationMapLock(){
  try{
    fs.writeFileSync(stationMapLockFile,JSON.stringify({
      locked:stationMapLocked,
      updatedAt:now()
    },null,2),"utf8");
  }catch(e){
    console.error("[Guardian Web] station map lock save failed:",e.message);
  }
}

let stationMapPositions={};
try{
  if(fs.existsSync(stationMapPositionsFile)){
    stationMapPositions=JSON.parse(fs.readFileSync(stationMapPositionsFile,"utf8"))||{};
  }
}catch(e){
  console.warn("[Guardian Web] station map positions load failed:",e.message);
  stationMapPositions={};
}
function stationMapKey(name){return String(name||"").trim().toLowerCase();}
function saveStationMapPositions(){
  try{fs.writeFileSync(stationMapPositionsFile,JSON.stringify(stationMapPositions,null,2),"utf8");}
  catch(e){console.error("[Guardian Web] station map positions save failed:",e.message);}
}
function applySavedStationPositions(){
  state.stationMapPositions={...stationMapPositions};
  state.stationMapLocked=stationMapLocked;
}

const manualMapPositions={calls:new Map(),incidents:new Map()};

let state = {
  connected: false,
  coreMode: "STANDALONE",
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
  standbyIncidents: [],
  stationMapPositions: {...stationMapPositions},
  stationMapLocked: stationMapLocked
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



function applyGuardianBaselineToState(){
  state.callSignStations=state.callSignStations&&typeof state.callSignStations==="object"?state.callSignStations:{};
  state.applianceSkills=state.applianceSkills&&typeof state.applianceSkills==="object"?state.applianceSkills:{};
  state.units=state.units&&typeof state.units==="object"?state.units:{};
  state.stations=state.stations&&typeof state.stations==="object"?state.stations:{};

  for(const st of guardianConfig.stations||[]){
    if(!st?.name||st.active===false)continue;
    const key=String(st.name);
    if(!state.stations[key])state.stations[key]={name:key,postal:String(st.postal||"")};
    else{
      state.stations[key].name=key;
      if(st.postal)state.stations[key].postal=String(st.postal);
    }
  }

  for(const ap of guardianConfig.appliances||[]){
    if(!ap?.callsign||ap.active===false)continue;
    const cs=String(ap.callsign).trim().toUpperCase();
    state.callSignStations[cs]=String(ap.station||state.callSignStations[cs]||"");
    state.applianceSkills[cs]=Array.isArray(ap.skills)&&ap.skills.length?ap.skills:[String(ap.type||"Pump")];
    if(!state.units[cs]){
      state.units[cs]={callsign:cs,status:"Home Station",station:String(ap.station||""),type:String(ap.type||"Pump"),webOnly:true};
    }else{
      state.units[cs].callsign=cs;
      state.units[cs].station=state.callSignStations[cs];
      if(!state.units[cs].type)state.units[cs].type=String(ap.type||"Pump");
    }
  }
  state.callsigns=Array.from(new Set([...(state.callsigns||[]).map(x=>String(typeof x==="string"?x:(x?.callsign||""))).filter(Boolean),...(guardianConfig.appliances||[]).map(a=>String(a.callsign||"").toUpperCase()).filter(Boolean)]));
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

  next.acknowledgedBy={...(old.acknowledgedBy||{}),...(fresh.acknowledgedBy||{})};
  next.acknowledgedAt={...(old.acknowledgedAt||{}),...(fresh.acknowledgedAt||{})};

  next.applianceStatuses=(fresh.applianceStatuses && Object.keys(fresh.applianceStatuses).length)
    ? {...fresh.applianceStatuses}
    : {...(old.applianceStatuses||{})};

  const mergedTimeline=[];
  const seen=new Set();

  for(const e of [...(old.timeline||[]),...(fresh.timeline||[])]){
    if(!e)continue;

    const explicit=String(e.id||e.eventId||"");
    const key=explicit
      ? `ID:${explicit}`
      : `LEGACY:${String(e.time||"")}|${String(e.text||"")}|${String(e.callsign||e.unit||"")}`;

    if(seen.has(key))continue;
    seen.add(key);
    mergedTimeline.push(e);
  }

  for(const rawCs of next.assignedUnits||[]){
    const cs=String(typeof rawCs==="string"?rawCs:(rawCs?.callsign||rawCs?.unit||"")).toUpperCase();
    if(!cs)continue;

    if(next.acknowledgedBy?.[cs] && !next.timeline.some(e=>
      String(e?.text||"").toUpperCase()===`${cs} ACKNOWLEDGED INCIDENT`
    )){
      next.timeline.push({
        id:`ACK:${next.id}:${cs}`,
        eventId:`ACK:${next.id}:${cs}`,
        time:next.acknowledgedAt?.[cs]||new Date().toLocaleTimeString("en-GB",{hour12:false}),
        text:`${cs} acknowledged incident`,
        callsign:cs
      });
    }
  }

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

app.get("/guardian-version",(_req,res)=>res.type("text/plain").send("Guardian Operations v2.7.0 Production Sync"));
app.get("/healthz",(_req,res)=>res.json({
  ok:true,
  version:"Guardian Operations v2.7.0 Production Sync",
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
  applyGuardianBaselineToState();
  applySavedStationPositions(); // persistent station map positions
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

  if(body.units && typeof body.units==="object"){
    const authoritative=normalizeUnits(body.units);
    const merged={};

    for(const [cs,incomingRaw] of Object.entries(authoritative)){
      const incoming=(incomingRaw && typeof incomingRaw==="object")
        ? {...incomingRaw}
        : {status:incomingRaw};

      merged[cs]={
        ...(state.units?.[cs]||{}),
        ...incoming,
        webStatusPending:false,
        webStatusPendingAt:null
      };
    }

    for(const [cs,current] of Object.entries(state.units||{})){
      if(!(cs in merged) && current?.webOnly===true && current?.webBooked===true){
        merged[cs]=current;
      }
    }

    state.units=merged;
  }
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
    state.incidents=merged.map(inc=>{
      const iid=String(inc?.id||"");
      const sid=String(inc?.source999Id||inc?.source999CallId||"");
      const manual=manualMapPositions.incidents.get(iid)||(sid?manualMapPositions.calls.get(sid):null);
      if(!manual)return inc;
      if(iid)manualMapPositions.incidents.set(iid,{...manual});
      return {...inc,...manual,mapAdjusted:true};
    });
  }
  if(Array.isArray(body.calls999)){
    state.calls999=dedupe999Calls(body.calls999).map(call=>{
      const manual=manualMapPositions.calls.get(String(call?.id||""));
      return manual?{...call,...manual}:call;
    });
  }
  if(Array.isArray(body.messages)) state.messages = body.messages;
  if(Array.isArray(body.callsigns)) state.callsigns = body.callsigns;
  if(body.callSignStations && typeof body.callSignStations === "object") state.callSignStations = body.callSignStations;
  if(body.applianceSkills && typeof body.applianceSkills === "object") state.applianceSkills = body.applianceSkills;
  if(body.bookings && typeof body.bookings === "object") state.bookings = body.bookings;

  state.connected = true;
  state.coreMode = "FIVEM CONNECTED";
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
  "requestStatus","setSceneStatus","standbyMove","createStandbyMove","createStandbyIncident","cancelStandbyMove","returnStandbyMove","returnStandbyIncident","ackStandbyMove","set999MapPosition","setIncidentMapPosition","setStationMapPosition","resetStationMapPosition","setStationMapLock"
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

function guardianCoreFiveMOnline(){
  if(!state.lastHeartbeat)return false;
  const ts=Date.parse(state.lastHeartbeat);
  return Number.isFinite(ts) && Date.now()-ts<15000;
}
function guardianCoreRefreshMode(){
  state.connected=guardianCoreFiveMOnline();
  state.coreMode=state.connected?"FIVEM CONNECTED":"STANDALONE";
}
function guardianCoreIncidentId(){
  const used=new Set((state.incidents||[]).map(i=>String(i.id||"")));
  for(let i=0;i<1000;i++){
    const candidate=String(Math.floor(10000+Math.random()*90000));
    if(!used.has(candidate))return candidate;
  }
  return String(Date.now()).slice(-5);
}
function guardianCoreIncident(value){
  return (state.incidents||[]).find(i=>String(i.id||"")===String(value||""));
}
function guardianCoreAssigned(inc){
  return Array.isArray(inc?.assignedUnits)?inc.assignedUnits:
         Array.isArray(inc?.assignedAppliances)?inc.assignedAppliances:
         Array.isArray(inc?.appliances)?inc.appliances:[];
}
function guardianCoreSetAssigned(inc,list){
  inc.assignedUnits=[...list];
  inc.assignedAppliances=[...list];
  inc.appliances=[...list];
}
function guardianCoreTimeline(inc,text,callsign="",kind="event"){
  if(!inc)return;
  inc.timeline=Array.isArray(inc.timeline)?inc.timeline:[];
  const cs=String(callsign||"").trim().toUpperCase();
  const message=String(text||"");
  const last=inc.timeline[inc.timeline.length-1];
  if(last && String(last.text||"")===message && String(last.callsign||"").toUpperCase()===cs)return;
  inc.timeline.push({
    id:id(),
    eventId:id(),
    time:new Date().toLocaleTimeString("en-GB",{hour12:false}),
    at:now(),
    text:message,
    callsign:cs||undefined,
    kind
  });
}
function guardianCoreApply(action,data={}){
  guardianCoreRefreshMode();

  if(action==="createIncident"){
    const incidentNumber=String(data.incidentNumber||data.id||guardianCoreIncidentId());
    const existing=guardianCoreIncident(incidentNumber);
    if(existing)return {incident:existing,alreadyExists:true};

    const inc=normaliseIncidentLive({
      ...data,
      id:incidentNumber,
      incidentNumber,
      status:"ONGOING",
      sceneStatus:data.sceneStatus||"",
      assignedUnits:[],
      assignedAppliances:[],
      appliances:[],
      assignedRoles:{},
      applianceStatuses:{},
      acknowledgedBy:{},
      acknowledgedAt:{},
      resourceRequests:[],
      timeline:[],
      createdAt:now(),
      coreOwned:true,
      sendMDT:data.enableMDT===true,
      sendTurnout:data.enableTurnout===true,
      sendPager:data.enablePager===true
    });
    guardianCoreTimeline(inc,"Incident created","","incidentCreated");
    state.incidents=Array.isArray(state.incidents)?state.incidents:[];
    state.incidents.unshift(inc);
    pushEvent("incidentCreated",inc);
    touch();
    return {incident:inc};
  }

  const inc=guardianCoreIncident(data.incidentId||data.id);

  if(action==="updateIncident" && inc){
    const protectedKeys=new Set(["id","incidentNumber","timeline","assignedUnits","assignedAppliances","appliances","applianceStatuses","acknowledgedBy","acknowledgedAt"]);
    for(const [key,value] of Object.entries(data)){
      if(!protectedKeys.has(key) && value!==undefined)inc[key]=value;
    }
    inc.updatedAt=now();
    guardianCoreTimeline(inc,"Incident details updated","","incidentUpdated");
    pushEvent("incidentUpdated",inc);
    touch();
    return {incident:inc};
  }

  if(action==="closeIncident" && inc){
    inc.status="CLOSED";
    inc.sceneStatus=data.sceneStatus||"Closed";
    inc.closedAt=now();
    guardianCoreTimeline(inc,"Incident closed","","incidentClosed");
    pushEvent("incidentClosed",inc);
    touch();
    return {incident:inc};
  }

  if(action==="reopenIncident" && inc){
    inc.status="ONGOING";
    inc.sceneStatus=data.sceneStatus||"Reopened";
    delete inc.closedAt;
    guardianCoreTimeline(inc,"Incident reopened","","incidentReopened");
    pushEvent("incidentReopened",inc);
    touch();
    return {incident:inc};
  }

  if((action==="assignAppliance" || action==="unassignAppliance") && inc){
    const cs=String(data.callsign||data.appliance||"").trim().toUpperCase();
    if(!cs)return {};

    let assigned=guardianCoreAssigned(inc).map(x=>String(typeof x==="string"?x:(x?.callsign||x?.unit||"")).trim().toUpperCase()).filter(Boolean);

    if(action==="assignAppliance"){
      if(!assigned.includes(cs))assigned.push(cs);
      guardianCoreSetAssigned(inc,assigned);
      inc.applianceStatuses ||= {};
      inc.assignedRoles ||= {};
      if(data.role)inc.assignedRoles[cs]=String(data.role);

      state.units ||= {};
      state.units[cs]={
        ...(state.units[cs]||{}),
        callsign:cs,
        incidentId:inc.id
      };
      inc.applianceStatuses[cs]=state.units[cs].status||"MOBILISED TO THIS INCIDENT";
      guardianCoreTimeline(inc,`${cs} mobilised to incident`,cs,"mobilised");
    }else{
      assigned=assigned.filter(x=>x!==cs);
      guardianCoreSetAssigned(inc,assigned);
      if(inc.applianceStatuses)delete inc.applianceStatuses[cs];
      if(inc.assignedRoles)delete inc.assignedRoles[cs];
      if(state.units?.[cs] && String(state.units[cs].incidentId||"")===String(inc.id))delete state.units[cs].incidentId;
      guardianCoreTimeline(inc,`${cs} released from incident`,cs,"released");
    }

    pushEvent("incidentUpdated",inc);
    touch();
    return {incident:inc};
  }

  if(action==="webMdtAck" && inc){
    const cs=String(data.callsign||"").trim().toUpperCase();
    if(cs){
      inc.acknowledgedBy ||= {};
      inc.acknowledgedAt ||= {};
      if(!inc.acknowledgedBy[cs]){
        inc.acknowledgedBy[cs]=true;
        inc.acknowledgedAt[cs]=new Date().toLocaleTimeString("en-GB",{hour12:false});
        guardianCoreTimeline(inc,`${cs} acknowledged incident`,cs,"ack");
        pushEvent("incidentUpdated",inc);
        touch();
      }
    }
    return {incident:inc};
  }

  if(action==="setSceneStatus" && inc){
    inc.sceneStatus=String(data.status||data.sceneStatus||"");
    guardianCoreTimeline(inc,`Incident status: ${inc.sceneStatus}`,"","sceneStatus");
    pushEvent("incidentUpdated",inc);
    touch();
    return {incident:inc};
  }

  if(action==="setIncidentRole" && inc){
    const cs=String(data.callsign||"").trim().toUpperCase();
    if(cs){
      inc.assignedRoles ||= {};
      inc.assignedRoles[cs]=String(data.role||"");
      guardianCoreTimeline(inc,`${cs} role set to ${inc.assignedRoles[cs]}`,cs,"role");
      pushEvent("incidentUpdated",inc);
      touch();
    }
    return {incident:inc};
  }

  if(action==="createResourceRequest" && inc){
    inc.resourceRequests=Array.isArray(inc.resourceRequests)?inc.resourceRequests:[];
    const request={id:id(),...data,createdAt:now(),status:data.status||"REQUESTED"};
    inc.resourceRequests.push(request);
    guardianCoreTimeline(inc,`Resource request: ${data.type||data.resource||data.request||"Additional resource"}`,"","resourceRequest");
    pushEvent("incidentUpdated",inc);
    touch();
    return {incident:inc,resourceRequest:request};
  }

  if(action==="sendMessage" || action==="webMdtMessage"){
    const message={
      id:id(),
      sender:String(data.sender||data.callsign||"CONTROL").toUpperCase(),
      target:String(data.target||data.to||"ALL").toUpperCase(),
      to:String(data.target||data.to||"ALL").toUpperCase(),
      text:String(data.message||data.text||""),
      time:new Date().toLocaleTimeString("en-GB",{hour12:false}),
      at:now(),
      direction:action==="webMdtMessage"?"mdt_to_control":"control_to_mdt"
    };
    state.messages=Array.isArray(state.messages)?state.messages:[];
    state.messages.push(message);
    state.messages=state.messages.slice(-250);
    pushEvent("message",message);
    touch();
    return {message};
  }

  return {};
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

function addLocalIncidentTimeline(inc,text,callsign,time,{allowRepeat=false}={}){
  if(!inc)return;
  inc.timeline=Array.isArray(inc.timeline)?inc.timeline:[];
  const cs=String(callsign||"").trim().toUpperCase();
  const msg=String(text||"");
  const stamp=time||new Date().toLocaleTimeString("en-GB",{hour12:false});

  const last=inc.timeline[inc.timeline.length-1];
  if(last && String(last.text||"")===msg && String(last.callsign||"").toUpperCase()===cs){
    if(!allowRepeat)return;
    if(String(last.time||"")===String(stamp))return;
  }

  inc.timeline.push({
    time:stamp,
    text:msg,
    callsign:cs||undefined
  });

  if(inc.timeline.length>200)inc.timeline=inc.timeline.slice(-200);
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

  if(action==="setStationMapLock"){
    stationMapLocked=data.locked===true;
    state.stationMapLocked=stationMapLocked;
    saveStationMapLock();
    pushEvent("stationMapLockChanged",{locked:stationMapLocked});
    touch();
    return res.json({ok:true,locked:stationMapLocked});
  }

  if(action==="setStationMapPosition"){
    if(stationMapLocked)return res.status(423).json({ok:false,error:"Station positions are locked"});
    const stationName=String(data.stationName||data.name||"").trim();
    const x=Number(data.mapXPercent),y=Number(data.mapYPercent);
    if(!stationName||!Number.isFinite(x)||!Number.isFinite(y)){
      return res.status(400).json({ok:false,error:"Valid station and map position required"});
    }
    const pos={
      mapXPercent:Math.max(0,Math.min(100,x)),
      mapYPercent:Math.max(0,Math.min(100,y)),
      mapAdjusted:true,
      mapAdjustedAt:now(),
      mapAdjustedBy:"CONTROL"
    };
    stationMapPositions[stationMapKey(stationName)]=pos;
    state.stationMapPositions={...stationMapPositions};
    saveStationMapPositions();
    touch();
    return res.json({ok:true,position:pos});
  }

  if(action==="resetStationMapPosition"){
    if(stationMapLocked)return res.status(423).json({ok:false,error:"Station positions are locked"});
    const stationName=String(data.stationName||data.name||"").trim();
    if(!stationName)return res.status(400).json({ok:false,error:"Station required"});
    delete stationMapPositions[stationMapKey(stationName)];
    state.stationMapPositions={...stationMapPositions};
    saveStationMapPositions();
    touch();
    return res.json({ok:true});
  }

  if(action==="set999MapPosition"){
    const callId=String(data.callId||data.id||"");
    const x=Number(data.mapXPercent),y=Number(data.mapYPercent);
    if(!callId||!Number.isFinite(x)||!Number.isFinite(y)) return res.status(400).json({ok:false,error:"Valid call and map position required"});
    const pos={mapXPercent:Math.max(0,Math.min(100,x)),mapYPercent:Math.max(0,Math.min(100,y)),mapAdjusted:true,mapAdjustedAt:now(),mapAdjustedBy:"CONTROL"};
    manualMapPositions.calls.set(callId,pos);
    const call=find999(callId);if(call)Object.assign(call,pos);
    touch();
    return res.json({ok:true,position:pos});
  }

  if(action==="setIncidentMapPosition"){
    const incidentId=String(data.incidentId||data.id||"");
    const x=Number(data.mapXPercent),y=Number(data.mapYPercent);
    if(!incidentId||!Number.isFinite(x)||!Number.isFinite(y)) return res.status(400).json({ok:false,error:"Valid incident and map position required"});
    const pos={mapXPercent:Math.max(0,Math.min(100,x)),mapYPercent:Math.max(0,Math.min(100,y)),mapAdjusted:true,mapAdjustedAt:now(),mapAdjustedBy:"CONTROL"};
    manualMapPositions.incidents.set(incidentId,pos);
    const inc=(state.incidents||[]).find(i=>String(i.id||"")===incidentId);if(inc)Object.assign(inc,pos);
    touch();
    return res.json({ok:true,position:pos});
  }

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
      mapXPercent:Number.isFinite(Number(call.mapXPercent))?Number(call.mapXPercent):undefined,
      mapYPercent:Number.isFinite(Number(call.mapYPercent))?Number(call.mapYPercent):undefined,
      mapAdjusted:call.mapAdjusted===true,
      mapAdjustedAt:call.mapAdjustedAt,
      mapAdjustedBy:call.mapAdjustedBy,
      enableMDT:true,
      enableTurnout:false,
      enablePager:false
    };

    // Remove immediately so browser rerenders cannot offer the same call twice.
    suppress999(sourceId);
    state.calls999=state.calls999.filter(c=>String(c.id)!==sourceId);
    touch();

    incidentData.incidentNumber=guardianCoreIncidentId();
    const local=guardianCoreApply("createIncident",incidentData);
    const create=queueCommand("createIncident",incidentData);
    const dismiss=queueCommand("dismiss999Call",{id:sourceId,callId:sourceId,reason:"Converted to incident"});
    pushEvent("999Converted",{callId:sourceId,incidentId:local.incident?.id,createCommandId:create.id});
    return res.json({ok:true,command:create,dismissCommand:dismiss,converted:incidentData,incident:local.incident});
  }


  state.standbyMoves ||= [];
  const activeStandby=(cs)=>state.standbyMoves.find(m=>String(m.callsign||"").toUpperCase()===String(cs||"").toUpperCase() && !["cancelled","completed","superseded"].includes(m.state));

  if(action==="createStandbyMove" || action==="standbyMove"){
    const callsign=String(data.callsign||"").trim().toUpperCase();
    const destination=String(data.destination||data.station||"").trim();
    if(!callsign||!destination) return res.status(400).json({ok:false,error:"Callsign and destination station are required"});

    const u=state.units?.[callsign]||{};
    const st=String(u.status||"").toLowerCase();
    const canReceiveStandbyWhileReturning=/mobile and available|available at incident|return to home station/.test(st);
    if((u.incidentId && !canReceiveStandbyWhileReturning) || /off run|unavailable|mobile to incident|in attendance|on scene|committed/.test(st))
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

    // Guardian_control creates the authoritative numeric standby incident.
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
  // A unit at either of these statuses may be remobilised to a new incident.
  if(action==="assignAppliance" && data.assign !== false){
    const cs=String(data.callsign||data.appliance||"").trim().toUpperCase();
    if(canOverrideIncidentAssignment(cs)){
      removeUnitFromOtherIncidents(cs,data.incidentId||data.id);
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
    const requested=String(data.status||"").trim();

    if(cs && requested){
      state.units ||= {};
      state.units[cs]={
        ...(state.units[cs]||{}),
        callsign:cs,
        status:requested,
        webStatusPending:true,
        webStatusPendingAt:Date.now()
      };

      if(state.bookings?.[cs]){
        state.bookings[cs]={...state.bookings[cs],status:requested};
      }

      for(const inc of state.incidents||[]){
        if(String(inc.status||"").toUpperCase()==="CLOSED")continue;
        if(guardianCoreAssigned(inc).map(x=>String(typeof x==="string"?x:(x?.callsign||x?.unit||"")).trim().toUpperCase()).includes(cs)){
          inc.applianceStatuses ||= {};
          inc.applianceStatuses[cs]=requested;
          guardianCoreTimeline(inc,`${cs} status changed to ${requested}`,cs,"status");

          const upper=requested.toUpperCase();
          if(inc.isStandby===true){
            if(["MOBILE TO STANDBY STATION","AVAILABLE STANDBY STATION","RETURN TO HOME STATION"].includes(upper))inc.sceneStatus=requested;
          }else if(["MOBILE TO INCIDENT","IN ATTENDANCE AT INCIDENT","AVAILABLE AT INCIDENT"].includes(upper)){
            inc.sceneStatus=requested;
          }

          if(upper==="HOME STATION" || upper==="MOBILE AND AVAILABLE"){
            if(String(state.units?.[cs]?.incidentId||"")===String(inc.id||""))delete state.units[cs].incidentId;
          }
        }
      }
      pushEvent("webMdtStatusRequested",{callsign:cs,status:requested});
      touch();
    }
  }

  let coreData=data;
  if(action==="createIncident" && !data.incidentNumber){
    coreData={...data,incidentNumber:guardianCoreIncidentId()};
  }
  const localResult=guardianCoreApply(action,coreData);
  const command=queueCommand(action,coreData);
  res.json({ok:true,command,...localResult,coreMode:state.coreMode});
});

app.get("/api/fivem/commands",auth,(_req,res)=>{
  res.json({ok:true,commands:[...commands.values()].filter(c=>!c.acknowledged)});
});

app.post("/api/fivem/commands/:id/ack",auth,(req,res)=>{
  const c = commands.get(req.params.id);
  if(c){ c.acknowledged = true; c.acknowledgedAt = now(); pushEvent("commandAcknowledged",{id:c.id,action:c.action}); }
  res.json({ok:true});
});


app.get("/api/core/status",(_req,res)=>{
  guardianCoreRefreshMode();
  res.json({
    ok:true,
    core:"ONLINE",
    mode:state.coreMode,
    fivemConnected:state.connected,
    lastHeartbeat:state.lastHeartbeat,
    updatedAt:state.updatedAt
  });
});
setInterval(()=>{
  const wasConnected=state.connected;
  guardianCoreRefreshMode();
  if(wasConnected!==state.connected)touch();
},5000).unref?.();

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

app.listen(PORT,"0.0.0.0",()=>console.log(`Guardian Operations v2.7.0 Production Sync running on port ${PORT}`));
