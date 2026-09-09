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
app.use(express.json({ limit: "4mb", verify:(req,_res,buf)=>{req.rawBody=Buffer.from(buf)} }));



// ============================================================
// Guardian Administration v1
// Server-side protected Settings / Users / Audit / Configuration
// ============================================================
const GUARDIAN_ADMIN_SESSION_SECRET=String(
  process.env.GUARDIAN_ADMIN_SESSION_SECRET ||
  process.env.GUARDIAN_SESSION_SECRET ||
  process.env.GUARDIAN_OWNER_PASSWORD ||
  process.env.GUARDIAN_API_KEY ||
  "guardian-admin-local-fallback"
);
const GUARDIAN_OWNER_USERNAME=String(process.env.GUARDIAN_OWNER_USERNAME||"owner").trim();
const GUARDIAN_OWNER_PASSWORD=String(process.env.GUARDIAN_OWNER_PASSWORD||"");

const guardianAdminSessions=new Map();
const guardianAdminAudit=[];
const guardianAdminUsers=new Map();
const guardianAdminDataDir=path.join(__dirname,"data");
try{fs.mkdirSync(guardianAdminDataDir,{recursive:true})}catch{}
const guardianConfigFile=path.join(guardianAdminDataDir,"guardian-admin-config.json");
const guardianUsersFile=path.join(guardianAdminDataDir,"guardian-admin-users.json");
const guardianAuditFile=path.join(guardianAdminDataDir,"guardian-admin-audit.json");
function guardianReadJson(file,fallback){try{if(fs.existsSync(file))return JSON.parse(fs.readFileSync(file,"utf8"))}catch(e){console.warn("[Guardian Admin] load failed:",e.message)}return fallback}
function guardianWriteJson(file,value){try{fs.writeFileSync(file,JSON.stringify(value,null,2),"utf8")}catch(e){console.error("[Guardian Admin] save failed:",e.message)}}

let guardianConfig=guardianReadJson(guardianConfigFile,{
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
  general:{},
  portal:{
    siteName:"Guardian Operations",
    tagline:"Fire & Rescue Command Platform",
    welcomeTitle:"Welcome to Guardian Operations",
    welcomeSubtitle:"British emergency services roleplay platform",
    communityName:"Guardian Operations",
    discordUrl:"",
    applyEnabled:true,
    whitelistRequired:true,
    minimumAge:16,
    formsUrl:"",
    supportUrl:"",
    showMdt:true,
    showControl:true,
    showRadio:true,
    showFire:true,
    showAmbulance:false,
    showPolice:false,
    ambulanceLabel:"Coming later",
    policeLabel:"Coming later",
    applicationQuestions:["Why do you want to join Guardian?","Tell us about your roleplay experience.","Why are you interested in Fire & Rescue?"],
    brandLogoUrl:"/assets/lothian-borders-logo.png",
    communityLogoUrl:"/assets/lothian-borders-logo.png",
    heroImageUrl:"",
    heroEyebrow:"LOTHIAN & BORDERS | GUARDIAN OPERATIONS",
    heroDescription:"Access your operational systems, manage your profile, complete forms and use community tools — all in one place.",
    heroStrapline:"PEOPLE | PROFESSIONALISM | COMMUNITY",
    guidesUrl:"",
    leaveUrl:"",
    primaryColor:"#2397ff",
    backgroundColor:"#07131d",
    panelColor:"#0b1c28",
    operationalTitle:"Core Operational Systems",
    operationalIntro:"Access the core systems used across Guardian Operations. Tools are available once your whitelist application is approved.",
    mdtTitle:"Player MDT",
    mdtDescription:"Incidents, appliance status, messages and operational information.",
    controlTitle:"Control Centre",
    controlDescription:"Call handling, mobilisation, resources and live radio control.",
    radioTitle:"Radio",
    radioDescription:"Guardian IP radio channels and point-to-point communications.",
    formsTitle:"Community Forms",
    formsIntro:"Submit applications and requests to the Guardian team.",
    whitelistFormTitle:"Whitelist Application",
    whitelistFormSubtitle:"Join our community",
    leaveTitle:"Leave of Absence",
    leaveSubtitle:"Request time away",
    supportTitle:"Support Request",
    supportSubtitle:"Get help from staff",
    futureTitle:"Expanding Our Services",
    futureIntro:"More emergency services coming soon to Guardian Operations.",
    footerText:"Built by the community, for the community."
  }
});

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
function guardianAppendCookie(res,value){ res.append("Set-Cookie",value); }
function guardianAdminSetCookie(res,session,maxAge=43200){
  const createdAt=Number(session.createdAt||Date.now());
  const payload=Buffer.from(JSON.stringify({
    username:String(session.username),
    role:String(session.role),
    createdAt,
    expiresAt:createdAt+(Number(maxAge)||43200)*1000
  }),"utf8").toString("base64url");
  const signed=`${payload}.${guardianAdminSign(payload)}`;
  guardianAppendCookie(res,`guardian_admin=${encodeURIComponent(signed)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Number(maxAge)||43200}; Secure`);
}
function guardianAdminClearCookie(res){
  guardianAppendCookie(res,"guardian_admin=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure");
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
  guardianWriteJson(guardianAuditFile,guardianAdminAudit);
}
const guardianLoadedUsers=guardianReadJson(guardianUsersFile,[]);
for(const u of Array.isArray(guardianLoadedUsers)?guardianLoadedUsers:[])if(u?.username)guardianAdminUsers.set(String(u.username),u);
const guardianLoadedAudit=guardianReadJson(guardianAuditFile,[]);
if(Array.isArray(guardianLoadedAudit))guardianAdminAudit.push(...guardianLoadedAudit.slice(0,500));

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
  guardianWriteJson(guardianUsersFile,[...guardianAdminUsers.values()]);
  guardianAdminAuditLog("SYSTEM","OWNER_BOOTSTRAPPED",{username:GUARDIAN_OWNER_USERNAME});
}
guardianBootstrapOwner();

// ============================================================
// Guardian Portal / Whitelist applications
// ============================================================
const guardianApplicationsFile=path.join(guardianAdminDataDir,"guardian-applications.json");
let guardianApplications=guardianReadJson(guardianApplicationsFile,[]);
if(!Array.isArray(guardianApplications))guardianApplications=[];
function guardianSaveUsers(){guardianWriteJson(guardianUsersFile,[...guardianAdminUsers.values()])}
function guardianSaveApplications(){guardianWriteJson(guardianApplicationsFile,guardianApplications)}
// Existing operational accounts pre-date the whitelist gateway. Preserve their access.
let guardianWhitelistMigrated=false;
for(const u of guardianAdminUsers.values()){
  if(!u.whitelistStatus){u.whitelistStatus="approved";u.whitelistUpdatedAt=u.createdAt||new Date().toISOString();guardianWhitelistMigrated=true}
}
if(guardianWhitelistMigrated)guardianSaveUsers();
function guardianUserWhitelisted(username){
  const u=guardianAdminUsers.get(String(username||""));
  return !!u&&String(u.whitelistStatus||"").toLowerCase()==="approved";
}
function guardianSessionWhitelisted(session){return !!session&&guardianUserWhitelisted(session.username)}
function guardianPortalConfig(){
  const p=guardianConfig.portal||{};
  return {
    siteName:String(p.siteName||"Guardian Operations"),tagline:String(p.tagline||"Fire & Rescue Command Platform"),
    welcomeTitle:String(p.welcomeTitle||"Welcome to Guardian Operations"),welcomeSubtitle:String(p.welcomeSubtitle||"British emergency services roleplay platform"),
    communityName:String(p.communityName||"Guardian Operations"),discordUrl:String(p.discordUrl||""),formsUrl:String(p.formsUrl||""),supportUrl:String(p.supportUrl||""),
    applyEnabled:p.applyEnabled!==false,whitelistRequired:p.whitelistRequired!==false,minimumAge:Number(p.minimumAge||16),
    showMdt:p.showMdt!==false,showControl:p.showControl!==false,showRadio:p.showRadio!==false,showFire:p.showFire!==false,
    showAmbulance:p.showAmbulance!==false,showPolice:p.showPolice!==false,ambulanceLabel:String(p.ambulanceLabel||"Coming Soon"),policeLabel:String(p.policeLabel||"Coming Soon"),
    applicationQuestions:Array.isArray(p.applicationQuestions)?p.applicationQuestions:[],
    brandLogoUrl:String(p.brandLogoUrl||"/assets/lothian-borders-logo.png"),communityLogoUrl:String(p.communityLogoUrl||p.brandLogoUrl||"/assets/lothian-borders-logo.png"),heroImageUrl:String(p.heroImageUrl||""),
    heroEyebrow:String(p.heroEyebrow||"LOTHIAN & BORDERS | GUARDIAN OPERATIONS"),heroDescription:String(p.heroDescription||p.welcomeSubtitle||"Access your operational systems, manage your profile, complete forms and use community tools — all in one place."),heroStrapline:String(p.heroStrapline||"PEOPLE | PROFESSIONALISM | COMMUNITY"),
    guidesUrl:String(p.guidesUrl||""),leaveUrl:String(p.leaveUrl||""),
    primaryColor:String(p.primaryColor||"#2397ff"),backgroundColor:String(p.backgroundColor||"#07131d"),panelColor:String(p.panelColor||"#0b1c28"),
    operationalTitle:String(p.operationalTitle||"Core Operational Systems"),operationalIntro:String(p.operationalIntro||"Access the core systems used across Guardian Operations. Tools are available once your whitelist application is approved."),
    mdtTitle:String(p.mdtTitle||"Player MDT"),mdtDescription:String(p.mdtDescription||"Incidents, appliance status, messages and operational information."),
    controlTitle:String(p.controlTitle||"Control Centre"),controlDescription:String(p.controlDescription||"Call handling, mobilisation, resources and live radio control."),
    radioTitle:String(p.radioTitle||"Radio"),radioDescription:String(p.radioDescription||"Guardian IP radio channels and point-to-point communications."),
    formsTitle:String(p.formsTitle||"Community Forms"),formsIntro:String(p.formsIntro||"Submit applications and requests to the Guardian team."),
    whitelistFormTitle:String(p.whitelistFormTitle||"Whitelist Application"),whitelistFormSubtitle:String(p.whitelistFormSubtitle||"Join our community"),
    leaveTitle:String(p.leaveTitle||"Leave of Absence"),leaveSubtitle:String(p.leaveSubtitle||"Request time away"),supportTitle:String(p.supportTitle||"Support Request"),supportSubtitle:String(p.supportSubtitle||"Get help from staff"),
    futureTitle:String(p.futureTitle||"Expanding Our Services"),futureIntro:String(p.futureIntro||"More emergency services coming soon to Guardian Operations."),footerText:String(p.footerText||"Built by the community, for the community.")
  };
}

