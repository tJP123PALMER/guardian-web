import express from "express";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.GUARDIAN_API_KEY || "";

app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));

const clients = new Set();
const commands = new Map();

let state = {
  connected: false,
  units: {},
  incidents: [],
  calls999: [],
  messages: [],
  callsigns: [],
  callSignStations: {},
  applianceSkills: {},
  lastHeartbeat: null,
  updatedAt: new Date().toISOString()
};

function auth(req, res, next) {
  if (!API_KEY) {
    return res.status(503).json({ ok: false, error: "GUARDIAN_API_KEY not configured" });
  }

  const supplied = String(req.header("x-guardian-key") || "");
  const expected = String(API_KEY);
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);

  if (!supplied || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  next();
}

function broadcast(type, payload) {
  const packet = `data: ${JSON.stringify({ type, payload })}\n\n`;
  for (const res of [...clients]) {
    try { res.write(packet); }
    catch { clients.delete(res); }
  }
}

setInterval(() => {
  for (const res of [...clients]) {
    try { res.write(`: guardian-keepalive ${Date.now()}\n\n`); }
    catch { clients.delete(res); }
  }
}, 15000).unref?.();

app.get("/guardian-version", (_req, res) => {
  res.type("text/plain").send("Guardian Clean Foundation v1");
});

app.get("/healthz", (_req, res) => {
  res.json({
    ok: true,
    version: "Guardian Clean Foundation v1",
    fivemConnected: state.connected,
    browserClients: clients.size,
    pendingCommands: [...commands.values()].filter(c => !c.acknowledged).length,
    updatedAt: state.updatedAt
  });
});

app.get("/api/state", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ ok: true, state });
});

app.get("/api/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  clients.add(res);
  res.write("retry: 3000\n");
  res.write(`data: ${JSON.stringify({ type: "state", payload: state })}\n\n`);

  const cleanup = () => clients.delete(res);
  req.on("close", cleanup);
  req.on("aborted", cleanup);
  res.on("error", cleanup);
});

app.post("/api/fivem/state", auth, (req, res) => {
  state = {
    ...state,
    ...(req.body || {}),
    connected: true,
    lastHeartbeat: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  broadcast("state", state);
  res.json({ ok: true });
});

app.post("/api/fivem/event", auth, (req, res) => {
  const event = {
    id: crypto.randomUUID(),
    kind: String(req.body?.kind || "event"),
    payload: req.body?.payload || {},
    at: new Date().toISOString()
  };

  broadcast("event", event);
  res.json({ ok: true, event });
});

const allowed = new Set([
  "createIncident",
  "updateIncident",
  "closeIncident",
  "assignAppliance",
  "sendMessage",
  "dismiss999Call",
  "setApplianceCrew",
  "setCrewMember",
  "setIncidentRole",
  "webBookOn",
  "webBookOff",
  "webMdtStatus",
  "webMdtAck",
  "webMdtMessage"
]);

app.post("/api/command", (req, res) => {
  const action = String(req.body?.action || "");
  const data = req.body?.data || {};

  if (!allowed.has(action)) {
    return res.status(400).json({ ok: false, error: "Unsupported action" });
  }

  const id = crypto.randomUUID();

  commands.set(id, {
    id,
    action,
    data,
    createdAt: new Date().toISOString(),
    acknowledged: false
  });

  res.json({ ok: true, id });
});

app.get("/api/fivem/commands", auth, (_req, res) => {
  res.json({
    ok: true,
    commands: [...commands.values()].filter(c => !c.acknowledged)
  });
});

app.post("/api/fivem/commands/:id/ack", auth, (req, res) => {
  const command = commands.get(req.params.id);

  if (command) {
    command.acknowledged = true;
    command.acknowledgedAt = new Date().toISOString();
  }

  res.json({ ok: true });
});

const controlFile = path.join(__dirname, "public", "control", "index.html");
const mdtFile = path.join(__dirname, "public", "mdt", "index.html");

app.get("/", (_req, res) => res.sendFile(controlFile));
app.get("/control", (_req, res) => res.sendFile(controlFile));
app.get("/control/", (_req, res) => res.sendFile(controlFile));
app.get("/mdt", (_req, res) => res.sendFile(mdtFile));
app.get("/mdt/", (_req, res) => res.sendFile(mdtFile));

app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Guardian Clean Foundation v1 running on port ${PORT}`);
});
