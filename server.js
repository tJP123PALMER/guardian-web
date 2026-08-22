
import express from "express";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit:"2mb" }));
app.use(express.urlencoded({ extended:false }));

const PORT = Number(process.env.PORT || 3010);
const API_KEY = process.env.GUARDIAN_API_KEY || "CHANGE_ME";
const DATABASE_URL = process.env.DATABASE_URL || "";

const pool = DATABASE_URL ? new Pool({
  connectionString:DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized:false } : undefined
}) : null;

const clients = new Set();
const commands = new Map();
const recentEvents = [];
let eventSequence = 0;

let state = {
  connected:false,
  units:{},
  incidents:[],
  calls999:[],
  messages:[],
  callsigns:[],
  callSignStations:{},
  applianceSkills:{},
  lastHeartbeat:null,
  updatedAt:null
};

function upper(v){ return String(v ?? "").trim().toUpperCase(); }

async function db(sql, params=[]){
  if(!pool) return { rows:[] };
  return pool.query(sql, params);
}

async function initDb(){
  if(!pool){
    console.warn("[Guardian] DATABASE_URL not set. Running without PostgreSQL persistence.");
    return;
  }

  await db(`
    CREATE TABLE IF NOT EXISTS guardian_audit(
      id BIGSERIAL PRIMARY KEY,
      at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      username TEXT,
      role TEXT,
      action TEXT NOT NULL,
      target TEXT,
      details JSONB NOT NULL DEFAULT '{}'::jsonb
    );

    CREATE TABLE IF NOT EXISTS guardian_state_snapshots(
      id BIGSERIAL PRIMARY KEY,
      at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      state JSONB NOT NULL
    );

    CREATE TABLE IF NOT EXISTS guardian_event_log(
      id BIGSERIAL PRIMARY KEY,
      at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      kind TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb
    );

    CREATE TABLE IF NOT EXISTS guardian_web_bookings(
      id BIGSERIAL PRIMARY KEY,
      callsign TEXT NOT NULL,
      booked_on_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      booked_off_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_guardian_audit_at ON guardian_audit(at DESC);
    CREATE INDEX IF NOT EXISTS idx_guardian_events_at ON guardian_event_log(at DESC);
    CREATE INDEX IF NOT EXISTS idx_guardian_bookings_callsign ON guardian_web_bookings(callsign);
  `);

  console.log("[Guardian] PostgreSQL persistence ready.");
}
function authKey(req,res,next){
  const supplied=req.header("x-guardian-key");
  if(!supplied) return res.status(401).json({ok:false,error:"Unauthorized"});
  const a=Buffer.from(String(supplied)), b=Buffer.from(String(API_KEY));
  if(a.length!==b.length || !crypto.timingSafeEqual(a,b))
    return res.status(401).json({ok:false,error:"Unauthorized"});
  next();
}


async function audit(req, action, target="", details={}){
  try{
    await db(
      "INSERT INTO guardian_audit(username,role,action,target,details) VALUES($1,$2,$3,$4,$5::jsonb)",
      ["WEB","operator",action,target,JSON.stringify(details||{})]
    );
  }catch(err){ console.error("[Guardian audit]",err.message); }
}

function sendSse(type,payload){
  const line=`data: ${JSON.stringify({type,payload})}\n\n`;
  for(const res of [...clients]){
    try{res.write(line)}catch{clients.delete(res)}
  }
}

async function rememberEvent(kind,payload={}){
  const item={id:++eventSequence,kind:String(kind),payload,at:Date.now()};
  recentEvents.push(item);
  while(recentEvents.length>200) recentEvents.shift();
  sendSse("fivemEvent",item);
  try{
    await db("INSERT INTO guardian_event_log(kind,payload) VALUES($1,$2::jsonb)",[String(kind),JSON.stringify(payload||{})]);
  }catch(err){console.error("[Guardian event db]",err.message)}
  return item;
}

function pruneCommands(){
  const cutoff=Date.now()-5*60*1000;
  for(const [id,c] of commands){
    const t=Date.parse(c.acknowledgedAt||c.createdAt||0);
    if((c.acknowledged&&t<cutoff)||(!c.acknowledged&&t<Date.now()-30*60*1000)) commands.delete(id);
  }
}
setInterval(pruneCommands,60_000).unref?.();

setInterval(()=>{
  for(const res of [...clients]){
    try{res.write(`: keepalive ${Date.now()}\n\n`)}catch{clients.delete(res)}
  }
},15_000).unref?.();

app.get("/healthz",(_,res)=>res.json({
  ok:true,
  database:!!pool,
  clients:clients.size,
  commands:commands.size,
  fivemConnected:!!state.connected,
  updatedAt:state.updatedAt
}));

// -------- Shared operational APIs --------

app.get("/api/state",(_,res)=>{
  res.setHeader("Cache-Control","no-store");
  res.json({ok:true,state});
});

app.get("/api/recent-events",(req,res)=>{
  const since=Number(req.query.since||0);
  const ageMs=Math.max(1000,Math.min(Number(req.query.ageMs||30000),120000));
  const cutoff=Date.now()-ageMs;
  res.json({ok:true,events:recentEvents.filter(e=>e.id>since&&e.at>=cutoff)});
});