function guardianAdminReadSession(req){
  const raw=guardianAdminCookieMap(req).guardian_admin;
  if(!raw)return null;
  const dot=raw.lastIndexOf(".");
  if(dot<1)return null;
  const payload=raw.slice(0,dot),sig=raw.slice(dot+1),expected=guardianAdminSign(payload);
  if(!expected||sig.length!==expected.length)return null;
  try{if(!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return null}catch{return null}
  try{
    const session=JSON.parse(Buffer.from(payload,"base64url").toString("utf8"));
    if(!session?.username||!session?.role||!session?.createdAt)return null;
    const expiresAt=Number(session.expiresAt||0);
    if(expiresAt?Date.now()>expiresAt:Date.now()-Number(session.createdAt)>12*60*60*1000)return null;
    return session;
  }catch{return null}
}
function guardianAdminCan(role,permission){
  if(role==="owner")return true;
  if(role==="admin")return permission!=="owner.manage";
  if(role==="dev")return !["owner.manage","users.delete","security.manage"].includes(permission);
  const p=(typeof guardianRolePermissions!=="undefined"&&guardianRolePermissions&&guardianRolePermissions[role])||null;
  if(p){
    if(permission==="settings.view")return !!p.settings||!!p.staff;
    if(permission==="settings.edit")return !!p.settings;
    if(permission==="audit.view")return !!p.audit||!!p.settings;
    if(permission==="users.delete")return !!p.users&&!!p.settings;
    if(permission==="control.access")return !!p.control;
    if(permission==="mdt.access")return !!p.mdt;
    if(permission==="vehicle.assign")return !!p.staff||!!p.control;
    if(permission==="owner.manage"||permission==="security.manage")return false;
  }
  if(role==="supervisor")return ["vehicle.assign","control.access"].includes(permission);
  if(role==="control")return ["vehicle.assign","control.access"].includes(permission);
  if(role==="player")return permission==="mdt.access";
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


// ============================================================
// Guardian operational user + IRL vehicle session layer
// Keeps the existing FiveM/Control runtime intact while locking vehicle MDTs
// to a server-assigned callsign.
// ============================================================
const guardianVehicleAssignmentsFile=path.join(guardianAdminDataDir,"guardian-vehicle-assignments.json");
let guardianVehicleAssignments=guardianReadJson(guardianVehicleAssignmentsFile,{});
if(!guardianVehicleAssignments||typeof guardianVehicleAssignments!=="object"||Array.isArray(guardianVehicleAssignments))guardianVehicleAssignments={};
function guardianUserSetCookie(res,user,maxAge=43200){
  const createdAt=Date.now();
  const payload=Buffer.from(JSON.stringify({username:String(user.username),role:String(user.role),createdAt,expiresAt:createdAt+(Number(maxAge)||43200)*1000}),"utf8").toString("base64url");
  const signed=`${payload}.${guardianAdminSign(payload)}`;
  guardianAppendCookie(res,`guardian_user=${encodeURIComponent(signed)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Number(maxAge)||43200}; Secure`);
}
function guardianUserClearCookie(res){guardianAppendCookie(res,"guardian_user=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure")}
function guardianUserReadSession(req){
  const raw=guardianAdminCookieMap(req).guardian_user;if(!raw)return null;
  const dot=raw.lastIndexOf(".");if(dot<1)return null;
  const payload=raw.slice(0,dot),sig=raw.slice(dot+1),expected=guardianAdminSign(payload);
  if(!expected||sig.length!==expected.length)return null;
  try{if(!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return null}catch{return null}
  try{const session=JSON.parse(Buffer.from(payload,"base64url").toString("utf8"));if(!session?.username||!session?.role||!session?.createdAt)return null;const expiresAt=Number(session.expiresAt||0);if(expiresAt?Date.now()>expiresAt:Date.now()-Number(session.createdAt)>12*60*60*1000)return null;return session}catch{return null}
}
function guardianVehicleAssignment(username){return String(guardianVehicleAssignments[String(username||"").trim()]||"").trim().toUpperCase()}
function guardianVehicleSaveAssignments(){guardianWriteJson(guardianVehicleAssignmentsFile,guardianVehicleAssignments)}

app.post("/api/login",(req,res)=>{
  guardianBootstrapOwner();
  const username=String(req.body?.username||"").trim(),password=String(req.body?.password||"");
  const user=guardianAdminUsers.get(username);
  if(!user||!guardianAdminVerify(password,user))return res.status(401).json({ok:false,error:"Invalid username or password"});
  const remember=req.body?.remember===true;
  const maxAge=remember?7*24*60*60:12*60*60;
  guardianUserSetCookie(res,user,maxAge);
  // One sign-in should also unlock Settings for roles that are allowed to use it.
  if(["owner","admin","dev","readonly"].includes(String(user.role))) guardianAdminSetCookie(res,{username:user.username,role:user.role,createdAt:Date.now()},maxAge);
  user.lastLoginAt=new Date().toISOString();guardianWriteJson(guardianUsersFile,[...guardianAdminUsers.values()]);
  const vehicle=req.body?.vehicle===true||String(req.query?.vehicle||"")==="1";
  const requestedNext=String(req.body?.next||"").trim();
  const safeNext=requestedNext.startsWith("/")&&!requestedNext.startsWith("//")?requestedNext:"";
  const approved=guardianUserWhitelisted(user.username);
  const fallback=!approved?"/portal/?status=pending":(vehicle?"/vehicle/":(["control","supervisor","admin","dev","owner"].includes(user.role)?"/control/":"/portal/"));
  const redirect=approved&&safeNext?safeNext:fallback;
  res.json({ok:true,user:{username:user.username,displayName:user.displayName,role:user.role,whitelistStatus:user.whitelistStatus||"pending"},redirect,remembered:remember});
});
app.post("/api/logout",(req,res)=>{guardianUserClearCookie(res);guardianAdminClearCookie(res);res.json({ok:true})});
app.get("/api/session",(req,res)=>{
  const session=guardianUserReadSession(req);if(!session)return res.status(401).json({ok:false,authenticated:false});
  const user=guardianAdminUsers.get(session.username);
  res.json({ok:true,authenticated:true,user:{username:session.username,displayName:user?.displayName||session.username,role:session.role,whitelistStatus:user?.whitelistStatus||"pending"},whitelisted:guardianUserWhitelisted(session.username),callsign:guardianVehicleAssignment(session.username)});
});
app.get("/api/vehicle/session",(req,res)=>{
  const session=guardianUserReadSession(req);if(!session)return res.status(401).json({ok:false,error:"Vehicle login required"});
  const user=guardianAdminUsers.get(session.username);
  res.json({ok:true,user:{username:session.username,displayName:user?.displayName||session.username,role:session.role},callsign:guardianVehicleAssignment(session.username),developer:["owner","admin","dev"].includes(session.role)});
});
app.get("/api/vehicle/assignments",(req,res)=>{
  // Matches the current Control Centre trust model. Vehicle commands themselves are session-enforced.
  const rows=Object.entries(guardianVehicleAssignments).map(([username,callsign])=>({username,callsign:String(callsign||"").toUpperCase()})).sort((a,b)=>a.username.localeCompare(b.username));
  res.json({ok:true,assignments:rows});
});
app.post("/api/vehicle/assignments",(req,res)=>{
  const username=String(req.body?.username||"").trim();
  const callsign=String(req.body?.callsign||"").trim().toUpperCase();
  if(!username)return res.status(400).json({ok:false,error:"Username required"});
  if(!guardianAdminUsers.has(username))return res.status(404).json({ok:false,error:"Guardian user not found"});
  if(callsign){guardianVehicleAssignments[username]=callsign}else delete guardianVehicleAssignments[username];
  guardianVehicleSaveAssignments();guardianAdminAuditLog("CONTROL","VEHICLE_CALLSIGN_ASSIGNED",{username,callsign:callsign||null});
  res.json({ok:true,username,callsign});
});


// ============================================================
// Guardian IRL Radio v1 — authenticated WebRTC signalling + PTT floor control
// Audio stays peer-to-peer between the vehicle and Control. The server only
// handles presence, SDP/ICE signalling and a single-transmitter floor lock.
// ============================================================
const guardianRadioControlRuntimeToken=crypto.randomBytes(24).toString("hex");
function guardianRadioControlRuntimeSession(req){
  const token=guardianAdminCookieMap(req).guardian_control_runtime;
  if(token&&token===guardianRadioControlRuntimeToken)return {username:"web-control",role:"control",createdAt:Date.now(),runtime:true};
  return null;
}
function guardianRadioSetControlRuntimeCookie(res){
  res.setHeader("Set-Cookie",`guardian_control_runtime=${guardianRadioControlRuntimeToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200; Secure`);
}
const guardianRadioClients=new Map(); // id -> {id,role,username,callsign,res,lastSeen}
let guardianRadioFloor={holder:null,role:null,callsign:null,username:null,expiresAt:0};
function guardianRadioClientId(v){return String(v||"").replace(/[^a-zA-Z0-9:_-]/g,"").slice(0,96)}
function guardianRadioControlRole(role){return ["control","supervisor","admin","dev","owner"].includes(String(role||"").toLowerCase())}
function guardianRadioIdentity(req,requestedRole){
  const role=String(requestedRole||"").toLowerCase();

  // FiveM / browser MDT identity comes from the appliance that is already
  // booked on. It deliberately does not require a second Guardian web login.
  if(role==="mdt"){
    const callsign=String(req.query?.callsign||req.body?.callsign||"").trim().toUpperCase();
    if(!callsign||callsign==="UNSET"||callsign==="UNASSIGNED")return {error:"Book on to the MDT before using Radio Call",status:409};
    // The browser/FiveM MDT already owns its identity through the existing booking flow.
    // Accept a callsign when it is operationally live OR is a configured active appliance.
    // This avoids a race where the radio tab starts before the newest FiveM snapshot/booking
    // has reached the web process, while still refusing arbitrary unknown callsigns.
    const configured=(guardianConfig.appliances||[]).some(a=>a?.active!==false&&String(a.callsign||"").trim().toUpperCase()===callsign);
    if(!configured&&!guardianUnitOperationallyLive(callsign))return {error:"This callsign is not recognised by Guardian",status:409};
    return {role:"mdt",username:`mdt:${callsign}`,callsign};
  }

  // IRL vehicle and Control sessions remain authenticated separately.
  const session=guardianUserReadSession(req) || (role==="control" ? (guardianAdminReadSession(req)||guardianRadioControlRuntimeSession(req)) : null);
  if(!session)return null;
  if(role==="vehicle"){
    const callsign=guardianVehicleAssignment(session.username);if(!callsign)return {error:"Awaiting callsign assignment — contact Control",status:409};
    return {role:"vehicle",username:session.username,callsign};
  }
  if(role==="control"){
    if(!guardianRadioControlRole(session.role))return {error:"Control radio permission required",status:403};
    return {role:"control",username:session.username,callsign:"CONTROL"};
  }
  return {error:"Invalid radio role",status:400};
}
function guardianRadioSend(client,payload){
  try{client.res.write(`data: ${JSON.stringify(payload)}\n\n`);return true}catch{return false}
}
function guardianRadioBroadcast(payload,predicate=()=>true){
  for(const [id,c] of [...guardianRadioClients]){
    if(!predicate(c))continue;
    if(!guardianRadioSend(c,payload))guardianRadioClients.delete(id);
  }
}
function guardianRadioPresence(){
  const rows=[...guardianRadioClients.values()].map(c=>({id:c.id,role:c.role,username:c.username,callsign:c.callsign,channelId:c.channelId||null,channelName:c.channelName||null,serviceName:c.serviceName||null}));
  guardianRadioBroadcast({type:"presence",clients:rows});
}
function guardianRadioReleaseFloor(id){
  if(guardianRadioFloor.holder!==id)return;
  guardianRadioFloor={holder:null,role:null,callsign:null,username:null,expiresAt:0};
  guardianRadioBroadcast({type:"floor",floor:guardianRadioFloor});
}
setInterval(()=>{if(guardianRadioFloor.holder&&Date.now()>guardianRadioFloor.expiresAt)guardianRadioReleaseFloor(guardianRadioFloor.holder)},1000).unref?.();

app.get("/api/radio/session",(req,res)=>{
  const ident=guardianRadioIdentity(req,req.query?.role);if(!ident)return res.status(401).json({ok:false,error:"Guardian login required"});
  if(ident.error)return res.status(ident.status||400).json({ok:false,error:ident.error});
  const iceServers=[{urls:["stun:stun.l.google.com:19302","stun:stun1.l.google.com:19302"]}];
  const turnUrl=String(process.env.GUARDIAN_TURN_URL||"").trim();
  if(turnUrl)iceServers.push({urls:turnUrl,username:String(process.env.GUARDIAN_TURN_USERNAME||""),credential:String(process.env.GUARDIAN_TURN_CREDENTIAL||"")});
  res.setHeader("Cache-Control","no-store");
  res.json({ok:true,identity:ident,iceServers,turnConfigured:!!turnUrl});
});

app.get("/api/radio/events",(req,res)=>{
  const ident=guardianRadioIdentity(req,req.query?.role);if(!ident)return res.status(401).end();
  if(ident.error)return res.status(ident.status||400).end();
  const suffix=guardianRadioClientId(req.query?.clientId)||crypto.randomUUID();
  const id=`${ident.role}:${guardianRadioClientId(ident.username)}:${suffix}`;
  res.setHeader("Content-Type","text/event-stream");res.setHeader("Cache-Control","no-cache, no-transform");res.setHeader("Connection","keep-alive");res.setHeader("X-Accel-Buffering","no");res.flushHeaders?.();
  const client={id,...ident,res,lastSeen:Date.now()};guardianRadioClients.set(id,client);
  guardianRadioSend(client,{type:"hello",client:{id,role:ident.role,username:ident.username,callsign:ident.callsign},floor:guardianRadioFloor});
  guardianRadioPresence();
  const cleanup=()=>{guardianRadioClients.delete(id);guardianRadioReleaseFloor(id);guardianRadioPresence()};
  req.on("close",cleanup);req.on("aborted",cleanup);res.on("error",cleanup);
});

app.post("/api/radio/signal",(req,res)=>{
  const ident=guardianRadioIdentity(req,req.body?.role);if(!ident)return res.status(401).json({ok:false,error:"Guardian login required"});
  if(ident.error)return res.status(ident.status||400).json({ok:false,error:ident.error});
  const fromId=guardianRadioClientId(req.body?.fromId),target=guardianRadioClientId(req.body?.target),kind=String(req.body?.kind||"").slice(0,32),data=req.body?.data;
  const from=guardianRadioClients.get(fromId);
  if(!from||from.username!==ident.username||from.role!==ident.role)return res.status(403).json({ok:false,error:"Radio client session mismatch"});
  if(!["offer","answer","ice","ptt","hangup","call_request","call_accept","call_reject"].includes(kind))return res.status(400).json({ok:false,error:"Invalid radio signal"});
  const packet={type:"signal",kind,data,from:{id:from.id,role:from.role,username:from.username,callsign:from.callsign}};
  let delivered=0;
  if(target==="control"&&["vehicle","mdt"].includes(ident.role)){
    for(const c of guardianRadioClients.values())if(c.role==="control"&&guardianRadioSend(c,packet))delivered++;
  }else{
    const c=guardianRadioClients.get(target);if(c&&guardianRadioSend(c,packet))delivered++;
  }
  res.json({ok:true,delivered});
});

app.post("/api/radio/floor",(req,res)=>{
  const ident=guardianRadioIdentity(req,req.body?.role);if(!ident)return res.status(401).json({ok:false,error:"Guardian login required"});
  if(ident.error)return res.status(ident.status||400).json({ok:false,error:ident.error});
  const id=guardianRadioClientId(req.body?.clientId),action=String(req.body?.action||"");
  const client=guardianRadioClients.get(id);if(!client||client.username!==ident.username||client.role!==ident.role)return res.status(403).json({ok:false,error:"Radio client session mismatch"});
  if(action==="release"){
    guardianRadioReleaseFloor(id);return res.json({ok:true,granted:true,floor:guardianRadioFloor});
  }
  if(action!=="request")return res.status(400).json({ok:false,error:"Invalid floor action"});
  if(guardianRadioFloor.holder&&guardianRadioFloor.holder!==id&&Date.now()<=guardianRadioFloor.expiresAt)return res.json({ok:true,granted:false,floor:guardianRadioFloor});
  guardianRadioFloor={holder:id,role:ident.role,callsign:ident.callsign,username:ident.username,expiresAt:Date.now()+20000};
  guardianRadioBroadcast({type:"floor",floor:guardianRadioFloor});
  res.json({ok:true,granted:true,floor:guardianRadioFloor});
});


// ============================================================
// Guardian Radio directory, open channels and call queue
// These are Guardian IP talkgroups. They do not connect to public-safety TETRA.
// ============================================================
const guardianRadioConfigFile=path.join(guardianAdminDataDir,"guardian-radio-config.json");
const guardianRadioCalls=new Map();
const guardianRadioServiceBlueprints=[
  ["East Scotland / L&B","FLAB"],
  ["Northumberland","NFRS"],
  ["Scottish Fire and Rescue Service","SFRS"],
  ["Tyne and Wear","TWFRS"],
  ["County Durham and Darlington","CDDFRS"],
  ["Cumbria","CUMFRS"],
  ["Cleveland","CFRS"],
  ["Lancashire","LFRS"],
  ["Greater Manchester","GMFRS"],
  ["Merseyside","MFRS"],
  ["Cheshire","CFRS-CH"],
  ["West Yorkshire","WYFRS"],
  ["South Yorkshire","SYFRS"],
  ["Humberside","HFRS"],
  ["North Yorkshire","NYFRS"],
  ["Derbyshire","DFRS"],
  ["Nottinghamshire","NFRS-NOTTS"],
  ["Lincolnshire","LFR"],
  ["Leicestershire","LFRS-LEI"],
  ["Northamptonshire","NFRS-NTH"],
  ["Warwickshire","WFRS"],
  ["West Midlands","WMFS"],
  ["Staffordshire","SFRS-STAFFS"],
  ["Shropshire","SFRS-SHROPS"],
  ["Hereford & Worcester","HWFRS"],
  ["Gloucestershire","GFRS"],
  ["Avon","AFRS"],
  ["Devon & Somerset","DSFRS"],
  ["Dorset & Wiltshire","DWFRS"],
  ["Cornwall","CFRS-CORN"],
  ["Isles of Scilly","IOSFRS"],
  ["Hampshire & Isle of Wight","HIWFRS"],
  ["Royal Berkshire","RBFRS"],
  ["Oxfordshire","OFRS"],
  ["Buckinghamshire","BFRS"],
  ["Bedfordshire","BFRS-BEDS"],
  ["Cambridgeshire","CFRS-CAMB"],
  ["Norfolk","NFRS-NORF"],
  ["Suffolk","SFRS-SUFF"],
  ["Essex","ECFRS"],
  ["Hertfordshire","HFRS-HERTS"],
  ["Kent","KFRS"],
  ["Surrey","SFRS-SURREY"],
  ["East Sussex","ESFRS"],
  ["West Sussex","WSFRS"],
  ["London","LFB"],
  ["Northern Ireland","NIFRS"],
  ["Mid and West Wales","MAWWFRS"],
  ["North Wales","NWFRS"],
  ["South Wales","SWFRS"]
];
function guardianRadioDefaultConfig(){
  return {services:guardianRadioServiceBlueprints.map(([name,prefix],si)=>({
    id:`svc-${si+1}-${prefix.toLowerCase().replace(/[^a-z0-9]+/g,"-")}`,
    name,prefix,
    channels:Array.from({length:10},(_,i)=>({
      id:`${prefix.toLowerCase().replace(/[^a-z0-9]+/g,"-")}-ops-${i+1}`,
      name:`${prefix}-OPS${i+1}`,
      open:true
    }))
  }))};
}
function guardianRadioNormaliseConfig(existing){
  const defaults=guardianRadioDefaultConfig();
  if(!existing||!Array.isArray(existing.services))return defaults;

  // v37: preserve the complete configured radio network. Standard Guardian
  // services are guaranteed to contain OPS1-OPS10, while any administrator-
  // added services/talkgroups are retained instead of being discarded by
  // normalisation.
  const oldServices=existing.services||[];
  const merged=[];
  const used=new Set();

  for(const def of defaults.services){
    const aliases=def.prefix==="FLAB"?["FLAB","Lothian & Borders","East Scotland / L&B"]:[def.name];
    const oldIndex=oldServices.findIndex(s=>aliases.some(a=>String(s?.name||"").toLowerCase()===a.toLowerCase())||String(s?.prefix||"").toUpperCase()===def.prefix);
    const old=oldIndex>=0?oldServices[oldIndex]:null;
    if(oldIndex>=0)used.add(oldIndex);

    if(!old){merged.push(def);continue;}

    const oldChannels=Array.isArray(old.channels)?old.channels:[];
    const channels=[];
    const matchedOld=new Set();

    // Always provide the standard OPS1-OPS10 set for built-in services.
    for(const ch of def.channels){
      const oi=oldChannels.findIndex(c=>String(c?.name||"").replace(/\s+/g,"").toUpperCase()===ch.name.replace(/\s+/g,"").toUpperCase()||String(c?.id||"")===String(ch.id));
      const prior=oi>=0?oldChannels[oi]:null;
      if(oi>=0)matchedOld.add(oi);
      channels.push(prior?{...ch,...prior,id:prior.id||ch.id,name:prior.name||ch.name,open:prior.open===true}:ch);
    }

    // Preserve administrator-added channels beyond the standard ten.
    oldChannels.forEach((ch,oi)=>{
      if(matchedOld.has(oi)||!ch)return;
      channels.push({
        id:String(ch.id||`${String(old.prefix||def.prefix).toLowerCase().replace(/[^a-z0-9]+/g,"-")}-custom-${oi+1}`),
        name:String(ch.name||`${old.prefix||def.prefix}-OPS${channels.length+1}`),
        open:ch.open===true
      });
    });

    merged.push({...def,...old,id:old.id||def.id,name:old.name||def.name,prefix:old.prefix||def.prefix,channels});
  }

  // Preserve completely custom services created in Settings -> Radio.
  oldServices.forEach((svc,si)=>{
    if(used.has(si)||!svc)return;
    const prefix=String(svc.prefix||`SVC${si+1}`).trim().toUpperCase();
    merged.push({
      id:String(svc.id||`svc-custom-${si+1}`),
      name:String(svc.name||`Custom Service ${si+1}`),
      prefix,
      channels:(Array.isArray(svc.channels)?svc.channels:[]).map((ch,ci)=>({
        id:String(ch?.id||`${prefix.toLowerCase().replace(/[^a-z0-9]+/g,"-")}-custom-${ci+1}`),
        name:String(ch?.name||`${prefix}-OPS${ci+1}`),
        open:ch?.open===true
      }))
    });
  });

  return {services:merged};
}
const guardianRadioRawConfig=guardianReadJson(guardianRadioConfigFile,null);
let guardianRadioConfig=guardianRadioNormaliseConfig(guardianRadioRawConfig);
// v37 migration: every configured talkgroup is operationally OPEN by default.
// This runs once on upgrade. Afterward only Settings -> Radio may close one.
if(!guardianRadioRawConfig || Number(guardianRadioRawConfig.schemaVersion||0)<37){
  for(const svc of guardianRadioConfig.services||[]) for(const ch of svc.channels||[]) ch.open=true;
}
guardianRadioConfig.schemaVersion=37;
guardianWriteJson(guardianRadioConfigFile,guardianRadioConfig);
function guardianRadioFindChannel(id){
  for(const service of guardianRadioConfig.services||[]){
    const ch=(service.channels||[]).find(c=>String(c.id)===String(id));
    if(ch)return {service,ch};
  }
  return null;
}
function guardianRadioConfigForVehicle(){
  return {services:(guardianRadioConfig.services||[]).map(s=>({id:s.id,name:s.name,channels:(s.channels||[]).filter(c=>c.open===true)}))};
}
function guardianRadioControlSession(req){
  const s=guardianUserReadSession(req)||guardianAdminReadSession(req)||guardianRadioControlRuntimeSession(req);
  return s&&guardianRadioControlRole(s.role)?s:null;
}
app.get("/api/radio/config",(req,res)=>{
  const requestedRole=String(req.query?.role||"vehicle").toLowerCase();
  if(requestedRole==="control"){
    if(!guardianRadioControlSession(req))return res.status(403).json({ok:false,error:"Control login required"});
    return res.json({ok:true,config:guardianRadioConfig});
  }
  if(requestedRole==="mdt")return res.json({ok:true,config:guardianRadioConfigForVehicle()});
  const s=guardianUserReadSession(req);if(!s)return res.status(401).json({ok:false,error:"Vehicle login required"});
  res.json({ok:true,config:guardianRadioConfigForVehicle()});
});
// Full radio directory editing is an Administration/Settings function only.
app.get("/api/admin/radio-config",guardianRequireAdmin("settings.view"),(req,res)=>{
  res.setHeader("Cache-Control","no-store");
  res.json({ok:true,config:guardianRadioConfig});
});
app.post("/api/admin/radio-config",guardianRequireAdmin("settings.edit"),(req,res)=>{
  const incoming=req.body?.config;
  if(!incoming||!Array.isArray(incoming.services))return res.status(400).json({ok:false,error:"Invalid radio configuration"});
  guardianRadioConfig={services:incoming.services.map((svc,si)=>({
    id:guardianRadioClientId(svc.id)||`svc-${si+1}`,
    name:String(svc.name||`Service ${si+1}`).trim().slice(0,80),
    prefix:String(svc.prefix||"").trim().slice(0,30),
    channels:(Array.isArray(svc.channels)?svc.channels:[]).map((ch,ci)=>({
      id:guardianRadioClientId(ch.id)||`ch-${si+1}-${ci+1}`,
      name:String(ch.name||`Channel ${ci+1}`).trim().slice(0,80),
      open:ch.open===true
    }))
  }))};
  guardianWriteJson(guardianRadioConfigFile,guardianRadioConfig);
  guardianAdminAuditLog(req.guardianAdmin?.username||"ADMIN","RADIO_CONFIG_UPDATED",{services:guardianRadioConfig.services.length,channels:guardianRadioConfig.services.reduce((n,s)=>n+(s.channels||[]).length,0)});
  guardianRadioBroadcast({type:"radio_config",config:guardianRadioConfigForVehicle()});
  guardianRadioBroadcast({type:"radio_config_admin",config:guardianRadioConfig},c=>c.role==="control");
  res.json({ok:true,config:guardianRadioConfig});
});

// Control can open/close already-configured talkgroups during operations, but
// cannot create, delete or rename them. Those changes live in Settings -> Radio.
app.post("/api/radio/open",(req,res)=>{
  if(!guardianRadioControlSession(req))return res.status(403).json({ok:false,error:"Control radio permission required"});
  const channelId=guardianRadioClientId(req.body?.channelId);
  const found=guardianRadioFindChannel(channelId);
  if(!found)return res.status(404).json({ok:false,error:"Channel not found"});
  found.ch.open=req.body?.open===true;
  guardianWriteJson(guardianRadioConfigFile,guardianRadioConfig);
  guardianRadioBroadcast({type:"radio_config",config:guardianRadioConfigForVehicle()});
  guardianRadioBroadcast({type:"radio_config_admin",config:guardianRadioConfig},c=>c.role==="control");
  res.json({ok:true,channel:{id:found.ch.id,name:found.ch.name,open:found.ch.open}});
});

// Legacy endpoint deliberately blocks structural edits from Control.
app.post("/api/radio/config",(req,res)=>res.status(403).json({ok:false,error:"Edit radio channels in Settings -> Radio"}));
app.post("/api/radio/channel",(req,res)=>{
  const ident=guardianRadioIdentity(req,req.body?.role);if(!ident)return res.status(401).json({ok:false,error:"Guardian login required"});
  if(ident.error)return res.status(ident.status||400).json({ok:false,error:ident.error});
  const clientId=guardianRadioClientId(req.body?.clientId),channelId=guardianRadioClientId(req.body?.channelId);
  const client=guardianRadioClients.get(clientId);if(!client||client.username!==ident.username||client.role!==ident.role)return res.status(403).json({ok:false,error:"Radio client session mismatch"});
  if(!channelId){client.channelId=null;client.channelName=null;client.serviceId=null;client.serviceName=null;guardianRadioPresence();return res.json({ok:true,channel:null});}
  const found=guardianRadioFindChannel(channelId);if(!found||found.ch.open!==true)return res.status(409).json({ok:false,error:"Channel is not open"});
  client.channelId=found.ch.id;client.channelName=found.ch.name;client.serviceId=found.service.id;client.serviceName=found.service.name;
  guardianRadioPresence();
  res.json({ok:true,channel:{id:found.ch.id,name:found.ch.name,serviceId:found.service.id,serviceName:found.service.name}});
});
app.post("/api/radio/call",(req,res)=>{
  const ident=guardianRadioIdentity(req,req.body?.role);if(!ident)return res.status(401).json({ok:false,error:"Guardian login required"});
  if(ident.error)return res.status(ident.status||400).json({ok:false,error:ident.error});
  const clientId=guardianRadioClientId(req.body?.clientId),action=String(req.body?.action||"").toLowerCase();
  const client=guardianRadioClients.get(clientId);if(!client||client.username!==ident.username||client.role!==ident.role)return res.status(403).json({ok:false,error:"Radio client session mismatch"});
  if(action==="request"){
    if(!["vehicle","mdt"].includes(ident.role))return res.status(400).json({ok:false,error:"Only MDT clients initiate this call type"});
    const found=guardianRadioFindChannel(req.body?.channelId||client.channelId);
    // Keypad private calls to Control do not require a talkgroup. If the unit is
    // already on a channel we include it as context, otherwise the direct call is
    // explicitly marked NULL / PRIVATE CONTROL.
    if(found&&found.ch.open===true){
      client.channelId=found.ch.id;client.channelName=found.ch.name;client.serviceName=found.service.name;
    }
    const call={id:crypto.randomUUID(),direction:"unit_to_control",status:"ringing",vehicleClientId:client.id,callsign:client.callsign,username:client.username,serviceId:found?.service?.id||client.serviceId||req.body?.serviceId||null,serviceName:found?.service?.name||client.serviceName||"PRIVATE CONTROL",channelId:found?.ch?.id||null,channelName:found?.ch?.name||"NULL",urgency:String(req.body?.urgency||req.body?.dialed||"1").replace(/[^0-9]/g,"").slice(0,2)||"1",createdAt:new Date().toISOString(),controlClientId:null};
    guardianRadioCalls.set(call.id,call);
    guardianRadioBroadcast({type:"radio_call",action:"ringing",call},c=>c.role==="control");
    return res.json({ok:true,call});
  }
  if(action==="control_request"){
    if(ident.role!=="control")return res.status(403).json({ok:false,error:"Control only"});
    const targetId=guardianRadioClientId(req.body?.targetClientId);
    const target=guardianRadioClients.get(targetId);
    if(!target||!["vehicle","mdt"].includes(target.role))return res.status(404).json({ok:false,error:"Selected unit radio is not online"});
    const call={id:crypto.randomUUID(),direction:"control_to_unit",status:"ringing",vehicleClientId:target.id,callsign:target.callsign,username:target.username,serviceId:target.serviceId||null,serviceName:target.serviceName||"CONTROL",channelId:target.channelId||null,channelName:target.channelName||"DIRECT CONTROL",urgency:"CONTROL",createdAt:new Date().toISOString(),controlClientId:client.id};
    guardianRadioCalls.set(call.id,call);
    guardianRadioSend(target,{type:"radio_call",action:"control_ringing",call});
    guardianRadioBroadcast({type:"radio_call",action:"control_ringing",call},c=>c.role==="control");
    return res.json({ok:true,call});
  }
  const call=guardianRadioCalls.get(String(req.body?.callId||""));if(!call)return res.status(404).json({ok:false,error:"Call not found"});
  if(action==="answer"){
    const controlInitiated=call.direction==="control_to_unit";
    if(controlInitiated){
      if(!["vehicle","mdt"].includes(ident.role)||client.id!==call.vehicleClientId)return res.status(403).json({ok:false,error:"Called unit only"});
    }else{
      if(ident.role!=="control")return res.status(403).json({ok:false,error:"Control only"});
      call.controlClientId=client.id;
    }
    call.status="connected";call.answeredAt=new Date().toISOString();
    guardianRadioSend(guardianRadioClients.get(call.vehicleClientId),{type:"radio_call",action:"answered",call});
    if(call.controlClientId)guardianRadioSend(guardianRadioClients.get(call.controlClientId),{type:"radio_call",action:"answered",call});
    guardianRadioBroadcast({type:"radio_call",action:"answered",call},c=>c.role==="control");
    return res.json({ok:true,call});
  }
  if(action==="reject"||action==="end"){
    const allowed=ident.role==="control"||client.id===call.vehicleClientId;if(!allowed)return res.status(403).json({ok:false,error:"Not permitted"});
    call.status=action==="reject"?"rejected":"ended";call.endedAt=new Date().toISOString();
    const evt={type:"radio_call",action:call.status,call};
    guardianRadioSend(guardianRadioClients.get(call.vehicleClientId),evt);
    if(call.controlClientId)guardianRadioSend(guardianRadioClients.get(call.controlClientId),evt);
    guardianRadioBroadcast(evt,c=>c.role==="control");
    guardianRadioCalls.delete(call.id);guardianRadioReleaseFloor(call.vehicleClientId);if(call.controlClientId)guardianRadioReleaseFloor(call.controlClientId);
    return res.json({ok:true});
  }
  return res.status(400).json({ok:false,error:"Invalid call action"});
});
app.get("/api/radio/calls",(req,res)=>{
  if(!guardianRadioControlSession(req))return res.status(403).json({ok:false,error:"Control login required"});
  res.json({ok:true,calls:[...guardianRadioCalls.values()]});
});

app.post("/api/admin/login",(req,res)=>{
  guardianBootstrapOwner();
  const username=String(req.body?.username||"").trim();
  const password=String(req.body?.password||"");
  const user=guardianAdminUsers.get(username);
  if(!user||!guardianAdminVerify(password,user)){
    guardianAdminAuditLog(username||"UNKNOWN","LOGIN_FAILED");
    return res.status(401).json({ok:false,error:"Invalid username or password"});
  }
  const session={username:user.username,role:user.role,createdAt:Date.now()};
  guardianAdminSetCookie(res,session);
  guardianAdminAuditLog(user.username,"LOGIN");
  res.json({ok:true,user:{username:user.username,displayName:user.displayName,role:user.role}});
});

app.post("/api/admin/logout",(req,res)=>{
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

app.post("/api/admin/station-map/position",guardianRequireAdmin("settings.edit"),(req,res)=>{
  if(stationMapLocked)return res.status(423).json({ok:false,error:"Station positions are locked"});
  const stationName=String(req.body?.stationName||"").trim();
  const x=Number(req.body?.mapXPercent),y=Number(req.body?.mapYPercent);
  if(!stationName||!Number.isFinite(x)||!Number.isFinite(y)){
    return res.status(400).json({ok:false,error:"Valid stationName, mapXPercent and mapYPercent required"});
  }
  const pos={
    mapXPercent:Math.max(0,Math.min(100,x)),
    mapYPercent:Math.max(0,Math.min(100,y)),
    mapAdjusted:true,
    mapAdjustedAt:now(),
    mapAdjustedBy:req.guardianAdmin.username
  };
  const key=stationMapKey(stationName);
  stationMapPositions[key]=pos;
  applySavedStationPositions();
  saveStationMapPositions();
  guardianAdminAuditLog(req.guardianAdmin.username,"STATION_MAP_POSITION",{stationName,...pos});
  touch(); // pushes the changed state to Control immediately over SSE
  res.json({ok:true,stationName,key,position:pos,stationMapPositions:state.stationMapPositions});
});

app.delete("/api/admin/station-map/position/:station",guardianRequireAdmin("settings.edit"),(req,res)=>{
  if(stationMapLocked)return res.status(423).json({ok:false,error:"Station positions are locked"});
  const stationName=decodeURIComponent(String(req.params.station||"")).trim();
  const key=stationMapKey(stationName);
  delete stationMapPositions[key];
  applySavedStationPositions();
  saveStationMapPositions();
  guardianAdminAuditLog(req.guardianAdmin.username,"STATION_MAP_POSITION_RESET",{stationName});
  touch();
  res.json({ok:true,stationName,key,stationMapPositions:state.stationMapPositions});
});

app.post("/api/admin/station-map/lock",guardianRequireAdmin("settings.edit"),(req,res)=>{
  stationMapLocked=req.body?.locked===true;
  applySavedStationPositions();
  saveStationMapLock();
  guardianAdminAuditLog(req.guardianAdmin.username,"STATION_MAP_LOCK",{locked:stationMapLocked});
  touch();
  res.json({ok:true,locked:stationMapLocked});
});

function guardianAdminOperationalSnapshot(){
  applyGuardianBaselineToState();applySavedStationPositions();
  const stations=(guardianConfig.stations||[]).filter(s=>s?.active!==false).map(s=>({...s,appliances:(guardianConfig.appliances||[]).filter(a=>a.active!==false&&String(a.station||"")===String(s.name||"")).map(a=>a.callsign)}));
  const appliances=(guardianConfig.appliances||[]).filter(a=>a?.active!==false).map(a=>{const cs=String(a.callsign||"").trim().toUpperCase(),u=state.units?.[cs];return {...a,callsign:cs,status:String(u?.status||""),signedOn:guardianUnitOperationallyLive(cs)}});
  const openIncidents=(state.incidents||[]).filter(i=>String(i.status||"ONGOING").toUpperCase()!=="CLOSED");
  const activeStandby=(state.standbyMoves||[]).filter(m=>!["cancelled","completed","superseded"].includes(String(m.state||"").toLowerCase()));
  const warnings=[],stationNames=new Set(stations.map(s=>String(s.name)));
  for(const a of appliances)if(a.station&&!stationNames.has(String(a.station)))warnings.push(`${a.callsign} references missing station ${a.station}`);
  const calls=appliances.map(a=>a.callsign),dupes=[...new Set(calls.filter((x,i)=>calls.indexOf(x)!==i))];if(dupes.length)warnings.push(`Duplicate callsigns: ${dupes.join(", ")}`);
  return {stations,appliances,applianceTypes:guardianConfig.applianceTypes||[],skills:guardianConfig.skills||[],statuses:guardianConfig.statuses||[],stationMapPositions:{...stationMapPositions},stationMapLocked,warnings,summary:{stations:stations.length,appliances:appliances.length,booked:appliances.filter(a=>a.signedOn).length,incidents:openIncidents.length,calls999:dedupe999Calls(state.calls999||[]).length,standby:activeStandby.length,mappedStations:Object.keys(stationMapPositions||{}).length,fivemConnected:!!state.connected,coreMode:state.coreMode||(state.connected?"FIVEM CONNECTED":"STANDALONE"),lastHeartbeat:state.lastHeartbeat||null,updatedAt:state.updatedAt||null}};
}
app.get("/api/admin/operational",guardianRequireAdmin("settings.view"),(req,res)=>{res.setHeader("Cache-Control","no-store");res.json({ok:true,...guardianAdminOperationalSnapshot()})});

app.get("/api/admin/config",guardianRequireAdmin("settings.view"),(req,res)=>{
  res.json({ok:true,config:guardianConfig});
});


app.post("/api/admin/stations",guardianRequireAdmin("settings.edit"),(req,res)=>{
  const rows=Array.isArray(req.body?.stations)?req.body.stations:[];
  guardianConfig.stations=rows.map(x=>({serviceId:String(x.serviceId||'fire'),name:String(x.name||'').trim(),code:String(x.code||''),locationType:String(x.locationType||'Station'),postal:String(x.postal||''),active:x.active!==false}));
  guardianWriteJson(guardianConfigFile,guardianConfig);applyGuardianBaselineToState();guardianAdminAuditLog(req.guardianAdmin.username,'LOCATIONS_UPDATED',{count:guardianConfig.stations.length});res.json({ok:true,stations:guardianConfig.stations});
});
app.post("/api/admin/appliances",guardianRequireAdmin("settings.edit"),(req,res)=>{
  const rows=Array.isArray(req.body?.appliances)?req.body.appliances:[];
  guardianConfig.appliances=rows.map(x=>({...x,serviceId:String(x.serviceId||'fire'),callsign:String(x.callsign||'').trim().toUpperCase(),station:String(x.station||''),type:String(x.type||''),skills:Array.isArray(x.skills)?x.skills:[],active:x.active!==false}));
  guardianWriteJson(guardianConfigFile,guardianConfig);applyGuardianBaselineToState();guardianAdminAuditLog(req.guardianAdmin.username,'FLEET_UPDATED',{count:guardianConfig.appliances.length});res.json({ok:true,appliances:guardianConfig.appliances});
});
app.post("/api/admin/config",guardianRequireAdmin("settings.edit"),(req,res)=>{
  const incoming=req.body?.config;
  if(!incoming||typeof incoming!=="object")return res.status(400).json({ok:false,error:"Invalid configuration"});
  guardianConfig={
    ...guardianConfig,
    ...incoming,
    map:{...(guardianConfig.map||{}),...(incoming.map||{})},
    alerts:{...(guardianConfig.alerts||{}),...(incoming.alerts||{})},
    general:{...(guardianConfig.general||{}),...(incoming.general||{})},
    portal:{...(guardianConfig.portal||{}),...(incoming.portal||{}),updatedAt:Date.now()}
  };
  guardianWriteJson(guardianConfigFile,guardianConfig);
  applyGuardianBaselineToState();
  guardianAdminAuditLog(req.guardianAdmin.username,"CONFIG_UPDATED");
  res.json({ok:true,config:guardianConfig});
});

app.get("/api/admin/users",guardianRequireAdmin("settings.view"),(req,res)=>{
  const users=[...guardianAdminUsers.values()].map(u=>({
    username:u.username,displayName:u.displayName,role:u.role,protected:!!u.protected,createdAt:u.createdAt,whitelistStatus:u.whitelistStatus||"pending",whitelistUpdatedAt:u.whitelistUpdatedAt||null,
    membershipType:guardianMemberType(u),discordUserId:u.discordUserId||"",serviceAssignments:Array.isArray(u.serviceAssignments)?u.serviceAssignments:[],qualifications:Array.isArray(u.qualifications)?u.qualifications:[]
  }));
  res.json({ok:true,users});
});

app.post("/api/admin/users",guardianRequireAdmin("settings.edit"),(req,res)=>{
  const username=String(req.body?.username||"").trim();
  const password=String(req.body?.password||"");
  const role=String(req.body?.role||"readonly");
  const displayName=String(req.body?.displayName||username).trim();
  if(!username||password.length<8)return res.status(400).json({ok:false,error:"Username and password (8+ chars) required"});
  if(!["player","control","supervisor","admin","dev","readonly"].includes(role))return res.status(400).json({ok:false,error:"Invalid role"});
  if(guardianAdminUsers.has(username))return res.status(409).json({ok:false,error:"Username already exists"});
  const pw=guardianAdminHashPassword(password);
  guardianAdminUsers.set(username,{username,displayName,role,protected:false,salt:pw.salt,passwordHash:pw.hash,createdAt:new Date().toISOString(),whitelistStatus:"approved",whitelistUpdatedAt:new Date().toISOString(),serviceAssignments:[]});
  guardianEnsureDefaultPolice(guardianAdminUsers.get(username));
  guardianWriteJson(guardianUsersFile,[...guardianAdminUsers.values()]);
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
  guardianWriteJson(guardianUsersFile,[...guardianAdminUsers.values()]);
  guardianAdminAuditLog(req.guardianAdmin.username,"PASSWORD_RESET",{username});
  res.json({ok:true});
});

app.delete("/api/admin/users/:username",guardianRequireAdmin("users.delete"),(req,res)=>{
  const username=String(req.params.username||"");
  const user=guardianAdminUsers.get(username);
  if(!user)return res.status(404).json({ok:false,error:"User not found"});
  if(user.protected||user.role==="owner")return res.status(403).json({ok:false,error:"Owner / Creator account cannot be deleted"});
  guardianAdminUsers.delete(username);
  guardianWriteJson(guardianUsersFile,[...guardianAdminUsers.values()]);
  guardianAdminAuditLog(req.guardianAdmin.username,"USER_DELETED",{username});
  res.json({ok:true});
});


// ============================================================
// Guardian Community Operations v45
// Forms builder, patrol booking/deployment, service/rank/division
// directory, membership controls and Discord integration settings.
// ============================================================
const guardianFormsFile=path.join(guardianAdminDataDir,"guardian-forms.json");
const guardianFormSubmissionsFile=path.join(guardianAdminDataDir,"guardian-form-submissions.json");
const guardianPatrolsFile=path.join(guardianAdminDataDir,"guardian-patrols.json");
const guardianServicesFile=path.join(guardianAdminDataDir,"guardian-services.json");
const guardianDiscordFile=path.join(guardianAdminDataDir,"guardian-discord.json");
let guardianForms=guardianReadJson(guardianFormsFile,[
  {id:"whitelist",title:"Whitelist Application",description:"Apply for Guardian membership and operational access.",category:"Applications",audience:"guest",published:true,requiresApproval:true,fields:[{id:"why",type:"textarea",label:"Why do you want to join Guardian?",required:true},{id:"experience",type:"textarea",label:"Tell us about your roleplay experience.",required:true}]},
  {id:"loa",title:"Leave of Absence",description:"Request time away from scheduled activity.",category:"Member Requests",audience:"member",published:true,requiresApproval:true,fields:[{id:"from",type:"date",label:"From",required:true},{id:"to",type:"date",label:"To",required:true},{id:"reason",type:"textarea",label:"Reason",required:true}]},
  {id:"support",title:"Support Request",description:"Ask staff for help.",category:"Support",audience:"member",published:true,requiresApproval:false,fields:[{id:"subject",type:"text",label:"Subject",required:true},{id:"details",type:"textarea",label:"What do you need help with?",required:true}]}
]);
if(!Array.isArray(guardianForms))guardianForms=[];
let guardianFormSubmissions=guardianReadJson(guardianFormSubmissionsFile,[]);if(!Array.isArray(guardianFormSubmissions))guardianFormSubmissions=[];
let guardianPatrols=guardianReadJson(guardianPatrolsFile,[]);if(!Array.isArray(guardianPatrols))guardianPatrols=[];
let guardianServices=guardianReadJson(guardianServicesFile,[
  {id:"fire",name:"Fire & Rescue",enabled:true,callsignPattern:"J##P#",ranks:["Firefighter","Crew Manager","Watch Manager","Station Manager","Group Manager"],divisions:["East Scotland / L&B","Northumberland"],roles:["Crew","Driver","Officer in Charge","Control Liaison"],qualifications:["BA","Emergency Response Driver","Incident Command","Aerial","Water Rescue"]},
  {id:"police",name:"Police",enabled:true,callsignPattern:"SIERRA-##",ranks:["Police Constable","Sergeant","Inspector","Chief Inspector"],divisions:["Response","Roads Policing","CID","Operations Support"],roles:["Response Officer","Traffic Officer","Detective","Supervisor"],qualifications:["Response Driving","TPAC","Taser","Firearms"]},
  {id:"sas",name:"SAS / Specialist",enabled:true,callsignPattern:"SAS-##",ranks:["Operator","Team Leader","Commander"],divisions:["Special Operations"],roles:["Operator","Medic","Marksman","Team Leader"],qualifications:["Specialist Operations"]},
  {id:"ambulance",name:"Ambulance",enabled:false,callsignPattern:"AMB-##",ranks:["Technician","Paramedic","Specialist Paramedic","Operations Officer"],divisions:["Ambulance Operations"],roles:["Clinician","Driver","Commander"],qualifications:["Emergency Driving","Advanced Life Support"]},
  {id:"control",name:"Control",enabled:true,callsignPattern:"CONTROL",ranks:["Control Operator","Control Supervisor"],divisions:["Emergency Control"],roles:["Call Handler","Dispatcher","Supervisor"],qualifications:["Control Qualified"]}
]);
if(!Array.isArray(guardianServices))guardianServices=[];
let guardianDiscord=guardianReadJson(guardianDiscordFile,{enabled:false,guildId:"",patrolChannelId:"",applicationsChannelId:"",staffChannelId:"",auditChannelId:"",briefingChannelId:"",whitelistRoleId:"",memberRoleId:"",fireRoleId:"",policeRoleId:"",ambulanceRoleId:"",sasRoleId:"",controlRoleId:"",staffRoleId:"",syncRoles:false,patrolPosts:true,reminders:true,applicationNotifications:true});
if(!guardianDiscord||typeof guardianDiscord!=="object"||Array.isArray(guardianDiscord))guardianDiscord={};
function guardianSaveForms(){guardianWriteJson(guardianFormsFile,guardianForms)}
function guardianSaveFormSubmissions(){guardianWriteJson(guardianFormSubmissionsFile,guardianFormSubmissions)}
function guardianSavePatrols(){guardianWriteJson(guardianPatrolsFile,guardianPatrols)}
function guardianSaveServices(){guardianWriteJson(guardianServicesFile,guardianServices)}
function guardianSaveDiscord(){guardianWriteJson(guardianDiscordFile,guardianDiscord)}
function guardianMemberType(user){return String(user?.membershipType||((user?.whitelistStatus||"").toLowerCase()==="approved"?"member":"non-member"))}
function guardianAudienceAllowed(form,user){
  const a=String(form?.audience||"member").toLowerCase();
  if(a==="all"||a==="guest")return true;
  if(!user)return false;
  if(a==="staff")return ["owner","admin","dev","supervisor","control"].includes(String(user.role));
  if(a==="whitelisted")return String(user.whitelistStatus||"").toLowerCase()==="approved";
  return guardianMemberType(user)==="member"||String(user.whitelistStatus||"").toLowerCase()==="approved";
}
function guardianSafeForm(form){return {id:form.id,title:form.title,description:form.description||"",category:form.category||"Forms",icon:form.icon||"▤",instructions:form.instructions||"",confirmationText:form.confirmationText||"Your form has been submitted.",audience:form.audience||"member",published:form.published!==false,requiresApproval:form.requiresApproval!==false,allowRepeat:form.allowRepeat!==false,fields:Array.isArray(form.fields)?form.fields:[]}}
async function guardianDiscordRequest(method,url,body){
  const token=String(process.env.DISCORD_BOT_TOKEN||"").trim();
  if(!token)return {ok:false,skipped:true,error:"DISCORD_BOT_TOKEN is not configured"};
  try{
    const r=await fetch(`https://discord.com/api/v10${url}`,{method,headers:{"Authorization":`Bot ${token}`,"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});
    const text=await r.text(); let data=null; try{data=text?JSON.parse(text):null}catch{}
    if(!r.ok)return {ok:false,status:r.status,error:data?.message||text||`Discord HTTP ${r.status}`,data};
    return {ok:true,status:r.status,data};
  }catch(e){return {ok:false,error:e.message}}
}
async function guardianDiscordSend(channelId,content){
  if(!guardianDiscord.enabled||!channelId)return {ok:false,skipped:true};
  let payload;
  if(content&&typeof content==="object"&&!Array.isArray(content))payload=content;
  else payload={content:String(content||"").slice(0,1900)};
  return guardianDiscordRequest("POST",`/channels/${encodeURIComponent(channelId)}/messages`,payload);
}
function guardianDiscordEmbed(title,description,opts={}){
  const embed={title:String(title||"Guardian Operations").slice(0,256),description:String(description||"").slice(0,4000),color:Number(opts.color||0x1e73ff),timestamp:new Date().toISOString(),footer:{text:"Guardian Operations • Community Operations"}};
  if(Array.isArray(opts.fields)&&opts.fields.length)embed.fields=opts.fields.slice(0,25).map(f=>({name:String(f.name||"").slice(0,256),value:String(f.value||"—").slice(0,1024),inline:!!f.inline}));
  return embed;
}


// ============================================================
// Guardian v55 Patrol Booking Bot + duty assignment workflow
// ============================================================
function guardianPatrolStartMs(p){const n=Date.parse(String(p?.startsAt||''));return Number.isFinite(n)?n:0}
function guardianPatrolCloseMs(p){const explicit=Date.parse(String(p?.bookingClosesAt||''));if(Number.isFinite(explicit))return explicit;const start=guardianPatrolStartMs(p);return start?start-(60*60*1000):0}
function guardianPatrolBookingsClosed(p){if(p?.bookingsManuallyClosed===true)return true;const close=guardianPatrolCloseMs(p);return !!close&&Date.now()>=close}
function guardianPatrolStatusText(p){return guardianPatrolBookingsClosed(p)?'BOOKINGS CLOSED':'BOOKINGS OPEN'}
function guardianPatrolDisplayDate(v){const d=new Date(v);return Number.isFinite(d.getTime())?d.toLocaleString('en-GB',{timeZone:'Europe/London',weekday:'short',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'TBC'}
function guardianPatrolAttendees(p,status='attending'){return (p?.bookings||[]).filter(b=>status==='attending'?['attending','booked'].includes(String(b.status)):String(b.status)===status)}
function guardianPatrolNameList(rows){if(!rows.length)return 'None yet';const text=rows.map(b=>`• ${b.displayName||b.discordDisplayName||b.username||'Unknown'}`).join('\n');return text.length>1000?text.slice(0,990)+'…':text}
function guardianPatrolDiscordPayload(p){
  const attending=guardianPatrolAttendees(p,'attending'),declined=guardianPatrolAttendees(p,'not-attending'),closed=guardianPatrolBookingsClosed(p);
  const svc=(guardianServices.find(s=>s.id===p.serviceId)||{}).name||p.serviceId||'Multi-service';
  const embed=guardianDiscordEmbed(`🚨 ${p.title||'Official Patrol'}`,p.briefing||'Official Guardian Operations patrol.',{color:closed?0x68717a:0x1579c4,fields:[
    {name:'Patrol starts',value:guardianPatrolDisplayDate(p.startsAt),inline:true},
    {name:'Bookings close',value:guardianPatrolDisplayDate(p.bookingClosesAt||guardianPatrolCloseMs(p)),inline:true},
    {name:'Status',value:closed?'🔒 CLOSED':'🟢 OPEN',inline:true},
    {name:'Operation',value:svc,inline:true},
    {name:'Attending',value:String(attending.length),inline:true},
    {name:'Not attending',value:String(declined.length),inline:true},
    {name:'✅ Attending members',value:guardianPatrolNameList(attending),inline:false}
  ]});
  embed.footer={text:'Guardian Operations • FiveM Patrol Booking'};
  return {embeds:[embed],components:[{type:1,components:[
    {type:2,style:3,label:`Attending (${attending.length})`,custom_id:`guardian_patrol_attend:${p.id}`,disabled:closed},
    {type:2,style:4,label:'Not Attending',custom_id:`guardian_patrol_decline:${p.id}`,disabled:closed}
  ]}]};
}
async function guardianPatrolSyncDiscord(p,{createIfMissing=true}={}){
  const channelId=String(p.discordChannelId||guardianDiscord.patrolChannelId||'').trim();if(!guardianDiscord.enabled||!channelId)return {ok:false,skipped:true,error:'Discord patrol channel is not configured'};
  const payload=guardianPatrolDiscordPayload(p);
  let r;
  if(p.discordMessageId)r=await guardianDiscordRequest('PATCH',`/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(p.discordMessageId)}`,payload);
  else if(createIfMissing){r=await guardianDiscordSend(channelId,payload);if(r?.ok&&r.data?.id){p.discordMessageId=String(r.data.id);p.discordChannelId=channelId;p.discordPublishedAt=new Date().toISOString();guardianSavePatrols()}}
  else return {ok:false,skipped:true};
  return r;
}
function guardianEnsureDefaultPolice(user){
  if(!user||String(user.whitelistStatus||'').toLowerCase()!=='approved')return false;
  user.serviceAssignments=Array.isArray(user.serviceAssignments)?user.serviceAssignments:[];
  if(user.serviceAssignments.length)return false;
  const police=guardianServices.find(s=>s.id==='police');
  user.serviceAssignments.push({serviceId:'police',rank:police?.ranks?.[0]||'Police Constable',division:police?.divisions?.[0]||'Response',callsign:''});
  return true;
}
function guardianPatrolEligible(user){
  guardianEnsureDefaultPolice(user);
  const assignments=Array.isArray(user?.serviceAssignments)?user.serviceAssignments:[];
  const ids=[...new Set(assignments.map(a=>String(a.serviceId||'')).filter(Boolean))];
  return ids.length?ids:['police'];
}
function guardianPatrolEligibleDivisions(user,serviceId){
  guardianEnsureDefaultPolice(user);
  const rows=(user?.serviceAssignments||[]).filter(a=>String(a.serviceId)===String(serviceId));
  const divs=[...new Set(rows.map(a=>String(a.division||'').trim()).filter(Boolean))];
  if(divs.length)return divs;
  if(serviceId==='police')return ['Response'];
  return [];
}
function guardianDiscordVerifyInteraction(req){
  const publicKeyHex=String(process.env.DISCORD_PUBLIC_KEY||'').trim();const sig=String(req.get('X-Signature-Ed25519')||'');const ts=String(req.get('X-Signature-Timestamp')||'');
  if(!publicKeyHex||!/^[0-9a-f]{64}$/i.test(publicKeyHex)||!/^[0-9a-f]+$/i.test(sig)||!ts||!req.rawBody)return false;
  try{const raw=Buffer.from(publicKeyHex,'hex');const spki=Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),raw]);const key=crypto.createPublicKey({key:spki,format:'der',type:'spki'});return crypto.verify(null,Buffer.concat([Buffer.from(ts),req.rawBody]),key,Buffer.from(sig,'hex'))}catch{return false}
}
function guardianFindUserFromDiscordInteraction(body){
  const du=body?.member?.user||body?.user||{};const id=String(du.id||'');const username=String(du.username||'').toLowerCase();
  let user=[...guardianAdminUsers.values()].find(u=>String(u.discordUserId||'')===id);
  if(!user&&username){const appRow=guardianApplications?.find(a=>String(a.discord||'').replace(/^@/,'').toLowerCase()===username);if(appRow)user=guardianAdminUsers.get(appRow.username)}
  if(user&&id&&String(user.discordUserId||'')!==id){user.discordUserId=id;guardianSaveUsers()}
  return user||null;
}
app.post('/api/discord/interactions',async(req,res)=>{
  if(!guardianDiscordVerifyInteraction(req))return res.status(401).send('invalid request signature');
  const body=req.body||{};if(body.type===1)return res.json({type:1});
  if(body.type!==3)return res.json({type:4,data:{content:'Unsupported Guardian interaction.',flags:64}});
  const custom=String(body.data?.custom_id||'');const m=custom.match(/^guardian_patrol_(attend|decline):(.+)$/);if(!m)return res.json({type:4,data:{content:'This Guardian button is no longer supported.',flags:64}});
  const p=guardianPatrols.find(x=>String(x.id)===m[2]);if(!p)return res.json({type:4,data:{content:'That patrol no longer exists.',flags:64}});
  p.discordMessageId=String(body.message?.id||p.discordMessageId||'');p.discordChannelId=String(body.channel_id||p.discordChannelId||guardianDiscord.patrolChannelId||'');
  if(guardianPatrolBookingsClosed(p)){guardianSavePatrols();return res.json({type:7,data:guardianPatrolDiscordPayload(p)})}
  const user=guardianFindUserFromDiscordInteraction(body);if(!user||String(user.whitelistStatus||'').toLowerCase()!=='approved')return res.json({type:4,data:{content:'Your Discord account is not linked to an approved Guardian account. Ask staff to add your Discord User ID in Guardian before booking.',flags:64}});
  guardianEnsureDefaultPolice(user);guardianSaveUsers();p.bookings=Array.isArray(p.bookings)?p.bookings:[];let b=p.bookings.find(x=>x.username===user.username);if(!b){b={username:user.username,displayName:user.displayName||user.username,discordUserId:String(body.member?.user?.id||''),discordDisplayName:String(body.member?.nick||body.member?.user?.global_name||body.member?.user?.username||''),bookedAt:new Date().toISOString(),status:'attending',deployment:null};p.bookings.push(b)}
  b.status=m[1]==='attend'?'attending':'not-attending';b.respondedAt=new Date().toISOString();b.source='discord';guardianSavePatrols();guardianAdminAuditLog(user.username,b.status==='attending'?'PATROL_ATTENDING':'PATROL_NOT_ATTENDING',{patrolId:p.id,source:'discord'});
  return res.json({type:7,data:guardianPatrolDiscordPayload(p)});
});

let guardianPatrolCloseSweepBusy=false;
setInterval(async()=>{if(guardianPatrolCloseSweepBusy)return;guardianPatrolCloseSweepBusy=true;try{for(const p of guardianPatrols){if(p.published===false||!p.discordMessageId)continue;const closed=guardianPatrolBookingsClosed(p);if(closed&&!p.discordClosedSyncedAt){await guardianPatrolSyncDiscord(p,{createIfMissing:false});p.discordClosedSyncedAt=new Date().toISOString();guardianSavePatrols()}}}finally{guardianPatrolCloseSweepBusy=false}},60000).unref?.();
const guardianDiscordTemplate={
  roles:[
    {key:"memberRoleId",name:"GO • Member",color:0x4f545c},
    {key:"whitelistRoleId",name:"GO • Whitelisted",color:0x2ecc71},
    {key:"fireRoleId",name:"GO • Fire & Rescue",color:0xe74c3c},
    {key:"policeRoleId",name:"GO • Police",color:0x3498db},
    {key:"ambulanceRoleId",name:"GO • Ambulance",color:0x27ae60},
    {key:"sasRoleId",name:"GO • SAS / Specialist",color:0x8e44ad},
    {key:"controlRoleId",name:"GO • Control",color:0xf1c40f},
    {key:"staffRoleId",name:"GO • Staff",color:0xe67e22}
  ],
  categories:[
    {name:"📌 START HERE",channels:["welcome","rules","announcements","how-to-use-guardian"]},
    {name:"🚨 OPERATIONS",channels:["patrols","briefings","deployments","radio-updates"]},
    {name:"🔥 FIRE & RESCUE",channels:["fire-general","fire-operations","fire-training"]},
    {name:"🚓 POLICE",channels:["police-general","police-operations","police-training"]},
    {name:"🎖 SPECIALIST / SAS",channels:["specialist-general","specialist-operations"]},
    {name:"🚑 AMBULANCE",channels:["ambulance-general","ambulance-training"]},
    {name:"📚 TRAINING & FORMS",channels:["training","forms","application-status"]},
    {name:"🛠 STAFF",private:true,channels:["staff-chat","applications","audit-log","bot-testing"]}
  ],
  voice:["Patrol Briefing","Fire Operations","Police Operations","Control Room"]
};
async function guardianProvisionDiscordServer(guildId){
  guildId=String(guildId||"").trim(); if(!guildId)return {ok:false,error:"Guild ID is required"};
  const rolesR=await guardianDiscordRequest("GET",`/guilds/${guildId}/roles`); if(!rolesR.ok)return rolesR;
  const chansR=await guardianDiscordRequest("GET",`/guilds/${guildId}/channels`); if(!chansR.ok)return chansR;
  let roles=Array.isArray(rolesR.data)?rolesR.data:[], channels=Array.isArray(chansR.data)?chansR.data:[];
  const created={roles:[],categories:[],channels:[],voice:[]};
  for(const spec of guardianDiscordTemplate.roles){
    let role=roles.find(r=>r.name===spec.name);
    if(!role){const rr=await guardianDiscordRequest("POST",`/guilds/${guildId}/roles`,{name:spec.name,color:spec.color,hoist:false,mentionable:true,permissions:"0"});if(!rr.ok)return rr;role=rr.data;roles.push(role);created.roles.push(role.name)}
    guardianDiscord[spec.key]=role.id;
  }
  const staffRoleId=guardianDiscord.staffRoleId;
  for(const cat of guardianDiscordTemplate.categories){
    let c=channels.find(x=>x.type===4&&x.name===cat.name);
    if(!c){const body={name:cat.name,type:4};if(cat.private){body.permission_overwrites=[{id:guildId,type:0,deny:String(1024),allow:"0"},{id:staffRoleId,type:0,allow:String(1024|2048|65536),deny:"0"}]};const cr=await guardianDiscordRequest("POST",`/guilds/${guildId}/channels`,body);if(!cr.ok)return cr;c=cr.data;channels.push(c);created.categories.push(c.name)}
    for(const nm of cat.channels){
      let ch=channels.find(x=>x.type===0&&x.name===nm&&x.parent_id===c.id);
      if(!ch){const rr=await guardianDiscordRequest("POST",`/guilds/${guildId}/channels`,{name:nm,type:0,parent_id:c.id,topic:`Guardian Operations • ${nm.replace(/-/g,' ')}`});if(!rr.ok)return rr;ch=rr.data;channels.push(ch);created.channels.push(ch.name)}
      if(nm==="patrols")guardianDiscord.patrolChannelId=ch.id;
      if(nm==="applications")guardianDiscord.applicationsChannelId=ch.id;
      if(nm==="staff-chat")guardianDiscord.staffChannelId=ch.id;
      if(nm==="audit-log")guardianDiscord.auditChannelId=ch.id;
      if(nm==="briefings")guardianDiscord.briefingChannelId=ch.id;
    }
  }
  let voiceCat=channels.find(x=>x.type===4&&x.name==="🔊 VOICE");
  if(!voiceCat){const vr=await guardianDiscordRequest("POST",`/guilds/${guildId}/channels`,{name:"🔊 VOICE",type:4});if(vr.ok){voiceCat=vr.data;channels.push(voiceCat);created.categories.push(voiceCat.name)}}
  if(voiceCat)for(const nm of guardianDiscordTemplate.voice){if(!channels.find(x=>x.type===2&&x.name===nm&&x.parent_id===voiceCat.id)){const rr=await guardianDiscordRequest("POST",`/guilds/${guildId}/channels`,{name:nm,type:2,parent_id:voiceCat.id,user_limit:0});if(rr.ok){channels.push(rr.data);created.voice.push(nm)}}}
  guardianDiscord.guildId=guildId;guardianDiscord.enabled=true;guardianSaveDiscord();
  return {ok:true,created,discord:guardianDiscord,template:guardianDiscordTemplate};
}
function guardianUserPublicProfile(u){return {username:u.username,displayName:u.displayName||u.username,role:u.role,membershipType:guardianMemberType(u),whitelistStatus:u.whitelistStatus||"pending",discordUserId:u.discordUserId||"",serviceAssignments:Array.isArray(u.serviceAssignments)?u.serviceAssignments:[],qualifications:Array.isArray(u.qualifications)?u.qualifications:[]}}

app.get("/api/community/services",(_req,res)=>res.json({ok:true,services:guardianServices.filter(x=>x.enabled!==false)}));
app.get("/api/community/forms",(req,res)=>{const session=guardianUserReadSession(req)||guardianAdminReadSession(req);const u=session?guardianAdminUsers.get(session.username):null;res.json({ok:true,forms:guardianForms.filter(f=>f.published!==false&&guardianAudienceAllowed(f,u)).map(guardianSafeForm)})});
app.post("/api/community/forms/:id/submit",async(req,res)=>{
  const form=guardianForms.find(f=>f.id===req.params.id&&f.published!==false);if(!form)return res.status(404).json({ok:false,error:"Form not found"});
  const session=guardianUserReadSession(req)||guardianAdminReadSession(req),u=session?guardianAdminUsers.get(session.username):null;
  if(!guardianAudienceAllowed(form,u))return res.status(403).json({ok:false,error:"You do not have access to this form"});
  if(!u&&String(form.audience||"").toLowerCase()!=="guest")return res.status(401).json({ok:false,error:"Sign in required"});
  const answers=req.body?.answers&&typeof req.body.answers==="object"?req.body.answers:{};
  for(const field of form.fields||[]){
    if(field.type==="section")continue;
    const val=answers[field.id];
    const missing=field.type==="checkbox"||field.type==="acknowledgement" ? field.required&&!val : field.required&&(Array.isArray(val)?val.length===0:!String(val??"").trim());
    if(missing)return res.status(400).json({ok:false,error:`${field.label||"Required field"} is required`});
  }
  if(form.allowRepeat===false&&u&&guardianFormSubmissions.some(x=>x.formId===form.id&&x.username===u.username&&!['rejected','closed'].includes(String(x.status))))return res.status(409).json({ok:false,error:"You already have an active submission for this form"});
  const sub={id:crypto.randomUUID(),formId:form.id,formTitle:form.title,username:u?.username||String(req.body?.username||"guest"),displayName:u?.displayName||String(req.body?.displayName||"Guest"),answers,status:form.requiresApproval===false?"closed":"submitted",submittedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),assignedTo:"",staffNotes:[],history:[{at:new Date().toISOString(),by:u?.username||"guest",action:"SUBMITTED"}]};
  guardianFormSubmissions.unshift(sub);guardianSaveFormSubmissions();guardianAdminAuditLog(sub.username,"FORM_SUBMITTED",{formId:form.id,submissionId:sub.id});
  if(guardianDiscord.applicationNotifications)guardianDiscordSend(guardianDiscord.applicationsChannelId,{embeds:[guardianDiscordEmbed('📝 New Form Submission',`**${form.title}** has been submitted.`,{color:0x9b59b6,fields:[{name:'Submitted by',value:`${sub.displayName} (${sub.username})`,inline:true},{name:'Status',value:String(sub.status||'submitted').toUpperCase(),inline:true}]})]});
  res.json({ok:true,submission:sub});
});
app.get("/api/community/submissions/me",(req,res)=>{const session=guardianUserReadSession(req)||guardianAdminReadSession(req);if(!session)return res.status(401).json({ok:false,error:"Sign in required"});res.json({ok:true,submissions:guardianFormSubmissions.filter(x=>x.username===session.username)})});

app.get("/api/admin/forms",guardianRequireAdmin("settings.view"),(req,res)=>res.json({ok:true,forms:guardianForms,submissions:guardianFormSubmissions}));
app.post("/api/admin/forms",guardianRequireAdmin("settings.edit"),(req,res)=>{const forms=Array.isArray(req.body?.forms)?req.body.forms:[];guardianForms=forms.map((f,i)=>({...f,id:String(f.id||`form-${Date.now()}-${i}`),title:String(f.title||"Untitled Form"),fields:Array.isArray(f.fields)?f.fields:[]}));guardianSaveForms();guardianAdminAuditLog(req.guardianAdmin.username,"FORMS_CONFIG_SAVED",{count:guardianForms.length});res.json({ok:true,forms:guardianForms})});
app.post("/api/admin/form-submissions/:id/review",guardianRequireAdmin("settings.edit"),(req,res)=>{const sub=guardianFormSubmissions.find(x=>x.id===req.params.id);if(!sub)return res.status(404).json({ok:false,error:"Submission not found"});const status=String(req.body?.status||"under-review");sub.status=status;sub.assignedTo=String(req.body?.assignedTo||sub.assignedTo||"");sub.updatedAt=new Date().toISOString();if(req.body?.note)sub.staffNotes.push({at:sub.updatedAt,by:req.guardianAdmin.username,note:String(req.body.note)});sub.history.push({at:sub.updatedAt,by:req.guardianAdmin.username,action:`STATUS_${status.toUpperCase()}`});guardianSaveFormSubmissions();res.json({ok:true,submission:sub})});
app.get("/api/admin/services",guardianRequireAdmin("settings.view"),(req,res)=>res.json({ok:true,services:guardianServices}));
app.post("/api/admin/services",guardianRequireAdmin("settings.edit"),(req,res)=>{if(!Array.isArray(req.body?.services))return res.status(400).json({ok:false,error:"Services required"});guardianServices=req.body.services;guardianSaveServices();guardianAdminAuditLog(req.guardianAdmin.username,"SERVICE_DIRECTORY_SAVED",{count:guardianServices.length});res.json({ok:true,services:guardianServices})});
app.post("/api/admin/users/:username/community-profile",guardianRequireAdmin("settings.edit"),(req,res)=>{const u=guardianAdminUsers.get(String(req.params.username||""));if(!u)return res.status(404).json({ok:false,error:"User not found"});u.membershipType=["member","non-member"].includes(req.body?.membershipType)?req.body.membershipType:u.membershipType||"non-member";u.discordUserId=String(req.body?.discordUserId||u.discordUserId||"");u.serviceAssignments=Array.isArray(req.body?.serviceAssignments)?req.body.serviceAssignments:u.serviceAssignments||[];u.qualifications=Array.isArray(req.body?.qualifications)?req.body.qualifications:u.qualifications||[];guardianSaveUsers();guardianAdminAuditLog(req.guardianAdmin.username,"COMMUNITY_PROFILE_UPDATED",{username:u.username,membershipType:u.membershipType});res.json({ok:true,user:guardianUserPublicProfile(u)})});
app.get("/api/admin/discord",guardianRequireAdmin("settings.view"),(req,res)=>res.json({ok:true,discord:guardianDiscord,status:{tokenConfigured:!!String(process.env.DISCORD_BOT_TOKEN||"").trim(),clientIdConfigured:!!String(process.env.DISCORD_CLIENT_ID||"").trim(),clientSecretConfigured:!!String(process.env.DISCORD_CLIENT_SECRET||"").trim()}}));
app.post("/api/admin/discord",guardianRequireAdmin("settings.edit"),(req,res)=>{guardianDiscord={...guardianDiscord,...req.body};guardianSaveDiscord();guardianAdminAuditLog(req.guardianAdmin.username,"DISCORD_SETTINGS_SAVED");res.json({ok:true,discord:guardianDiscord})});
app.get("/api/admin/discord/template",guardianRequireAdmin("settings.view"),(req,res)=>res.json({ok:true,template:guardianDiscordTemplate}));
app.post("/api/admin/discord/provision",guardianRequireAdmin("settings.edit"),async(req,res)=>{const guildId=String(req.body?.guildId||guardianDiscord.guildId||"");const result=await guardianProvisionDiscordServer(guildId);if(!result.ok)return res.status(400).json(result);guardianAdminAuditLog(req.guardianAdmin.username,"DISCORD_SERVER_PROVISIONED",result.created);res.json(result)});
app.post("/api/admin/discord/test",guardianRequireAdmin("settings.edit"),async(req,res)=>{const channelId=String(req.body?.channelId||guardianDiscord.staffChannelId||guardianDiscord.patrolChannelId||"");const result=await guardianDiscordSend(channelId,{embeds:[guardianDiscordEmbed("✅ Guardian Operations Connected","Discord integration is online and Guardian can post to this channel.",{color:0x2ecc71,fields:[{name:"Server",value:guardianDiscord.guildId||"Configured",inline:true},{name:"Status",value:"ONLINE",inline:true}]})]});if(!result.ok)return res.status(400).json({ok:false,error:result.skipped?"Discord integration/token/channel is not configured":result.error||`Discord HTTP ${result.status}`});res.json({ok:true})});


// ============================================================
// Guardian Operations Suite v46
// Calendar/templates, training, fleet, announcements, guides/rules,
// role permissions and attendance. Designed as data-driven modules.
// ============================================================
const guardianAnnouncementsFile=path.join(guardianAdminDataDir,"guardian-announcements.json");
const guardianGuidesFile=path.join(guardianAdminDataDir,"guardian-guides.json");
const guardianTrainingFile=path.join(guardianAdminDataDir,"guardian-training.json");
const guardianFleetFile=path.join(guardianAdminDataDir,"guardian-fleet.json");
const guardianPatrolTemplatesFile=path.join(guardianAdminDataDir,"guardian-patrol-templates.json");
const guardianRolePermissionsFile=path.join(guardianAdminDataDir,"guardian-role-permissions.json");
let guardianAnnouncements=guardianReadJson(guardianAnnouncementsFile,[
 {id:"welcome",title:"Welcome to Guardian Operations",body:"Check the Guides section before your first patrol and keep your profile details up to date.",audience:"all",priority:"info",published:true,requiresAck:false,createdAt:new Date().toISOString(),acknowledgedBy:[]}
]); if(!Array.isArray(guardianAnnouncements))guardianAnnouncements=[];
let guardianGuides=guardianReadJson(guardianGuidesFile,[
 {id:"community-rules",title:"Community Rules",category:"Rules",summary:"The standards expected from every Guardian member.",body:"# Community Rules\n\n1. Treat everyone with respect.\n2. Follow staff directions during organised operations.\n3. Use the MDT and radio professionally.\n4. Do not share restricted operational information outside the community.\n5. Report issues through the Support form rather than escalating them in public channels.",published:true,audience:"all",order:1},
 {id:"getting-started",title:"Getting Started",category:"How to use Guardian",summary:"From whitelist approval to your first patrol.",body:"# Getting Started\n\n1. Complete your whitelist application.\n2. Once approved, review your profile and service assignment.\n3. Book onto an upcoming operation.\n4. Staff will assign your callsign, rank/division, vehicle and talkgroup.\n5. Join the MDT and radio using the assignment shown on your profile.",published:true,audience:"member",order:2},
 {id:"radio-guide",title:"Radio Guide",category:"How to use Guardian",summary:"Channels, PTT and private Control calls.",body:"# Guardian Radio\n\nSelect your service in Contacts, return Home, use Left/Right to choose a talkgroup and Select to join. PTT talks on the open channel. Hold keypad 1 for two seconds when you need a private Control request.",published:true,audience:"whitelisted",order:3},
 {id:"mdt-guide",title:"MDT Guide",category:"How to use Guardian",summary:"Booking on, status changes and incident handling.",body:"# MDT Guide\n\nUse the MDT only after you are whitelisted and assigned to an operation. Keep your status accurate and acknowledge Control messages promptly.",published:true,audience:"whitelisted",order:4}
]); if(!Array.isArray(guardianGuides))guardianGuides=[];
let guardianTraining=guardianReadJson(guardianTrainingFile,[]); if(!Array.isArray(guardianTraining))guardianTraining=[];
let guardianFleet=guardianReadJson(guardianFleetFile,[
 {id:"fleet-pump-1",serviceId:"fire",callsign:"J27P6",name:"Pump",station:"Coldstream Fire Station",type:"Pump",status:"available",qualifications:["Emergency Response Driver"],active:true},
 {id:"fleet-police-1",serviceId:"police",callsign:"SIERRA-01",name:"Response Unit",station:"Response",type:"Marked Response",status:"available",qualifications:["Response Driving"],active:true}
]); if(!Array.isArray(guardianFleet))guardianFleet=[];
let guardianPatrolTemplates=guardianReadJson(guardianPatrolTemplatesFile,[
 {id:"weekly-joint",title:"Weekly Joint Operation",serviceId:"joint",dayOfWeek:"Friday",time:"20:00",maxSlots:0,briefing:"Weekly Guardian operation.",requiredQualifications:[],published:true}
]); if(!Array.isArray(guardianPatrolTemplates))guardianPatrolTemplates=[];
let guardianRolePermissions=guardianReadJson(guardianRolePermissionsFile,{
 owner:{portal:true,mdt:true,control:true,radio:true,forms:true,patrols:true,training:true,staff:true,settings:true},
 admin:{portal:true,mdt:true,control:true,radio:true,forms:true,patrols:true,training:true,staff:true,settings:true},
 dev:{portal:true,mdt:true,control:true,radio:true,forms:true,patrols:true,training:true,staff:true,settings:true},
 control:{portal:true,mdt:true,control:true,radio:true,forms:true,patrols:true,training:true,staff:false,settings:false},
 supervisor:{portal:true,mdt:true,control:true,radio:true,forms:true,patrols:true,training:true,staff:true,settings:false},
 player:{portal:true,mdt:true,control:false,radio:true,forms:true,patrols:true,training:true,staff:false,settings:false}
}); if(!guardianRolePermissions||Array.isArray(guardianRolePermissions))guardianRolePermissions={};
const saveV46=()=>{guardianWriteJson(guardianAnnouncementsFile,guardianAnnouncements);guardianWriteJson(guardianGuidesFile,guardianGuides);guardianWriteJson(guardianTrainingFile,guardianTraining);guardianWriteJson(guardianFleetFile,guardianFleet);guardianWriteJson(guardianPatrolTemplatesFile,guardianPatrolTemplates);guardianWriteJson(guardianRolePermissionsFile,guardianRolePermissions)};
function guardianRoleAllows(role,permission){const p=guardianRolePermissions[String(role||"player")]||guardianRolePermissions.player||{};return p[permission]!==false}
function guardianContentAudienceAllowed(a,user){return guardianAudienceAllowed({audience:a||"member"},user)}
function guardianV46User(req){const session=guardianUserReadSession(req)||guardianAdminReadSession(req);return {session,user:session?guardianAdminUsers.get(session.username):null}}
app.get('/api/community/announcements',(req,res)=>{const {user}=guardianV46User(req);res.json({ok:true,announcements:guardianAnnouncements.filter(x=>x.published!==false&&guardianContentAudienceAllowed(x.audience,user)).map(x=>({...x,acknowledged:!!user&&(x.acknowledgedBy||[]).includes(user.username)}))})});
app.post('/api/community/announcements/:id/ack',(req,res)=>{const {session,user}=guardianV46User(req);if(!session||!user)return res.status(401).json({ok:false,error:'Sign in required'});const a=guardianAnnouncements.find(x=>x.id===req.params.id);if(!a)return res.status(404).json({ok:false,error:'Announcement not found'});a.acknowledgedBy=Array.isArray(a.acknowledgedBy)?a.acknowledgedBy:[];if(!a.acknowledgedBy.includes(user.username))a.acknowledgedBy.push(user.username);guardianWriteJson(guardianAnnouncementsFile,guardianAnnouncements);res.json({ok:true})});
app.get('/api/community/guides',(req,res)=>{const {user}=guardianV46User(req);res.json({ok:true,guides:guardianGuides.filter(x=>x.published!==false&&guardianContentAudienceAllowed(x.audience,user)).sort((a,b)=>(a.order||0)-(b.order||0))})});
// Guardian v49 - qualification/skills catalogue and richer member access management
const guardianQualificationsFile=path.join(guardianAdminDataDir,"guardian-qualification-catalog.json");
let guardianQualifications=guardianReadJson(guardianQualificationsFile,[]);
if(!Array.isArray(guardianQualifications))guardianQualifications=[];
if(!guardianQualifications.length){
  for(const svc of guardianServices){for(const name of (svc.qualifications||[])){guardianQualifications.push({id:`${svc.id}-${String(name).toLowerCase().replace(/[^a-z0-9]+/g,'-')}`,name:String(name),serviceId:svc.id,category:'Operational',description:'',validityMonths:0,requires:[],active:true})}}
  guardianWriteJson(guardianQualificationsFile,guardianQualifications);
}
app.get('/api/admin/qualifications',guardianRequireAdmin('settings.view'),(_q,res)=>res.json({ok:true,qualifications:guardianQualifications,services:guardianServices,users:[...guardianAdminUsers.values()].map(guardianUserPublicProfile)}));
app.post('/api/admin/qualifications',guardianRequireAdmin('settings.edit'),(req,res)=>{if(!Array.isArray(req.body?.qualifications))return res.status(400).json({ok:false,error:'Qualifications required'});guardianQualifications=req.body.qualifications.map((q,i)=>({id:String(q.id||`qual-${Date.now()}-${i}`),name:String(q.name||'').trim(),serviceId:String(q.serviceId||'all'),category:String(q.category||'Operational'),description:String(q.description||''),validityMonths:Number(q.validityMonths||0),requires:Array.isArray(q.requires)?q.requires:[],active:q.active!==false})).filter(q=>q.name);guardianWriteJson(guardianQualificationsFile,guardianQualifications);guardianAdminAuditLog(req.guardianAdmin.username,'QUALIFICATION_CATALOG_SAVED',{count:guardianQualifications.length});res.json({ok:true,qualifications:guardianQualifications})});
app.post('/api/admin/users/:username/qualification-award',guardianRequireAdmin('settings.edit'),(req,res)=>{const u=guardianAdminUsers.get(String(req.params.username||''));if(!u)return res.status(404).json({ok:false,error:'User not found'});const qid=String(req.body?.qualificationId||''),q=guardianQualifications.find(x=>x.id===qid);if(!q)return res.status(404).json({ok:false,error:'Qualification not found'});u.qualifications=Array.isArray(u.qualifications)?u.qualifications:[];u.qualifications=u.qualifications.filter(x=>(typeof x==='string'?x:x.id||x.name)!==qid && (typeof x==='string'?x:x.name)!==q.name);const months=Number(req.body?.validityMonths??q.validityMonths??0),awardedAt=new Date(),expiresAt=months>0?new Date(new Date(awardedAt).setMonth(awardedAt.getMonth()+months)).toISOString():'';u.qualifications.push({id:q.id,name:q.name,serviceId:q.serviceId,awardedAt:awardedAt.toISOString(),awardedBy:req.guardianAdmin.username,expiresAt});guardianSaveUsers();guardianAdminAuditLog(req.guardianAdmin.username,'QUALIFICATION_AWARDED',{username:u.username,qualification:q.name});res.json({ok:true,user:guardianUserPublicProfile(u)})});
app.post('/api/admin/users/:username/qualification-revoke',guardianRequireAdmin('settings.edit'),(req,res)=>{const u=guardianAdminUsers.get(String(req.params.username||''));if(!u)return res.status(404).json({ok:false,error:'User not found'});const key=String(req.body?.qualificationId||req.body?.name||'');u.qualifications=(u.qualifications||[]).filter(x=>{const id=typeof x==='string'?x:x.id||'',name=typeof x==='string'?x:x.name||'';return id!==key&&name!==key});guardianSaveUsers();guardianAdminAuditLog(req.guardianAdmin.username,'QUALIFICATION_REVOKED',{username:u.username,key});res.json({ok:true,user:guardianUserPublicProfile(u)})});
app.post('/api/admin/users/:username/access-profile',guardianRequireAdmin('settings.edit'),(req,res)=>{const u=guardianAdminUsers.get(String(req.params.username||''));if(!u)return res.status(404).json({ok:false,error:'User not found'});if(u.protected && req.guardianAdmin.role!=='owner')return res.status(403).json({ok:false,error:'Only Owner can edit the protected Owner profile'});const b=req.body||{};if(b.displayName!==undefined)u.displayName=String(b.displayName||u.username).trim();if(b.role!==undefined&&!u.protected){const r=String(b.role||'player').trim().toLowerCase();if(!guardianRolePermissions[r])return res.status(400).json({ok:false,error:'Unknown Guardian role'});u.role=r}if(['member','non-member'].includes(b.membershipType))u.membershipType=b.membershipType;if(['approved','pending','rejected'].includes(b.whitelistStatus)){u.whitelistStatus=b.whitelistStatus;u.whitelistUpdatedAt=new Date().toISOString()}if(b.discordUserId!==undefined)u.discordUserId=String(b.discordUserId||'').trim();if(Array.isArray(b.serviceAssignments))u.serviceAssignments=b.serviceAssignments;guardianSaveUsers();guardianAdminAuditLog(req.guardianAdmin.username,'USER_ACCESS_PROFILE_UPDATED',{username:u.username,role:u.role,membershipType:u.membershipType,whitelistStatus:u.whitelistStatus});res.json({ok:true,user:guardianUserPublicProfile(u)})});
app.get('/api/admin/discord/channels',guardianRequireAdmin('settings.view'),async(_req,res)=>{const guildId=String(guardianDiscord.guildId||'').trim();if(!guildId)return res.json({ok:true,channels:[]});const r=await guardianDiscordRequest('GET',`/guilds/${guildId}/channels`);if(!r.ok)return res.status(400).json({ok:false,error:r.error||'Unable to load Discord channels'});res.json({ok:true,channels:(r.data||[]).filter(c=>c.type===0||c.type===5).map(c=>({id:c.id,name:c.name,parentId:c.parent_id||'',type:c.type})).sort((a,b)=>a.name.localeCompare(b.name))})});
app.post('/api/admin/announcements/:id/discord',guardianRequireAdmin('settings.edit'),async(req,res)=>{const a=guardianAnnouncements.find(x=>x.id===req.params.id);if(!a)return res.status(404).json({ok:false,error:'Announcement not found'});const channelId=String(req.body?.channelId||a.discordChannelId||guardianDiscord.staffChannelId||guardianDiscord.patrolChannelId||'');if(!channelId)return res.status(400).json({ok:false,error:'Choose a Discord channel first'});const colors={info:0x1e73ff,important:0xf39c12,urgent:0xe74c3c};const result=await guardianDiscordSend(channelId,{embeds:[guardianDiscordEmbed(a.title,a.body,{color:colors[a.priority]||colors.info,fields:[{name:'Audience',value:String(a.audience||'all').toUpperCase(),inline:true},{name:'Priority',value:String(a.priority||'info').toUpperCase(),inline:true}]})]});if(!result.ok)return res.status(400).json({ok:false,error:result.error||'Discord send failed'});a.discordChannelId=channelId;a.discordSentAt=new Date().toISOString();guardianWriteJson(guardianAnnouncementsFile,guardianAnnouncements);guardianAdminAuditLog(req.guardianAdmin.username,'ANNOUNCEMENT_SENT_DISCORD',{announcementId:a.id,channelId});res.json({ok:true})});
app.get('/api/community/training',(req,res)=>{const {session,user}=guardianV46User(req);if(!session||!user||String(user.whitelistStatus||'').toLowerCase()!=='approved')return res.json({ok:true,sessions:[]});res.json({ok:true,sessions:guardianTraining.filter(x=>x.published!==false).map(t=>({...t,booked:(t.bookings||[]).includes(user.username)}))})});
app.post('/api/community/training/:id/book',(req,res)=>{const {session,user}=guardianV46User(req);if(!session||!user)return res.status(401).json({ok:false,error:'Sign in required'});if(String(user.whitelistStatus||'').toLowerCase()!=='approved')return res.status(403).json({ok:false,error:'Whitelist approval required'});const t=guardianTraining.find(x=>x.id===req.params.id);if(!t)return res.status(404).json({ok:false,error:'Training not found'});const held=(user.qualifications||[]).map(q=>typeof q==='string'?q:q.id||q.name);const missing=(t.prerequisites||[]).filter(id=>!held.includes(id)&&!held.some(h=>String(h).toLowerCase()===String((guardianQualifications.find(q=>q.id===id)||{}).name||id).toLowerCase()));if(missing.length)return res.status(403).json({ok:false,error:'Missing prerequisite qualifications: '+missing.map(id=>(guardianQualifications.find(q=>q.id===id)||{}).name||id).join(', ')});if(t.bookingClosesAt&&Date.now()>new Date(t.bookingClosesAt).getTime())return res.status(409).json({ok:false,error:'Booking has closed'});t.bookings=Array.isArray(t.bookings)?t.bookings:[];if(t.maxSlots&&t.bookings.length>=Number(t.maxSlots)&&!t.bookings.includes(user.username))return res.status(409).json({ok:false,error:'Training is full'});if(!t.bookings.includes(user.username))t.bookings.push(user.username);guardianWriteJson(guardianTrainingFile,guardianTraining);guardianAdminAuditLog(user.username,'TRAINING_BOOKED',{trainingId:t.id});res.json({ok:true})});
app.post('/api/community/training/:id/cancel',(req,res)=>{const {session,user}=guardianV46User(req);if(!session||!user)return res.status(401).json({ok:false,error:'Sign in required'});const t=guardianTraining.find(x=>x.id===req.params.id);if(!t)return res.status(404).json({ok:false,error:'Training not found'});t.bookings=(t.bookings||[]).filter(x=>x!==user.username);guardianWriteJson(guardianTrainingFile,guardianTraining);res.json({ok:true})});
app.get('/api/community/permissions/me',(req,res)=>{const {session}=guardianV46User(req);const role=session?.role||'player';res.json({ok:true,role,permissions:guardianRolePermissions[role]||guardianRolePermissions.player||{}})});
app.get('/api/community/operations/me',(req,res)=>{const {session,user}=guardianV46User(req);if(!session||!user)return res.status(401).json({ok:false,error:'Sign in required'});let totalMinutes=0;for(const p of guardianPatrols)for(const b of p.bookings||[])if(b.username===user.username&&b.checkInAt&&b.checkOutAt)totalMinutes+=Math.max(0,(new Date(b.checkOutAt)-new Date(b.checkInAt))/60000);res.json({ok:true,profile:guardianUserPublicProfile(user),attendance:{minutes:Math.round(totalMinutes),hours:Number((totalMinutes/60).toFixed(1))},upcoming:guardianPatrols.filter(p=>(p.bookings||[]).some(b=>b.username===user.username&&b.status==='booked')).slice(0,5)})});
app.get('/api/admin/announcements',guardianRequireAdmin('settings.view'),(_q,res)=>res.json({ok:true,announcements:guardianAnnouncements}));
app.post('/api/admin/announcements',guardianRequireAdmin('settings.edit'),(req,res)=>{guardianAnnouncements=Array.isArray(req.body?.announcements)?req.body.announcements:guardianAnnouncements;guardianWriteJson(guardianAnnouncementsFile,guardianAnnouncements);guardianAdminAuditLog(req.guardianAdmin.username,'ANNOUNCEMENTS_SAVED',{count:guardianAnnouncements.length});res.json({ok:true})});
app.get('/api/admin/guides',guardianRequireAdmin('settings.view'),(_q,res)=>res.json({ok:true,guides:guardianGuides}));
app.post('/api/admin/guides',guardianRequireAdmin('settings.edit'),(req,res)=>{guardianGuides=Array.isArray(req.body?.guides)?req.body.guides:guardianGuides;guardianWriteJson(guardianGuidesFile,guardianGuides);guardianAdminAuditLog(req.guardianAdmin.username,'GUIDES_SAVED',{count:guardianGuides.length});res.json({ok:true})});
app.post('/api/admin/guides/:id/discord',guardianRequireAdmin('settings.edit'),async(req,res)=>{const guide=req.body?.guide||guardianGuides.find(x=>x.id===req.params.id);const channelId=String(req.body?.channelId||guide?.discordChannelId||'');if(!guide||!channelId)return res.status(400).json({ok:false,error:'Guide and Discord channel are required'});const body=String(guide.body||'').replace(/^#{1,6}\s*/gm,'').slice(0,3500);const result=await guardianDiscordSend(channelId,{embeds:[guardianDiscordEmbed('📘 '+String(guide.title||'Guardian Guide'),body||String(guide.summary||'Guardian Operations guide'),{color:0x1e88ff,fields:[{name:'Category',value:String(guide.category||'Guide'),inline:true},{name:'Audience',value:String(guide.audience||'all').toUpperCase(),inline:true}],footer:{text:'Guardian Operations • Knowledge Base'}})]});if(!result.ok)return res.status(400).json({ok:false,error:result.error||'Discord send failed'});const row=guardianGuides.find(x=>x.id===guide.id);if(row){row.discordChannelId=channelId;row.discordSentAt=new Date().toISOString();guardianWriteJson(guardianGuidesFile,guardianGuides)}res.json({ok:true})});
app.post('/api/admin/forms/:id/discord',guardianRequireAdmin('settings.edit'),async(req,res)=>{const form=req.body?.form||guardianForms.find(x=>x.id===req.params.id);const channelId=String(req.body?.channelId||form?.discordChannelId||'');if(!form||!channelId)return res.status(400).json({ok:false,error:'Form and Discord channel are required'});const fieldPreview=(form.fields||[]).filter(f=>!['section','help'].includes(f.type)).slice(0,12).map((f,i)=>`${i+1}. ${f.label||'Question'}${f.required?' *':''}`).join('\n');const result=await guardianDiscordSend(channelId,{embeds:[guardianDiscordEmbed('📝 '+String(form.title||'Guardian Form'),String(form.description||form.instructions||'Complete this form through Guardian Operations.'),{color:0x6f42c1,fields:[{name:'Audience',value:String(form.audience||'member').toUpperCase(),inline:true},{name:'Approval',value:form.requiresApproval!==false?'STAFF REVIEW':'AUTOMATIC',inline:true},{name:'Questions',value:fieldPreview||'Configured in Guardian',inline:false}],footer:{text:'Guardian Operations • Forms'}})],components:[{type:1,components:[{type:2,style:5,label:'Open Guardian Forms',url:String((guardianConfig.portal||{}).publicBaseUrl||'https://guardian-web-qmnz.onrender.com')+'/portal/#forms'}]}]});if(!result.ok)return res.status(400).json({ok:false,error:result.error||'Discord send failed'});const row=guardianForms.find(x=>x.id===form.id);if(row){row.discordChannelId=channelId;row.discordSentAt=new Date().toISOString();guardianSaveForms()}res.json({ok:true})});
app.get('/api/admin/training',guardianRequireAdmin('settings.view'),(_q,res)=>res.json({ok:true,sessions:guardianTraining,services:guardianServices}));
app.post('/api/admin/training',guardianRequireAdmin('settings.edit'),async(req,res)=>{const incoming=req.body?.session;if(!incoming)return res.status(400).json({ok:false,error:'Session required'});let t=incoming.id?guardianTraining.find(x=>x.id===incoming.id):null;if(!t){t={id:crypto.randomUUID(),bookings:[],createdAt:new Date().toISOString()};guardianTraining.unshift(t)}Object.assign(t,{title:String(incoming.title||'Training Session'),serviceId:String(incoming.serviceId||'fire'),startsAt:String(incoming.startsAt||''),endsAt:String(incoming.endsAt||''),location:String(incoming.location||''),instructor:String(incoming.instructor||''),description:String(incoming.description||''),qualificationAwarded:String(incoming.qualificationAwarded||''),qualificationId:String(incoming.qualificationId||''),prerequisites:Array.isArray(incoming.prerequisites)?incoming.prerequisites:[],maxSlots:Number(incoming.maxSlots||0),bookingClosesAt:String(incoming.bookingClosesAt||''),discordChannelId:String(incoming.discordChannelId||''),published:incoming.published!==false});guardianWriteJson(guardianTrainingFile,guardianTraining);if(incoming.announce&&guardianDiscord.enabled)await guardianDiscordSend(t.discordChannelId||guardianDiscord.briefingChannelId||guardianDiscord.patrolChannelId,{embeds:[guardianDiscordEmbed('🎓 '+t.title,t.description||'Training session available.',{color:0x3498db,fields:[{name:'Starts',value:t.startsAt||'TBC',inline:true},{name:'Location',value:t.location||'TBC',inline:true},{name:'Qualification',value:t.qualificationAwarded||'None',inline:true}]})]});res.json({ok:true,session:t})});
app.post('/api/admin/training/:id/complete',guardianRequireAdmin('settings.edit'),(req,res)=>{const t=guardianTraining.find(x=>x.id===req.params.id);if(!t)return res.status(404).json({ok:false,error:'Training not found'});const usernames=Array.isArray(req.body?.usernames)?req.body.usernames:t.bookings||[];for(const username of usernames){const u=guardianAdminUsers.get(username);if(!u)continue;u.qualifications=Array.isArray(u.qualifications)?u.qualifications:[];if(t.qualificationAwarded&&!u.qualifications.some(q=>(typeof q==='string'?q:q.name)===t.qualificationAwarded))u.qualifications.push({name:t.qualificationAwarded,awardedAt:new Date().toISOString(),awardedBy:req.guardianAdmin.username,expiresAt:String(req.body?.expiresAt||'')})}guardianSaveUsers();t.completedAt=new Date().toISOString();guardianWriteJson(guardianTrainingFile,guardianTraining);guardianAdminAuditLog(req.guardianAdmin.username,'TRAINING_COMPLETED',{trainingId:t.id,users:usernames});res.json({ok:true})});
app.get('/api/admin/fleet',guardianRequireAdmin('settings.view'),(_q,res)=>res.json({ok:true,fleet:guardianFleet,services:guardianServices}));
app.post('/api/admin/fleet',guardianRequireAdmin('settings.edit'),(req,res)=>{
  guardianFleet=Array.isArray(req.body?.fleet)?req.body.fleet:guardianFleet;
  guardianWriteJson(guardianFleetFile,guardianFleet);
  // v56: one canonical fleet directory. Mirror active records into the operational appliance list
  // so Control/MDT/FiveM continue to use the same vehicles without a second admin page.
  guardianConfig.appliances=guardianFleet.filter(v=>v&&v.active!==false&&String(v.status||'').toLowerCase()!=='retired').map(v=>({
    id:v.id,serviceId:String(v.serviceId||'fire'),callsign:String(v.callsign||'').trim().toUpperCase(),
    station:String(v.station||''),type:String(v.type||v.name||''),skills:Array.isArray(v.capabilities)?v.capabilities:(Array.isArray(v.skills)?v.skills:[]),
    status:String(v.status||'available'),registration:String(v.registration||''),spawnCode:String(v.spawnCode||''),
    liveryNumber:String(v.liveryNumber||''),active:v.active!==false
  }));
  guardianWriteJson(guardianConfigFile,guardianConfig);
  applyGuardianBaselineToState();
  guardianAdminAuditLog(req.guardianAdmin.username,'FLEET_SAVED',{count:guardianFleet.length,operationalCount:guardianConfig.appliances.length});
  res.json({ok:true,fleet:guardianFleet,appliances:guardianConfig.appliances});
});
app.get('/api/admin/patrol-templates',guardianRequireAdmin('settings.view'),(_q,res)=>res.json({ok:true,templates:guardianPatrolTemplates}));
app.post('/api/admin/patrol-templates',guardianRequireAdmin('settings.edit'),(req,res)=>{guardianPatrolTemplates=Array.isArray(req.body?.templates)?req.body.templates:guardianPatrolTemplates;guardianWriteJson(guardianPatrolTemplatesFile,guardianPatrolTemplates);res.json({ok:true})});
app.post('/api/admin/patrols/from-template',guardianRequireAdmin('settings.edit'),(req,res)=>{const t=guardianPatrolTemplates.find(x=>x.id===req.body?.templateId);if(!t)return res.status(404).json({ok:false,error:'Template not found'});const p={id:crypto.randomUUID(),title:t.title,serviceId:t.serviceId||'joint',startsAt:String(req.body?.startsAt||''),maxSlots:Number(t.maxSlots||0),briefing:t.briefing||'',published:true,requiredQualifications:t.requiredQualifications||[],bookings:[],createdAt:new Date().toISOString()};guardianPatrols.unshift(p);guardianSavePatrols();guardianAdminAuditLog(req.guardianAdmin.username,'PATROL_CREATED_FROM_TEMPLATE',{templateId:t.id,patrolId:p.id});res.json({ok:true,patrol:p})});
app.post('/api/admin/patrols/:id/attendance',guardianRequireAdmin('settings.edit'),(req,res)=>{const p=guardianPatrols.find(x=>x.id===req.params.id);if(!p)return res.status(404).json({ok:false,error:'Patrol not found'});const b=(p.bookings||[]).find(x=>x.username===req.body?.username);if(!b)return res.status(404).json({ok:false,error:'Booking not found'});const action=String(req.body?.action||'');if(action==='checkin')b.checkInAt=new Date().toISOString();if(action==='checkout')b.checkOutAt=new Date().toISOString();if(action==='noshow')b.attendanceStatus='no-show';if(action==='attended')b.attendanceStatus='attended';guardianSavePatrols();res.json({ok:true,booking:b})});
app.get('/api/admin/role-permissions',guardianRequireAdmin('settings.view'),(_q,res)=>res.json({ok:true,permissions:guardianRolePermissions}));
app.post('/api/admin/role-permissions',guardianRequireAdmin('settings.edit'),(req,res)=>{if(!req.body?.permissions||typeof req.body.permissions!=='object')return res.status(400).json({ok:false,error:'Permissions required'});guardianRolePermissions=req.body.permissions;guardianWriteJson(guardianRolePermissionsFile,guardianRolePermissions);guardianAdminAuditLog(req.guardianAdmin.username,'ROLE_PERMISSIONS_SAVED');res.json({ok:true})});


app.get('/api/community/patrols',(req,res)=>{
  const session=guardianUserReadSession(req)||guardianAdminReadSession(req);if(!session)return res.json({ok:true,patrols:[]});const u=guardianAdminUsers.get(session.username);if(!u||String(u.whitelistStatus||'').toLowerCase()!=='approved')return res.json({ok:true,patrols:[]});if(guardianEnsureDefaultPolice(u))guardianSaveUsers();
  res.json({ok:true,patrols:guardianPatrols.filter(p=>p.published!==false).map(p=>({...p,bookingsClosed:guardianPatrolBookingsClosed(p),bookingClosesAt:p.bookingClosesAt||(guardianPatrolCloseMs(p)?new Date(guardianPatrolCloseMs(p)).toISOString():''),bookings:(p.bookings||[]).map(b=>({...b,isMe:b.username===session.username}))}))});
});
app.post('/api/community/patrols/:id/book',(req,res)=>{
  const session=guardianUserReadSession(req)||guardianAdminReadSession(req);if(!session)return res.status(401).json({ok:false,error:'Sign in required'});const u=guardianAdminUsers.get(session.username);if(!u||String(u.whitelistStatus||'').toLowerCase()!=='approved')return res.status(403).json({ok:false,error:'Whitelist approval required'});const p=guardianPatrols.find(x=>x.id===req.params.id);if(!p)return res.status(404).json({ok:false,error:'Patrol not found'});if(guardianPatrolBookingsClosed(p))return res.status(409).json({ok:false,error:'Bookings are closed for this patrol'});if(guardianEnsureDefaultPolice(u))guardianSaveUsers();p.bookings=Array.isArray(p.bookings)?p.bookings:[];const currentAttending=p.bookings.filter(x=>['attending','booked'].includes(String(x.status))).length;const existing=p.bookings.find(x=>x.username===session.username);if(Number(p.maxSlots||0)>0&&currentAttending>=Number(p.maxSlots)&&!existing?.status?.match(/^(attending|booked)$/))return res.status(409).json({ok:false,error:'This patrol is full'});let b=existing;if(!b){b={username:session.username,displayName:u.displayName||session.username,bookedAt:new Date().toISOString(),status:'attending',deployment:null,source:'guardian'};p.bookings.push(b)}else{b.status='attending';b.respondedAt=new Date().toISOString();b.source='guardian'}guardianSavePatrols();guardianAdminAuditLog(session.username,'PATROL_ATTENDING',{patrolId:p.id,source:'guardian'});guardianPatrolSyncDiscord(p,{createIfMissing:false});res.json({ok:true,booking:b});
});
app.post('/api/community/patrols/:id/cancel',(req,res)=>{
  const session=guardianUserReadSession(req)||guardianAdminReadSession(req);if(!session)return res.status(401).json({ok:false,error:'Sign in required'});const p=guardianPatrols.find(x=>x.id===req.params.id);if(!p)return res.status(404).json({ok:false,error:'Patrol not found'});if(guardianPatrolBookingsClosed(p))return res.status(409).json({ok:false,error:'Bookings are closed for this patrol'});const b=(p.bookings||[]).find(x=>x.username===session.username);if(b){b.status='not-attending';b.respondedAt=new Date().toISOString();b.source='guardian'}guardianSavePatrols();guardianPatrolSyncDiscord(p,{createIfMissing:false});res.json({ok:true});
});
app.get('/api/admin/patrols',guardianRequireAdmin('settings.view'),(req,res)=>{for(const u of guardianAdminUsers.values())if(guardianEnsureDefaultPolice(u)){}guardianSaveUsers();res.json({ok:true,patrols:guardianPatrols.map(p=>({...p,bookingsClosed:guardianPatrolBookingsClosed(p),bookingClosesAt:p.bookingClosesAt||(guardianPatrolCloseMs(p)?new Date(guardianPatrolCloseMs(p)).toISOString():'')})),services:guardianServices,users:[...guardianAdminUsers.values()].map(u=>guardianUserPublicProfile(u)),fleet:guardianFleet||[]})});
app.post('/api/admin/patrols',guardianRequireAdmin('settings.edit'),async(req,res)=>{
  const incoming=req.body?.patrol;if(!incoming)return res.status(400).json({ok:false,error:'Patrol required'});let p=incoming.id?guardianPatrols.find(x=>x.id===incoming.id):null;if(!p){p={id:crypto.randomUUID(),bookings:[],createdAt:new Date().toISOString()};guardianPatrols.unshift(p)}
  const start=String(incoming.startsAt||p.startsAt||'');let close=String(incoming.bookingClosesAt||p.bookingClosesAt||'');if(!close&&Date.parse(start))close=new Date(Date.parse(start)-3600000).toISOString();
  Object.assign(p,{title:String(incoming.title||p.title||'Official Patrol'),serviceId:String(incoming.serviceId||p.serviceId||'joint'),startsAt:start,bookingClosesAt:close,maxSlots:Number(incoming.maxSlots??p.maxSlots??0),briefing:String(incoming.briefing??p.briefing??''),published:incoming.published!==false,discordChannelId:String(incoming.discordChannelId||p.discordChannelId||guardianDiscord.patrolChannelId||''),bookingsManuallyClosed:incoming.bookingsManuallyClosed===true,requiredQualifications:Array.isArray(incoming.requiredQualifications)?incoming.requiredQualifications:(p.requiredQualifications||[])});guardianSavePatrols();guardianAdminAuditLog(req.guardianAdmin.username,'PATROL_SAVED',{patrolId:p.id});
  if(incoming.announce===true){const r=await guardianPatrolSyncDiscord(p,{createIfMissing:true});if(!r.ok&&!r.skipped)return res.status(400).json({ok:false,error:r.error||'Discord publish failed'})}
  res.json({ok:true,patrol:p});
});
app.post('/api/admin/patrols/:id/discord',guardianRequireAdmin('settings.edit'),async(req,res)=>{const p=guardianPatrols.find(x=>x.id===req.params.id);if(!p)return res.status(404).json({ok:false,error:'Patrol not found'});if(req.body?.channelId)p.discordChannelId=String(req.body.channelId);const r=await guardianPatrolSyncDiscord(p,{createIfMissing:true});if(!r.ok)return res.status(400).json({ok:false,error:r.error||'Discord publish failed'});res.json({ok:true,messageId:p.discordMessageId,channelId:p.discordChannelId})});
app.post('/api/admin/patrols/:id/bookings',guardianRequireAdmin('settings.edit'),async(req,res)=>{const p=guardianPatrols.find(x=>x.id===req.params.id);if(!p)return res.status(404).json({ok:false,error:'Patrol not found'});const action=String(req.body?.action||'');if(action==='close'){p.bookingsManuallyClosed=true;p.manualClosedAt=new Date().toISOString();p.manualClosedBy=req.guardianAdmin.username}else if(action==='open'){p.bookingsManuallyClosed=false;p.manualClosedAt=null;p.manualClosedBy=null;if(guardianPatrolCloseMs(p)&&Date.now()>=guardianPatrolCloseMs(p))return res.status(409).json({ok:false,error:'The automatic booking close time has already passed. Change the close time before reopening.'})}else return res.status(400).json({ok:false,error:'Use close or open'});guardianSavePatrols();await guardianPatrolSyncDiscord(p,{createIfMissing:false});guardianAdminAuditLog(req.guardianAdmin.username,action==='close'?'PATROL_BOOKINGS_CLOSED':'PATROL_BOOKINGS_OPENED',{patrolId:p.id});res.json({ok:true,closed:guardianPatrolBookingsClosed(p)})});
app.delete('/api/admin/patrols/:id',guardianRequireAdmin('settings.edit'),(req,res)=>{guardianPatrols=guardianPatrols.filter(x=>x.id!==req.params.id);guardianSavePatrols();res.json({ok:true})});
app.post('/api/admin/patrols/:id/deployment',guardianRequireAdmin('settings.edit'),async(req,res)=>{
  const p=guardianPatrols.find(x=>x.id===req.params.id);if(!p)return res.status(404).json({ok:false,error:'Patrol not found'});if(!guardianPatrolBookingsClosed(p))return res.status(409).json({ok:false,error:'Close patrol bookings before assigning duty details'});const username=String(req.body?.username||'');const b=(p.bookings||[]).find(x=>x.username===username&&['attending','booked'].includes(String(x.status)));if(!b)return res.status(404).json({ok:false,error:'Attending booking not found'});const u=guardianAdminUsers.get(username);if(!u)return res.status(404).json({ok:false,error:'Guardian user not found'});const serviceId=String(req.body?.serviceId||'police');const eligible=guardianPatrolEligible(u);if(!eligible.includes(serviceId))return res.status(403).json({ok:false,error:'This member is not approved for that service'});const division=String(req.body?.division||'');const allowedDivs=guardianPatrolEligibleDivisions(u,serviceId);if(allowedDivs.length&&division&&!allowedDivs.includes(division))return res.status(403).json({ok:false,error:'This member is not approved for that division'});const callsign=String(req.body?.callsign||'').trim().toUpperCase();if(callsign){for(const other of p.bookings||[]){if(other!==b&&['attending','booked'].includes(String(other.status))&&String(other.deployment?.callsign||'').toUpperCase()===callsign)return res.status(409).json({ok:false,error:'That callsign is already assigned on this patrol'})}}
  b.deployment={serviceId,callsign,division,vehicle:String(req.body?.vehicle||''),assignedAt:new Date().toISOString(),assignedBy:req.guardianAdmin.username};guardianSavePatrols();guardianAdminAuditLog(req.guardianAdmin.username,'PATROL_DUTY_ASSIGNED',{patrolId:p.id,username,deployment:b.deployment});await guardianPatrolSyncDiscord(p,{createIfMissing:false});res.json({ok:true,booking:b});
});

// Portal public configuration and application workflow
app.get("/api/portal/config",(_req,res)=>{res.setHeader("Cache-Control","no-store, no-cache, must-revalidate");res.json({ok:true,portal:guardianPortalConfig(),revision:Number(guardianConfig.portal?.updatedAt||0)})});
app.get("/api/portal/me",(req,res)=>{
  const session=guardianUserReadSession(req)||guardianAdminReadSession(req);
  if(!session)return res.json({ok:true,authenticated:false,whitelisted:false});
  const user=guardianAdminUsers.get(session.username);
  const application=guardianApplications.find(a=>a.username===session.username)||null;
  res.json({ok:true,authenticated:true,whitelisted:guardianUserWhitelisted(session.username),permissions:guardianRolePermissions[session.role]||guardianRolePermissions.player||{},user:user?guardianUserPublicProfile(user):{username:session.username,displayName:session.username,role:session.role,membershipType:"non-member",whitelistStatus:"pending",serviceAssignments:[],qualifications:[]},application:application?{id:application.id,status:application.status,submittedAt:application.submittedAt,reviewedAt:application.reviewedAt||null}:null});
});
app.post("/api/applications",(req,res)=>{
  const portal=guardianPortalConfig();
  if(!portal.applyEnabled)return res.status(403).json({ok:false,error:"Applications are currently closed"});
  const username=String(req.body?.username||"").trim();
  const displayName=String(req.body?.displayName||username).trim();
  const password=String(req.body?.password||"");
  const discord=String(req.body?.discord||"").trim();
  const age=Number(req.body?.age||0);
  const answers=Array.isArray(req.body?.answers)?req.body.answers.map(x=>String(x||"").trim()):[];
  if(!/^[a-zA-Z0-9_.-]{3,32}$/.test(username))return res.status(400).json({ok:false,error:"Username must be 3–32 characters using letters, numbers, dot, dash or underscore"});
  if(password.length<8)return res.status(400).json({ok:false,error:"Password must be at least 8 characters"});
  if(!discord)return res.status(400).json({ok:false,error:"Discord username / ID is required"});
  if(age<portal.minimumAge)return res.status(400).json({ok:false,error:`Applicants must be at least ${portal.minimumAge}`});
  if(req.body?.rulesAccepted!==true)return res.status(400).json({ok:false,error:"You must confirm the community rules"});
  if(guardianAdminUsers.has(username))return res.status(409).json({ok:false,error:"That Guardian username already exists"});
  const pw=guardianAdminHashPassword(password),nowIso=new Date().toISOString();
  guardianAdminUsers.set(username,{username,displayName,role:"player",protected:false,salt:pw.salt,passwordHash:pw.hash,createdAt:nowIso,whitelistStatus:"pending",whitelistUpdatedAt:nowIso,membershipType:"non-member",serviceAssignments:[],qualifications:[]});
  guardianSaveUsers();
  const application={id:crypto.randomUUID(),username,displayName,discord,age,answers,rulesAccepted:true,status:"pending",submittedAt:nowIso,reviewedAt:null,reviewedBy:null,reviewNote:""};
  guardianApplications.unshift(application);guardianSaveApplications();guardianAdminAuditLog(username,"WHITELIST_APPLICATION_SUBMITTED",{applicationId:application.id});
  guardianUserSetCookie(res,guardianAdminUsers.get(username),12*60*60);
  res.json({ok:true,status:"pending",redirect:"/portal/?status=pending"});
});
app.get("/api/admin/applications",guardianRequireAdmin("settings.view"),(req,res)=>{
  res.json({ok:true,applications:guardianApplications});
});
app.post("/api/admin/applications/:id/review",guardianRequireAdmin("settings.edit"),(req,res)=>{
  const application=guardianApplications.find(a=>a.id===req.params.id);
  if(!application)return res.status(404).json({ok:false,error:"Application not found"});
  const decision=String(req.body?.decision||"").toLowerCase();
  if(!["approved","rejected"].includes(decision))return res.status(400).json({ok:false,error:"Decision must be approved or rejected"});
  const user=guardianAdminUsers.get(application.username);
  if(!user)return res.status(404).json({ok:false,error:"Applicant account not found"});
  application.status=decision;application.reviewedAt=new Date().toISOString();application.reviewedBy=req.guardianAdmin.username;application.reviewNote=String(req.body?.note||"").trim();
  user.whitelistStatus=decision;user.whitelistUpdatedAt=application.reviewedAt;if(decision==="approved"&&!user.membershipType)user.membershipType="member";if(decision==="approved")guardianEnsureDefaultPolice(user);
  guardianSaveUsers();guardianSaveApplications();guardianAdminAuditLog(req.guardianAdmin.username,"WHITELIST_APPLICATION_REVIEWED",{applicationId:application.id,username:application.username,decision});
  res.json({ok:true,application});
});
app.post("/api/admin/users/:username/whitelist",guardianRequireAdmin("settings.edit"),(req,res)=>{
  const user=guardianAdminUsers.get(String(req.params.username||""));if(!user)return res.status(404).json({ok:false,error:"User not found"});
  const status=String(req.body?.status||"").toLowerCase();if(!["approved","pending","rejected"].includes(status))return res.status(400).json({ok:false,error:"Invalid whitelist status"});
  if(user.protected&&status!=="approved")return res.status(403).json({ok:false,error:"Protected owner access cannot be revoked"});
  user.whitelistStatus=status;user.whitelistUpdatedAt=new Date().toISOString();if(status==="approved")guardianEnsureDefaultPolice(user);guardianSaveUsers();guardianAdminAuditLog(req.guardianAdmin.username,"USER_WHITELIST_CHANGED",{username:user.username,status});res.json({ok:true,status});
});

app.get("/api/admin/audit",guardianRequireAdmin("audit.view"),(req,res)=>{
  res.json({ok:true,audit:guardianAdminAudit});
});

app.get("/api/admin/export",guardianRequireAdmin("settings.view"),(req,res)=>{
  const payload={version:2,exportedAt:new Date().toISOString(),config:guardianConfig,stationMapPositions:{...stationMapPositions},stationMapLocked};
  guardianAdminAuditLog(req.guardianAdmin.username,"CONFIG_EXPORTED");
  res.setHeader("Content-Disposition",'attachment; filename="guardian-full-backup.json"');res.type("application/json").send(JSON.stringify(payload,null,2));
});
app.post("/api/admin/import",guardianRequireAdmin("settings.edit"),(req,res)=>{
  const payload=req.body;if(!payload?.config||typeof payload.config!=="object")return res.status(400).json({ok:false,error:"Invalid Guardian backup"});
  guardianConfig=payload.config;
  if(payload.stationMapPositions&&typeof payload.stationMapPositions==="object")stationMapPositions={...payload.stationMapPositions};
  if(typeof payload.stationMapLocked==="boolean")stationMapLocked=payload.stationMapLocked;
  guardianWriteJson(guardianConfigFile,guardianConfig);saveStationMapPositions();saveStationMapLock();applyGuardianBaselineToState();applySavedStationPositions();
  guardianAdminAuditLog(req.guardianAdmin.username,"CONFIG_IMPORTED",{version:payload.version||1});touch();res.json({ok:true,config:guardianConfig});
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



function guardianUnitOperationallyLive(callsign){
  const cs=String(callsign||"").trim().toUpperCase();
  const u=state.units?.[cs];
  if(!u)return false;
  if(state.connected===true && u.webOnly!==true)return true;
  return !!state.bookings?.[cs] || u.webBooked===true || u.signedOn===true || u.bookedOn===true;
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
    if(state.units[cs]){
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
    inc.closureOutcome=String(data.closureOutcome||inc.closureOutcome||"");
    inc.closureNotes=String(data.closureNotes||inc.closureNotes||"");
    inc.closedBy=String(data.closedBy||inc.closedBy||"CONTROL");
    guardianCoreTimeline(inc,`Incident closed${inc.closureOutcome?` — ${inc.closureOutcome}`:""}`,inc.closureNotes||"","incidentClosed");
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
    const requestedCs=String(data.callsign||data.appliance||"").trim().toUpperCase();
    if(data.assign!==false && requestedCs && !guardianUnitOperationallyLive(requestedCs)){
      return res.status(409).json({ok:false,error:`${requestedCs} is not signed on and cannot be mobilised`});
    }
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

  const vehicleMode=String(req.headers["x-guardian-vehicle"]||"")==="1";
  if(vehicleMode){
    const session=guardianUserReadSession(req);
    if(!session)return res.status(401).json({ok:false,error:"Vehicle login required"});
    const assigned=guardianVehicleAssignment(session.username);
    if(!assigned)return res.status(409).json({ok:false,error:"Awaiting callsign assignment — contact Control"});
    const vehicleAllowed=new Set(["webBookOn","webBookOff","webMdtStatus","webMdtAck","webMdtMessage","ackStandbyMove"]);
    if(!vehicleAllowed.has(action))return res.status(403).json({ok:false,error:"Action not available on vehicle MDT"});
    data.callsign=assigned;
  }

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



// ============================================================
// Guardian v51 Command Suite
// Personnel governance, promotion pathways, snapshots, search,
// public status, station dashboards and template library.
// ============================================================
const guardianPersonnelFile=path.join(guardianAdminDataDir,'guardian-personnel.json');
const guardianPromotionPathwaysFile=path.join(guardianAdminDataDir,'guardian-promotion-pathways.json');
const guardianPlatformFile=path.join(guardianAdminDataDir,'guardian-platform.json');
const guardianSnapshotsDir=path.join(guardianAdminDataDir,'snapshots');try{fs.mkdirSync(guardianSnapshotsDir,{recursive:true})}catch{}
let guardianPersonnel=guardianReadJson(guardianPersonnelFile,{});if(!guardianPersonnel||Array.isArray(guardianPersonnel)||typeof guardianPersonnel!=='object')guardianPersonnel={};
let guardianPromotionPathways=guardianReadJson(guardianPromotionPathwaysFile,[]);if(!Array.isArray(guardianPromotionPathways))guardianPromotionPathways=[];
let guardianPlatform=guardianReadJson(guardianPlatformFile,{statusPage:{enabled:true,message:'All Guardian systems operational.'},dashboardWidgets:{member:['announcements','operations','forms'],staff:['announcements','operations','reviews','training'],control:['operations','radio','incidents'],fire:['operations','training','guides'],police:['operations','training','guides'],ambulance:['operations','training','guides']}});
function guardianSavePersonnel(){guardianWriteJson(guardianPersonnelFile,guardianPersonnel)}
function guardianPersonnelFor(username){const key=String(username||'');if(!guardianPersonnel[key])guardianPersonnel[key]={notes:[],commendations:[],warnings:[],disciplinary:[],serviceHistory:[],promotionHistory:[],dutyHistory:[],activeDuty:null};return guardianPersonnel[key]}
function guardianTotalDutyHours(p){return (p?.dutyHistory||[]).reduce((sum,d)=>sum+Number(d.hours||0),0)}
function guardianSnapshotPayload(){return {version:51,exportedAt:new Date().toISOString(),config:guardianConfig,services:guardianServices,forms:guardianForms,guides:guardianGuides,announcements:guardianAnnouncements,rolePermissions:guardianRolePermissions,qualifications:guardianQualifications,personnel:guardianPersonnel,promotionPathways:guardianPromotionPathways,platform:guardianPlatform,stationMapPositions:{...stationMapPositions},stationMapLocked}}
function guardianRestoreSnapshotPayload(p){if(!p?.config)throw new Error('Invalid Guardian snapshot');guardianConfig=p.config;if(Array.isArray(p.services))guardianServices=p.services;if(Array.isArray(p.forms))guardianForms=p.forms;if(Array.isArray(p.guides))guardianGuides=p.guides;if(Array.isArray(p.announcements))guardianAnnouncements=p.announcements;if(p.rolePermissions)guardianRolePermissions=p.rolePermissions;if(Array.isArray(p.qualifications))guardianQualifications=p.qualifications;if(p.personnel)guardianPersonnel=p.personnel;if(Array.isArray(p.promotionPathways))guardianPromotionPathways=p.promotionPathways;if(p.platform)guardianPlatform=p.platform;if(p.stationMapPositions)stationMapPositions={...p.stationMapPositions};if(typeof p.stationMapLocked==='boolean')stationMapLocked=p.stationMapLocked;guardianWriteJson(guardianConfigFile,guardianConfig);guardianSaveServices();guardianSaveForms();guardianWriteJson(guardianGuidesFile,guardianGuides);guardianWriteJson(guardianAnnouncementsFile,guardianAnnouncements);guardianWriteJson(guardianRolePermissionsFile,guardianRolePermissions);guardianWriteJson(guardianQualificationsFile,guardianQualifications);guardianSavePersonnel();guardianWriteJson(guardianPromotionPathwaysFile,guardianPromotionPathways);guardianWriteJson(guardianPlatformFile,guardianPlatform);saveStationMapPositions();saveStationMapLock();applyGuardianBaselineToState();applySavedStationPositions()}

const guardianTemplates=[
 {id:'form-whitelist-pro',kind:'form',title:'Professional Whitelist Application',description:'Membership, experience, rules acknowledgement and operational interests.',data:{title:'Whitelist Application',category:'Applications',audience:'guest',published:true,requiresApproval:true,allowRepeat:false,description:'Apply for Guardian membership and operational access.',instructions:'Please answer honestly. Staff review every application.',confirmationText:'Application received. Track its status in Your Profile.',fields:[{id:'realname',label:'Preferred name',type:'text',required:true},{id:'discord',label:'Discord username / ID',type:'text',required:true},{id:'age',label:'Age',type:'number',required:true},{id:'experience',label:'Tell us about your roleplay experience',type:'textarea',required:true},{id:'service',label:'Which service interests you?',type:'select',options:['Fire & Rescue','Police','Ambulance / NHS','Control','Specialist'],required:true},{id:'rules',label:'I agree to follow the community rules and roleplay standards',type:'acknowledgement',required:true}]}},
 {id:'form-loa',kind:'form',title:'Leave of Absence',description:'Structured LOA request with dates, reason and contact status.',data:{title:'Leave of Absence',category:'Member Requests',audience:'member',published:true,requiresApproval:true,fields:[{id:'from',label:'From',type:'date',required:true},{id:'to',label:'To',type:'date',required:true},{id:'reason',label:'Reason',type:'textarea',required:true},{id:'contactable',label:'Can staff contact you while away?',type:'select',options:['Yes','Emergency only','No'],required:true}]}},
 {id:'form-incident-report',kind:'form',title:'Incident / Conduct Report',description:'Report an in-game or community issue with evidence and witnesses.',data:{title:'Incident / Conduct Report',category:'Reports',audience:'member',published:true,requiresApproval:true,fields:[{id:'when',label:'Date / time',type:'text',required:true},{id:'people',label:'People involved',type:'textarea',required:true},{id:'details',label:'What happened?',type:'textarea',required:true},{id:'evidence',label:'Evidence links',type:'textarea',required:false}]}},
 {id:'form-training',kind:'form',title:'Training Request',description:'Request a course or competency assessment.',data:{title:'Training Request',category:'Training',audience:'whitelisted',published:true,requiresApproval:true,fields:[{id:'course',label:'Requested course / skill',type:'text',required:true},{id:'reason',label:'Why do you need it?',type:'textarea',required:true},{id:'availability',label:'Availability',type:'textarea',required:true}]}},
 {id:'guide-sop',kind:'guide',title:'SOP Page',description:'Operational procedure page with purpose, responsibilities and review date.',data:{title:'New SOP',category:'SOP',audience:'whitelisted',published:false,summary:'Operational procedure.',body:'# Purpose\n\nDescribe the purpose.\n\n## Scope\n\nWho this applies to.\n\n## Procedure\n\n1. Step one\n2. Step two\n\n## Responsibilities\n\n## Review date\n'}}
];

app.get('/api/admin/personnel',guardianRequireAdmin('settings.view'),(_q,res)=>res.json({ok:true,users:[...guardianAdminUsers.values()].map(u=>({...guardianUserPublicProfile(u),serviceAssignments:u.serviceAssignments||[],personnel:{...guardianPersonnelFor(u.username),totalDutyHours:guardianTotalDutyHours(guardianPersonnelFor(u.username))}})),promotionPathways:guardianPromotionPathways}));
app.post('/api/admin/personnel/:username/note',guardianRequireAdmin('settings.edit'),(req,res)=>{const u=guardianAdminUsers.get(req.params.username);if(!u)return res.status(404).json({ok:false,error:'User not found'});const text=String(req.body?.text||'').trim();if(!text)return res.status(400).json({ok:false,error:'Note required'});guardianPersonnelFor(u.username).notes.unshift({id:crypto.randomUUID(),at:new Date().toISOString(),by:req.guardianAdmin.username,text});guardianSavePersonnel();guardianAdminAuditLog(req.guardianAdmin.username,'PERSONNEL_NOTE_ADDED',{username:u.username});res.json({ok:true})});
app.post('/api/admin/personnel/:username/commendation',guardianRequireAdmin('settings.edit'),(req,res)=>{const u=guardianAdminUsers.get(req.params.username);if(!u)return res.status(404).json({ok:false,error:'User not found'});guardianPersonnelFor(u.username).commendations.unshift({id:crypto.randomUUID(),at:new Date().toISOString(),by:req.guardianAdmin.username,text:String(req.body?.text||'')});guardianSavePersonnel();guardianAdminAuditLog(req.guardianAdmin.username,'COMMENDATION_ADDED',{username:u.username});res.json({ok:true})});
app.post('/api/admin/personnel/:username/warning',guardianRequireAdmin('settings.edit'),(req,res)=>{const u=guardianAdminUsers.get(req.params.username);if(!u)return res.status(404).json({ok:false,error:'User not found'});guardianPersonnelFor(u.username).warnings.unshift({id:crypto.randomUUID(),at:new Date().toISOString(),by:req.guardianAdmin.username,text:String(req.body?.text||'')});guardianSavePersonnel();guardianAdminAuditLog(req.guardianAdmin.username,'PERSONNEL_WARNING_ADDED',{username:u.username});res.json({ok:true})});
app.post('/api/admin/personnel/:username/discipline',guardianRequireAdmin('settings.edit'),(req,res)=>{const u=guardianAdminUsers.get(req.params.username);if(!u)return res.status(404).json({ok:false,error:'User not found'});const c={id:crypto.randomUUID(),title:String(req.body?.title||'Conduct review'),summary:String(req.body?.summary||''),status:'open',openedAt:new Date().toISOString(),openedBy:req.guardianAdmin.username,outcome:'Pending'};guardianPersonnelFor(u.username).disciplinary.unshift(c);guardianSavePersonnel();guardianAdminAuditLog(req.guardianAdmin.username,'DISCIPLINARY_CASE_OPENED',{username:u.username,caseId:c.id});res.json({ok:true,case:c})});
app.post('/api/admin/personnel/:username/duty',guardianRequireAdmin('settings.edit'),(req,res)=>{const u=guardianAdminUsers.get(req.params.username);if(!u)return res.status(404).json({ok:false,error:'User not found'});const p=guardianPersonnelFor(u.username),action=String(req.body?.action||'');if(action==='on'){if(p.activeDuty)return res.status(409).json({ok:false,error:'User is already on duty'});p.activeDuty={startedAt:new Date().toISOString(),startedBy:req.guardianAdmin.username,serviceId:String(req.body?.serviceId||''),station:String(req.body?.station||''),rank:String(req.body?.rank||''),callsign:String(req.body?.callsign||'').toUpperCase()};guardianAdminAuditLog(req.guardianAdmin.username,'USER_BOOKED_ON_DUTY',{username:u.username,callsign:p.activeDuty.callsign})}else if(action==='off'){if(!p.activeDuty)return res.status(409).json({ok:false,error:'User is not on duty'});const end=new Date(),start=new Date(p.activeDuty.startedAt),hours=Math.max(0,(end-start)/3600000);p.dutyHistory.unshift({...p.activeDuty,endedAt:end.toISOString(),endedBy:req.guardianAdmin.username,hours:Number(hours.toFixed(2))});p.activeDuty=null;guardianAdminAuditLog(req.guardianAdmin.username,'USER_BOOKED_OFF_DUTY',{username:u.username,hours:Number(hours.toFixed(2))})}else return res.status(400).json({ok:false,error:'Action must be on or off'});guardianSavePersonnel();res.json({ok:true,personnel:p})});

app.get('/api/admin/promotion-pathways',guardianRequireAdmin('settings.view'),(_q,res)=>res.json({ok:true,pathways:guardianPromotionPathways}));
app.post('/api/admin/promotion-pathways',guardianRequireAdmin('settings.edit'),(req,res)=>{guardianPromotionPathways=Array.isArray(req.body?.pathways)?req.body.pathways:guardianPromotionPathways;guardianWriteJson(guardianPromotionPathwaysFile,guardianPromotionPathways);guardianAdminAuditLog(req.guardianAdmin.username,'PROMOTION_PATHWAYS_SAVED',{count:guardianPromotionPathways.length});res.json({ok:true})});
app.post('/api/admin/personnel/:username/promote',guardianRequireAdmin('settings.edit'),(req,res)=>{const u=guardianAdminUsers.get(req.params.username);if(!u)return res.status(404).json({ok:false,error:'User not found'});const serviceId=String(req.body?.serviceId||''),targetRank=String(req.body?.targetRank||'');const path=guardianPromotionPathways.find(p=>p.serviceId===serviceId&&String(p.targetRank).toLowerCase()===targetRank.toLowerCase());if(!path)return res.status(400).json({ok:false,error:'No promotion pathway configured for this rank'});const p=guardianPersonnelFor(u.username),hours=guardianTotalDutyHours(p),held=(u.qualifications||[]).map(q=>typeof q==='string'?q:q.name||q.id);if(hours<Number(path.minimumHours||0))return res.status(400).json({ok:false,error:`Member needs ${path.minimumHours} duty hours`});const missing=(path.requiredQualifications||[]).filter(q=>!held.some(h=>String(h).toLowerCase()===String(q).toLowerCase()));if(missing.length)return res.status(400).json({ok:false,error:'Missing qualifications: '+missing.join(', ')});const privileged=['owner','admin'].includes(req.guardianAdmin.role);if(!privileged&&!(path.approvedPromoters||[]).includes(req.guardianAdmin.username))return res.status(403).json({ok:false,error:'You are not authorised to award this rank'});const a=(u.serviceAssignments||[]).find(x=>x.serviceId===serviceId);if(!a)return res.status(400).json({ok:false,error:'User is not assigned to this service'});const previous=a.rank||'';a.rank=targetRank;p.promotionHistory.unshift({id:crypto.randomUUID(),at:new Date().toISOString(),by:req.guardianAdmin.username,title:`Promoted to ${targetRank}`,note:`Previous rank: ${previous||'None'}`});guardianSaveUsers();guardianSavePersonnel();guardianAdminAuditLog(req.guardianAdmin.username,'USER_PROMOTED',{username:u.username,serviceId,targetRank,previous});res.json({ok:true})});

app.post('/api/admin/services/onboard',guardianRequireAdmin('settings.edit'),(req,res)=>{const s=req.body?.service;if(!s?.id||!s?.name)return res.status(400).json({ok:false,error:'Service name and ID required'});if(guardianServices.some(x=>x.id===s.id))return res.status(409).json({ok:false,error:'Service ID already exists'});const service={id:String(s.id),name:String(s.name),enabled:true,accentColor:String(s.accentColor||'#2397ff'),icon:String(s.icon||'◆'),callsignPattern:String(s.callsignPattern||'UNIT-##'),ranks:Array.isArray(s.ranks)?s.ranks:[],divisions:Array.isArray(s.divisions)?s.divisions:[],roles:[],qualifications:Array.isArray(s.qualifications)?s.qualifications:[]};guardianServices.push(service);guardianSaveServices();if(s.starterStation){guardianConfig.stations=Array.isArray(guardianConfig.stations)?guardianConfig.stations:[];guardianConfig.stations.push({serviceId:service.id,name:String(s.starterStation),code:'',locationType:service.id==='police'?'Police Station':service.id==='ambulance'?'Ambulance Station':service.id==='control'?'Control Centre':'Station',postal:'',active:true})}if(s.starterVehicleType){guardianConfig.applianceTypes=Array.isArray(guardianConfig.applianceTypes)?guardianConfig.applianceTypes:[];if(!guardianConfig.applianceTypes.includes(s.starterVehicleType))guardianConfig.applianceTypes.push(s.starterVehicleType)}for(const q of service.qualifications){if(!guardianQualifications.some(x=>String(x.name).toLowerCase()===String(q).toLowerCase()&&x.serviceId===service.id))guardianQualifications.push({id:'qual-'+crypto.randomUUID(),name:q,serviceId:service.id,category:'Operational',description:'',validityMonths:0,active:true})}if(Array.isArray(s.radioGroups)&&s.radioGroups.length){guardianRadioConfig.services=Array.isArray(guardianRadioConfig.services)?guardianRadioConfig.services:[];guardianRadioConfig.services.push({id:service.id,name:service.name,prefix:String(s.radioGroups[0]||'OPS').replace(/-OPS\d+$/i,''),channels:s.radioGroups.map((name,i)=>({id:`${service.id}-ops-${i+1}`,name,open:true}))});guardianWriteJson(guardianRadioConfigFile,guardianRadioConfig)}guardianWriteJson(guardianConfigFile,guardianConfig);guardianWriteJson(guardianQualificationsFile,guardianQualifications);guardianAdminAuditLog(req.guardianAdmin.username,'SERVICE_ONBOARDED',{serviceId:service.id,name:service.name});res.json({ok:true,service})});

app.get('/api/admin/snapshots',guardianRequireAdmin('settings.view'),(_q,res)=>{const rows=[];for(const f of fs.readdirSync(guardianSnapshotsDir).filter(x=>x.endsWith('.json'))){try{const p=guardianReadJson(path.join(guardianSnapshotsDir,f),null);if(p)rows.push({id:f.replace(/\.json$/,''),name:p.snapshotName||f,createdAt:p.snapshotCreatedAt||p.exportedAt,createdBy:p.snapshotCreatedBy||'SYSTEM'})}catch{}}rows.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));res.json({ok:true,snapshots:rows})});
app.post('/api/admin/snapshots',guardianRequireAdmin('settings.edit'),(req,res)=>{const id=Date.now().toString(36)+'-'+crypto.randomBytes(3).toString('hex'),p=guardianSnapshotPayload();p.snapshotName=String(req.body?.name||'Manual restore point');p.snapshotCreatedAt=new Date().toISOString();p.snapshotCreatedBy=req.guardianAdmin.username;guardianWriteJson(path.join(guardianSnapshotsDir,id+'.json'),p);guardianAdminAuditLog(req.guardianAdmin.username,'SNAPSHOT_CREATED',{id,name:p.snapshotName});res.json({ok:true,id})});
app.post('/api/admin/snapshots/:id/restore',guardianRequireAdmin('settings.edit'),(req,res)=>{const file=path.join(guardianSnapshotsDir,path.basename(req.params.id)+'.json'),p=guardianReadJson(file,null);if(!p)return res.status(404).json({ok:false,error:'Snapshot not found'});try{guardianRestoreSnapshotPayload(p);guardianAdminAuditLog(req.guardianAdmin.username,'SNAPSHOT_RESTORED',{id:req.params.id});touch();res.json({ok:true})}catch(e){res.status(400).json({ok:false,error:e.message})}});

app.get('/api/admin/search',guardianRequireAdmin('settings.view'),(req,res)=>{const q=String(req.query.q||'').trim().toLowerCase();if(q.length<2)return res.json({ok:true,results:[]});const out=[],push=(type,title,subtitle,link)=>{const hay=`${title} ${subtitle}`.toLowerCase();if(hay.includes(q))out.push({type,title,subtitle,link})};for(const u of guardianAdminUsers.values())push('MEMBER',u.displayName||u.username,`${u.username} ${(u.serviceAssignments||[]).map(a=>`${a.callsign||''} ${a.rank||''} ${a.division||''}`).join(' ')}`,'/settings.html#governance');for(const s of guardianServices)push('SERVICE',s.name,`${s.id} ${(s.ranks||[]).join(' ')} ${(s.divisions||[]).join(' ')}`,'/settings.html#services');for(const st of guardianConfig.stations||[])push('LOCATION',st.name,`${st.code||''} ${st.postal||''} ${st.serviceId||''}`,'/settings.html#stations');for(const a of guardianConfig.appliances||[])push('VEHICLE',a.callsign||a.name,`${a.type||''} ${a.station||''} ${(a.skills||[]).join(' ')}`,'/settings.html#appliances');for(const f of guardianForms)push('FORM',f.title,`${f.category||''} ${f.description||''}`,'/settings.html#formsbuilder');for(const g of guardianGuides)push('GUIDE',g.title,`${g.category||''} ${g.summary||''}`,'/settings.html#guides');for(const ql of guardianQualifications)push('QUAL',ql.name,`${ql.serviceId||''} ${ql.category||''}`,'/settings.html#training');for(const inc of state.incidents||[])push('INCIDENT',`Incident #${inc.id}`,`${inc.type||''} ${inc.address||''} ${inc.postal||''}`,'/control/');res.json({ok:true,results:out.slice(0,40)})});

app.get('/api/admin/platform',guardianRequireAdmin('settings.view'),(_q,res)=>res.json({ok:true,statusPage:guardianPlatform.statusPage||{},dashboardWidgets:guardianPlatform.dashboardWidgets||{},services:guardianServices}));
app.post('/api/admin/platform/status',guardianRequireAdmin('settings.edit'),(req,res)=>{guardianPlatform.statusPage={enabled:req.body?.enabled!==false,message:String(req.body?.message||'All Guardian systems operational.')};guardianWriteJson(guardianPlatformFile,guardianPlatform);guardianAdminAuditLog(req.guardianAdmin.username,'PUBLIC_STATUS_UPDATED',guardianPlatform.statusPage);res.json({ok:true})});
app.post('/api/admin/platform/widgets',guardianRequireAdmin('settings.edit'),(req,res)=>{if(req.body?.dashboardWidgets&&typeof req.body.dashboardWidgets==='object')guardianPlatform.dashboardWidgets=req.body.dashboardWidgets;guardianWriteJson(guardianPlatformFile,guardianPlatform);guardianAdminAuditLog(req.guardianAdmin.username,'DASHBOARD_WIDGETS_UPDATED');res.json({ok:true})});
app.get('/api/public/status',(_q,res)=>{const enabled=guardianPlatform.statusPage?.enabled!==false;if(!enabled)return res.status(404).json({ok:false});const hb=Number(state.lastHeartbeatAt||0),fiveM=hb&&Date.now()-hb<45000;res.json({ok:true,name:guardianConfig.portal?.siteName||'Guardian Operations',message:guardianPlatform.statusPage?.message||'All Guardian systems operational.',systems:[{name:'Portal',status:'online'},{name:'Database',status:'online'},{name:'FiveM integration',status:fiveM?'online':'standalone'},{name:'Radio',status:'online'}],updatedAt:new Date().toISOString()})});

app.get('/api/admin/templates',guardianRequireAdmin('settings.view'),(_q,res)=>res.json({ok:true,templates:guardianTemplates.map(({data,...x})=>x)}));
app.post('/api/admin/templates/:id/install',guardianRequireAdmin('settings.edit'),(req,res)=>{const t=guardianTemplates.find(x=>x.id===req.params.id);if(!t)return res.status(404).json({ok:false,error:'Template not found'});if(t.kind==='form'){guardianForms.push({id:'form-'+crypto.randomUUID(),...JSON.parse(JSON.stringify(t.data))});guardianSaveForms()}else if(t.kind==='guide'){guardianGuides.push({id:'guide-'+crypto.randomUUID(),order:guardianGuides.length+1,...JSON.parse(JSON.stringify(t.data))});guardianWriteJson(guardianGuidesFile,guardianGuides)}guardianAdminAuditLog(req.guardianAdmin.username,'TEMPLATE_INSTALLED',{templateId:t.id,kind:t.kind});res.json({ok:true})});

app.get('/api/admin/station-dashboard',guardianRequireAdmin('settings.view'),(req,res)=>{const name=String(req.query.name||'');const vehicles=(guardianConfig.appliances||[]).filter(a=>String(a.station||'')===name);const crew=[];for(const u of guardianAdminUsers.values())for(const a of u.serviceAssignments||[])if(String(a.division||a.station||'')===name)crew.push({username:u.username,displayName:u.displayName,rank:a.rank,callsign:a.callsign});const available=vehicles.filter(v=>/AVAILABLE|HOME/i.test(String(state.units?.[v.callsign]?.status||''))).length;res.json({ok:true,name,vehicles:vehicles.map(v=>({...v,status:state.units?.[v.callsign]?.status||'OFF RUN'})),crew,coverLevel:vehicles.length===0?'N/A':available===0?'RED':available===1?'AMBER':'GREEN'})});

const controlFile = path.join(__dirname,"public","control","index.html");
const mdtFile = path.join(__dirname,"public","mdt","index.html");
const radioFile = path.join(__dirname,"public","radio","index.html");
const loginFile = path.join(__dirname,"public","login.html");
const portalFile = path.join(__dirname,"public","portal","index.html");
const applicationFile = path.join(__dirname,"public","apply","index.html");
function guardianSafeSession(req){return guardianUserReadSession(req)||guardianAdminReadSession(req)}
function guardianFivemEmbed(req){return String(req.query?.fivem||"")==="1"||String(req.query?.directNui||"")==="1"}
function guardianNeedWhitelist(req,res,nextPath){
  const session=guardianSafeSession(req);
  if(!session)return res.redirect(`/login/?next=${encodeURIComponent(nextPath)}&reason=portal`);
  if((guardianConfig.portal?.whitelistRequired!==false)&&!guardianSessionWhitelisted(session))return res.redirect("/portal/?access=whitelist");
  return session;
}
function guardianControlPage(req,res){
  const session=guardianNeedWhitelist(req,res,"/control/");if(!session||res.headersSent)return;
  if(!guardianRadioControlRole(session.role)||!guardianRoleAllows(session.role,"control"))return res.status(403).sendFile(portalFile);
  return res.sendFile(controlFile);
}
function guardianMdtPage(req,res){
  if(guardianFivemEmbed(req))return res.sendFile(mdtFile);
  const session=guardianNeedWhitelist(req,res,"/mdt/");if(!session||res.headersSent)return;
  if(!guardianRoleAllows(session.role,"mdt"))return res.status(403).sendFile(portalFile);
  return res.sendFile(mdtFile);
}
function guardianRadioPage(req,res){
  if(guardianFivemEmbed(req))return res.sendFile(radioFile);
  const session=guardianNeedWhitelist(req,res,"/radio/");if(!session||res.headersSent)return;
  if(!guardianRoleAllows(session.role,"radio"))return res.status(403).sendFile(portalFile);
  return res.sendFile(radioFile);
}
app.get(["/login","/login/"],(_q,r)=>{r.setHeader("Cache-Control","no-store");r.sendFile(loginFile)});
app.get(["/apply","/apply/"],(_q,r)=>{r.setHeader("Cache-Control","no-store");r.sendFile(applicationFile)});
app.get(["/portal","/portal/"],(_q,r)=>{r.setHeader("Cache-Control","no-store");r.sendFile(portalFile)});
app.get("/",(_q,r)=>r.sendFile(portalFile));
app.get(["/control","/control/"],guardianControlPage);
app.get(["/mdt","/mdt/"],guardianMdtPage);
app.get(["/radio","/radio/"],guardianRadioPage);
app.get(["/vehicle","/vehicle/"],(q,r)=>{
  r.setHeader("Cache-Control","no-store, no-cache, must-revalidate");
  const session=guardianUserReadSession(q);
  if(!session)return r.redirect("/login/?vehicle=1&next=%2Fvehicle%2F");
  if((guardianConfig.portal?.whitelistRequired!==false)&&!guardianSessionWhitelisted(session))return r.redirect("/portal/?access=whitelist");
  return r.redirect("/mdt/?vehicle=1&build=42");
});
// Prevent direct HTML-file bypasses while leaving CSS/JS/assets usable by FiveM NUI.
app.use((req,res,next)=>{
  const p=req.path.toLowerCase();
  const protectedHtml=(p==="/mdt/index.html"||p==="/control/index.html"||p==="/radio/index.html");
  if(!protectedHtml||guardianFivemEmbed(req))return next();
  const session=guardianNeedWhitelist(req,res,req.path);if(!session||res.headersSent)return;
  if(p==="/control/index.html"&&!guardianRadioControlRole(session.role))return res.status(403).sendFile(portalFile);
  next();
});

// MDT/Control are operational screens: never leave an Android WebView stuck on an old
// JavaScript/CSS build after a Render deployment.
app.use((req,res,next)=>{
  if(req.path.startsWith("/mdt/")||req.path.startsWith("/control/")||req.path.startsWith("/vehicle")||req.path.startsWith("/radio/")){
    res.setHeader("Cache-Control","no-store, no-cache, must-revalidate");
    res.setHeader("Pragma","no-cache");
    res.setHeader("Expires","0");
  }
  next();
});
app.use(express.static(path.join(__dirname,"public"),{etag:true,maxAge:0}));

app.listen(PORT,"0.0.0.0",()=>console.log(`Guardian Operations v2.7.0 Production Sync running on port ${PORT}`));