app.get("/api/events",(req,res)=>{
  res.setHeader("Content-Type","text/event-stream");
  res.setHeader("Cache-Control","no-cache, no-transform");
  res.setHeader("Connection","keep-alive");
  res.setHeader("X-Accel-Buffering","no");
  res.flushHeaders?.();
  clients.add(res);
  res.write("retry: 3000\n");
  res.write(`data: ${JSON.stringify({type:"state",payload:state})}\n\n`);
  const cleanup=()=>clients.delete(res);
  req.on("close",cleanup);req.on("aborted",cleanup);res.on("error",cleanup);
});

// FiveM remains API-key authenticated, not session authenticated.
app.post("/api/fivem/state",authKey,async(req,res)=>{
  state={...state,...(req.body||{}),connected:true,lastHeartbeat:new Date().toISOString(),updatedAt:new Date().toISOString()};
  sendSse("state",state);
  try{
    await db("INSERT INTO guardian_state_snapshots(state) VALUES($1::jsonb)",[JSON.stringify(state)]);
    await db(`DELETE FROM guardian_state_snapshots WHERE id NOT IN
              (SELECT id FROM guardian_state_snapshots ORDER BY id DESC LIMIT 500)`);
  }catch(err){console.error("[Guardian snapshot db]",err.message)}
  res.json({ok:true});
});

app.post("/api/fivem/event",authKey,async(req,res)=>{
  const {kind,payload={}}=req.body||{};
  if(!kind) return res.status(400).json({ok:false,error:"Missing event kind"});
  await rememberEvent(kind,payload);
  if(kind==="message"){
    const item=payload.item||payload;
    const key=[item.sender||"",item.time||"",item.text||""].join("|");
    const exists=(state.messages||[]).some(m=>[m.sender||"",m.time||"",m.text||""].join("|")===key);
    if(!exists){
      state.messages=[...(state.messages||[]),item].slice(-100);
      state.updatedAt=new Date().toISOString();
      sendSse("state",state);
    }
  }
  res.json({ok:true});
});

app.get("/api/fivem/commands",authKey,(_,res)=>{
  pruneCommands();
  res.json({ok:true,commands:[...commands.values()].filter(c=>!c.acknowledged)});
});

app.post("/api/fivem/commands/:id/ack",authKey,(req,res)=>{
  const c=commands.get(req.params.id);
  if(c){c.acknowledged=true;c.acknowledgedAt=new Date().toISOString()}
  res.json({ok:true});
});

const allowedCommands = new Set([
  "createIncident","createIncidentFrom999","assignAppliance","closeIncident",
  "updateIncidentDetails","sendMessage","dismiss999Call","setApplianceCrew",
  "setCrewMember","setIncidentRole","createResourceRequest","mobiliseResourceRequest",
  "webMdtStatus","webMdtAck","webMdtMessage","webBookOn","webBookOff"
]);

app.post("/api/command",async(req,res)=>{
  const {action,data={}}=req.body||{};
  if(!allowedCommands.has(action)){
    return res.status(400).json({ok:false,error:"Unsupported action"});
  }

  if(action==="webBookOn"){
    const callsign=upper(data.callsign);
    if(!callsign) return res.status(400).json({ok:false,error:"Callsign required"});

    if(pool){
      const active=await db(
        `SELECT id FROM guardian_web_bookings
         WHERE callsign=$1 AND booked_off_at IS NULL LIMIT 1`,
        [callsign]
      );
      if(!active.rows.length){
        await db(
          `INSERT INTO guardian_web_bookings(callsign) VALUES($1)`,
          [callsign]
        );
      }
    }
  }

  if(action==="webBookOff" && pool){
    const callsign=upper(data.callsign);
    await db(
      `UPDATE guardian_web_bookings SET booked_off_at=NOW()
       WHERE callsign=$1 AND booked_off_at IS NULL`,
      [callsign]
    );
  }

  const id=crypto.randomUUID();
  commands.set(id,{
    id,action,data,
    createdAt:new Date().toISOString(),
    acknowledged:false
  });

  await audit(req,"COMMAND",action,{id,data});
  res.json({ok:true,id});
});

// -------- Direct application routes (no login layer) --------

app.get("/control",(_,res)=>res.sendFile(path.join(__dirname,"public","control","index.html")));
app.get("/control/",(_,res)=>{
  res.sendFile(path.join(__dirname,"public","control","index.html"));
});

app.get("/mdt",(_,res)=>res.sendFile(path.join(__dirname,"public","mdt","index.html")));
app.get("/mdt/",(_,res)=>{
  res.sendFile(path.join(__dirname,"public","mdt","index.html"));
});


app.get("/guardian-version",(_,res)=>res.type("text/plain").send("Guardian Operations v11.2 ZERO-REDIRECTS"));
// static files after protected HTML routes; APIs remain protected above.
app.use(express.static(path.join(__dirname,"public")));

app.get("/",(_,res)=>res.sendFile(path.join(__dirname,"public","control","index.html")));

process.on("unhandledRejection",err=>console.error("[Guardian] unhandled rejection",err));
process.on("uncaughtException",err=>console.error("[Guardian] uncaught exception",err));

await initDb();

app.listen(PORT,"0.0.0.0",()=>{
  console.log(`Guardian Operations v11.2 zero-redirects running on port ${PORT}`);
});
